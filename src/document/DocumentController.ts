import type { Editor, TLStore } from 'tldraw'
import { localAssetStore } from '@/assets/localAssetStore'
import { makePortable } from '@/assets/makePortable'
import { DEFAULT_FILE_NAME } from '@/config/app'
import { errorFor } from '@/config/messages'
import { RECOVERY_DEBOUNCE_MS } from '@/config/app'
import { DocumentFileError, isCancelled, userMessage, UserCancelledError } from '@/document/errors'
import {
	createAppStore,
	focusPreviewPage,
	getDocumentSnapshot,
	getPreviewPageId,
	listenDocumentChanges,
	loadDocumentIntoStore,
} from '@/document/tldrawAdapter'
import type {
	AppUiState,
	DocumentSession,
	ExternalChangeChoice,
	FileBinding,
	PortableDocument,
	RecoveryChoice,
	UnsavedChoice,
	WriteResult,
} from '@/document/types'
import { renderPreview } from '@/export/renderPreview'
import { createPayload } from '@/format/payload'
import { displayFileName, normalizeSaveName, previewExportName } from '@/format/filename'
import { encodeEditableSvg, decodeEditableSvg, serializeSvg } from '@/format/svgCodec'
import { validateDocumentSnapshot } from '@/format/validateDocument'
import { downloadBlob } from '@/io/download'
import {
	detectExternalChange,
	hasFileSystemAccess,
	pickFileWithInput,
	pickOpenFile,
	pickSaveFile,
	readHandle,
	writeHandle,
} from '@/io/fileSystemAccess'
import { sha256Hex } from '@/io/hash'
import {
	createDocumentId,
	getTabId,
	recoveryStore,
	type RecoveryRecord,
} from '@/recovery/recoveryStore'

export type ControllerHooks = {
	replaceStore(store: TLStore): void
	askUnsaved(): Promise<UnsavedChoice>
	askExternalChange(): Promise<ExternalChangeChoice>
	askRecovery(fileName: string): Promise<RecoveryChoice>
	notify(message: string, kind?: 'info' | 'error'): void
}

export class DocumentController {
	private editor: Editor | null = null
	private currentStore: TLStore
	private unlisten: (() => void) | null = null
	private recoveryTimer: number | null = null
	private abort: AbortController | null = null
	private queuedSave: 'save' | 'save-as' | null = null
	private hooks: ControllerHooks
	private tabId = getTabId()
	private documentId = createDocumentId()
	private session: DocumentSession = {
		documentEpoch: 1,
		documentRevision: 0,
		savedRevision: 0,
		lastDownloadedRevision: null,
		isSaving: false,
		isLoading: false,
	}
	private binding: FileBinding = {
		fileName: DEFAULT_FILE_NAME,
		handle: null,
		contentHash: null,
	}
	private ui: AppUiState = {
		fileName: DEFAULT_FILE_NAME,
		dirty: false,
		busy: false,
		status: '新規文書',
		error: null,
		locked: false,
	}
	private listeners = new Set<(state: AppUiState) => void>()

	constructor(store: TLStore, hooks: ControllerHooks) {
		this.currentStore = store
		this.hooks = hooks
		this.attachStore(store)
	}

	subscribe(listener: (state: AppUiState) => void): () => void {
		this.listeners.add(listener)
		listener(this.ui)
		return () => {
			this.listeners.delete(listener)
		}
	}

	getState(): AppUiState {
		return this.ui
	}

	isDirty(): boolean {
		return this.session.savedRevision !== this.session.documentRevision
	}

	getFileName(): string {
		return this.binding.fileName
	}

	getStore(): TLStore {
		return this.currentStore
	}

	attachEditor(editor: Editor): void {
		this.editor = editor
		editor.user.updateUserPreferences({ colorScheme: 'light' })
		this.scheduleRecovery()
	}

	async initialize(): Promise<void> {
		try {
			const recovered = await recoveryStore.loadLatestForTab(this.tabId)
			if (!recovered) return
			const choice = await this.hooks.askRecovery(recovered.fileName)
			if (choice === 'restore') {
				await this.replaceWithDocument(recovered.portableDocument, recovered.fileName, null, null)
				this.session.savedRevision = null
				this.session.lastDownloadedRevision = null
				this.setUi({ status: '未保存の内容を復元しました', dirty: true })
			} else {
				await recoveryStore.clearTab(this.tabId)
			}
		} catch {
			// 復旧失敗でも編集は続ける
		}
	}

	async newDocument(): Promise<void> {
		if (this.isBusy()) return
		if (!(await this.confirmDiscardIfNeeded())) return
		this.beginEpoch()
		const store = createAppStore()
		this.replaceLiveStore(store)
		this.binding = { fileName: DEFAULT_FILE_NAME, handle: null, contentHash: null }
		this.session.savedRevision = 0
		this.session.documentRevision = 0
		this.session.lastDownloadedRevision = null
		void recoveryStore.clearDocument(this.documentId)
		this.setUi({ fileName: DEFAULT_FILE_NAME, dirty: false, status: '新規文書', error: null })
	}

	async open(): Promise<void> {
		if (this.isBusy()) return
		let file: File
		let handle: FileSystemFileHandle | null = null
		try {
			if (hasFileSystemAccess()) {
				handle = await pickOpenFile()
				file = (await readHandle(handle)).file
			} else {
				file = await pickFileWithInput()
			}
		} catch (error) {
			if (isCancelled(error)) return
			this.fail(error)
			return
		}
		await this.openFile(file, handle)
	}

	async openFile(file: File, handle: FileSystemFileHandle | null = null): Promise<void> {
		if (this.isBusy()) return
		this.session.isLoading = true
		this.setUi({ busy: true, locked: true, status: '読み込み中…', error: null })
		const currentEpoch = this.session.documentEpoch
		try {
			const payload = await decodeEditableSvg(file)
			await validateDocumentSnapshot(payload.document, { previewPageId: payload.preview.pageId })
			const previewStore = createAppStore()
			try {
				loadDocumentIntoStore(previewStore, payload.document)
				const migrated = previewStore.getStoreSnapshot()
				await validateDocumentSnapshot(migrated, { previewPageId: payload.preview.pageId })
				if (this.session.documentEpoch !== currentEpoch) {
					previewStore.dispose()
					return
				}
				if (!(await this.confirmDiscardIfNeeded())) {
					previewStore.dispose()
					return
				}
				this.beginEpoch()
				this.replaceLiveStore(previewStore)
				this.binding = {
					fileName: file.name || DEFAULT_FILE_NAME,
					handle,
					contentHash: await sha256Hex(file),
				}
				this.session.savedRevision = 0
				this.session.documentRevision = 0
				this.session.lastDownloadedRevision = handle ? 0 : null
				this.editor?.setCurrentPage(payload.preview.pageId as never)
				if (this.editor) focusPreviewPage(this.editor, payload.preview.pageId)
				this.setUi({
					fileName: displayFileName(file.name),
					dirty: false,
					status: 'ファイルを開きました',
					error: null,
				})
			} catch (error) {
				previewStore.dispose()
				throw error
			}
		} catch (error) {
			if (isCancelled(error)) {
				this.setUi({ status: this.isDirty() ? '未保存の変更があります' : this.ui.status })
				return
			}
			this.fail(error)
		} finally {
			this.session.isLoading = false
			this.setUi({ busy: false, locked: false })
		}
	}

	async save(): Promise<void> {
		await this.saveInternal('save')
	}

	async saveAs(): Promise<void> {
		await this.saveInternal('save-as')
	}

	async exportPreviewSvg(): Promise<void> {
		if (!this.editor || this.isBusy()) return
		this.setUi({ busy: true, locked: true, status: '表示用SVGを書き出し中…', error: null })
		const signal = this.beginWork()
		const epoch = this.session.documentEpoch
		try {
			await localAssetStore.waitForIdle(signal)
			if (localAssetStore.hasFailures()) {
				throw errorFor('ASSET_UNAVAILABLE')
			}
			const snapshot = structuredClone(getDocumentSnapshot(this.editor))
			const portable = await makePortable(snapshot, signal)
			const pageId = getPreviewPageId(this.editor)
			const preview = await renderPreview(portable, pageId, signal)
			const xml = serializeSvg(preview.svg)
			if (this.session.documentEpoch !== epoch) return
			downloadBlob(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }), previewExportName(this.binding.fileName))
			this.setUi({
				status: '表示用SVGのダウンロードを開始しました',
				error: null,
			})
		} catch (error) {
			if (isCancelled(error)) return
			this.fail(error)
		} finally {
			this.endWork()
			this.setUi({ busy: false, locked: false, dirty: this.isDirty() })
		}
	}

	async encodeCurrent(): Promise<string> {
		if (!this.editor) throw errorFor('SAVE_FAILED', 'エディタが準備できていません。')
		const signal = new AbortController().signal
		const snapshot = structuredClone(getDocumentSnapshot(this.editor))
		const portable = await makePortable(snapshot, signal)
		const preview = await renderPreview(portable, getPreviewPageId(this.editor), signal)
		const payload = createPayload({ document: portable, pageId: preview.pageId, mode: preview.mode })
		const blob = encodeEditableSvg(preview, payload)
		return await blob.text()
	}

	async openSvgText(text: string): Promise<void> {
		const file = new File([text], this.binding.fileName, { type: 'image/svg+xml' })
		await this.openFile(file, null)
	}

	dispose(): void {
		this.unlisten?.()
		if (this.recoveryTimer) window.clearTimeout(this.recoveryTimer)
		this.abort?.abort()
	}

	private async saveInternal(mode: 'save' | 'save-as'): Promise<void> {
		if (this.session.isSaving || this.session.isLoading) {
			this.queuedSave = mode
			return
		}
		if (!this.editor) return

		let handle = mode === 'save-as' ? null : this.binding.handle
		const useFsa = hasFileSystemAccess()
		if (useFsa && (mode === 'save-as' || !handle)) {
			try {
				handle = await pickSaveFile(normalizeSaveName(this.binding.fileName))
			} catch (error) {
				if (isCancelled(error)) return
				this.fail(error)
				return
			}
		}

		if (useFsa && handle && mode !== 'save-as') {
			const changed = await detectExternalChange(handle, this.binding.contentHash)
			if (changed) {
				const choice = await this.hooks.askExternalChange()
				if (choice === 'cancel') return
				await this.saveInternal('save-as')
				return
			}
		}

		this.session.isSaving = true
		this.setUi({ busy: true, locked: true, status: '保存中…', error: null })
		const epoch = this.session.documentEpoch
		const revision = this.session.documentRevision
		const signal = this.beginWork()
		try {
			await localAssetStore.waitForIdle(signal)
			if (localAssetStore.hasFailures()) {
				throw errorFor('ASSET_UNAVAILABLE')
			}
			const snapshot = structuredClone(getDocumentSnapshot(this.editor))
			const pageId = getPreviewPageId(this.editor)
			const portable = await makePortable(snapshot, signal)
			await validateDocumentSnapshot(portable, { previewPageId: pageId })
			const previewStore = createAppStore()
			try {
				loadDocumentIntoStore(previewStore, portable)
				await validateDocumentSnapshot(previewStore.getStoreSnapshot(), { previewPageId: pageId })
			} finally {
				previewStore.dispose()
			}
			const preview = await renderPreview(portable, pageId, signal)
			if (preview.resolutionReduced) {
				this.hooks.notify('プレビュー解像度を下げて保存します。')
			}
			const payload = createPayload({
				document: portable,
				pageId: preview.pageId,
				mode: preview.mode,
			})
			const blob = encodeEditableSvg(preview, payload)
			const result = await this.writeOutput(blob, handle)
			if (this.session.documentEpoch !== epoch) return
			this.applyWriteResult(result, revision, handle, blob)
		} catch (error) {
			if (isCancelled(error)) return
			this.fail(error, 'SAVE_FAILED')
		} finally {
			this.session.isSaving = false
			this.endWork()
			this.setUi({ busy: false, locked: false, dirty: this.isDirty() })
			if (this.queuedSave) {
				const next = this.queuedSave
				this.queuedSave = null
				void this.saveInternal(next)
			}
		}
	}

	private async writeOutput(
		blob: Blob,
		handle: FileSystemFileHandle | null
	): Promise<WriteResult> {
		if (handle) {
			const hash = await writeHandle(handle, blob)
			return { kind: 'written', fileName: handle.name, contentHash: hash }
		}
		const fileName = normalizeSaveName(this.binding.fileName)
		downloadBlob(blob, fileName)
		return { kind: 'download-started', fileName }
	}

	private applyWriteResult(
		result: WriteResult,
		revision: number,
		handle: FileSystemFileHandle | null,
		blob: Blob
	): void {
		if (result.kind === 'cancelled') return
		if (result.kind === 'written') {
			this.binding = {
				fileName: result.fileName,
				handle,
				contentHash: result.contentHash,
			}
			this.session.savedRevision = revision
			this.setUi({
				fileName: result.fileName,
				dirty: this.session.documentRevision !== revision,
				status: this.session.documentRevision !== revision ? '保存しました（その後の変更あり）' : '保存しました',
				error: null,
			})
			if (this.session.documentRevision === revision) {
				void recoveryStore.clearDocument(this.documentId)
			}
			return
		}
		this.session.lastDownloadedRevision = revision
		void blob.arrayBuffer()
		this.setUi({
			fileName: result.fileName,
			dirty: true,
			status: 'ダウンロードを開始しました',
			error: null,
		})
	}

	private async confirmDiscardIfNeeded(): Promise<boolean> {
		if (!this.isDirty()) return true
		const choice = await this.hooks.askUnsaved()
		if (choice === 'cancel') return false
		if (choice === 'save') {
			await this.save()
			return !this.isDirty() || this.session.lastDownloadedRevision === this.session.documentRevision
		}
		return true
	}

	private replaceLiveStore(store: TLStore): void {
		this.attachStore(store)
		this.hooks.replaceStore(store)
	}

	private attachStore(store: TLStore): void {
		this.unlisten?.()
		this.currentStore = store
		this.unlisten = listenDocumentChanges(store, () => {
			this.session.documentRevision += 1
			this.setUi({
				dirty: this.isDirty(),
				status: this.isDirty() ? '未保存の変更があります' : this.ui.status,
			})
			this.scheduleRecovery()
		})
	}

	private beginEpoch(): void {
		this.session.documentEpoch += 1
		this.documentId = createDocumentId()
		this.abort?.abort()
		this.abort = null
		localAssetStore.clearFailures()
	}

	private beginWork(): AbortSignal {
		this.abort?.abort()
		this.abort = new AbortController()
		return this.abort.signal
	}

	private endWork(): void {
		this.abort = null
	}

	private isBusy(): boolean {
		return this.session.isSaving || this.session.isLoading
	}

	private scheduleRecovery(): void {
		if (this.recoveryTimer) window.clearTimeout(this.recoveryTimer)
		this.recoveryTimer = window.setTimeout(() => {
			void this.persistRecovery()
		}, RECOVERY_DEBOUNCE_MS)
	}

	private async persistRecovery(): Promise<void> {
		if (!this.editor) return
		const revision = this.session.documentRevision
		const documentId = this.documentId
		try {
			const portable = await makePortable(structuredClone(getDocumentSnapshot(this.editor)))
			const record: RecoveryRecord = {
				tabId: this.tabId,
				documentId,
				revision,
				updatedAt: Date.now(),
				fileName: this.binding.fileName,
				portableDocument: portable,
			}
			recoveryStore.enqueue(record)
		} catch {
			// 復旧保存失敗でも手動保存は続ける
		}
	}

	private async replaceWithDocument(
		document: PortableDocument,
		fileName: string,
		handle: FileSystemFileHandle | null,
		hash: string | null
	): Promise<void> {
		const store = createAppStore()
		loadDocumentIntoStore(store, document)
		this.beginEpoch()
		this.replaceLiveStore(store)
		this.binding = { fileName, handle, contentHash: hash }
		this.session.documentRevision = 1
		this.session.savedRevision = null
	}

	private fail(error: unknown, fallback?: 'SAVE_FAILED'): void {
		if (isCancelled(error)) return
		const wrapped =
			error instanceof DocumentFileError ? error : fallback ? errorFor(fallback) : error
		const message = userMessage(wrapped)
		if (message) {
			this.setUi({ error: message, status: message })
			this.hooks.notify(message, 'error')
		}
		if (import.meta.env.DEV && wrapped instanceof DocumentFileError) {
			console.warn(`[tldraw-svg] ${wrapped.code}`, wrapped.details ?? '')
		}
	}

	private setUi(patch: Partial<AppUiState>): void {
		this.ui = { ...this.ui, ...patch, dirty: patch.dirty ?? this.isDirty() }
		for (const listener of this.listeners) listener(this.ui)
	}
}

export function shouldWarnBeforeUnload(controller: DocumentController): boolean {
	return controller.isDirty()
}

export { UserCancelledError }
