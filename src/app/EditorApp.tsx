import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import {
	Tldraw,
	type Editor,
	type TLComponents,
	type TLStore,
	type TLUiActionItem,
	type TLUiOverrides,
} from 'tldraw'
import 'tldraw/tldraw.css'
import { FileMainMenu } from '@/app/FileMenu'
import { AppDialogHost } from '@/app/Dialogs'
import { StatusBar } from '@/app/StatusBar'
import { registerAppContentHandlers } from '@/app/contentHandlers'
import { createDemo } from '@/app/demos'
import { assetUrls, editorMediaLimits, licenseKey, needsProductionLicenseNotice } from '@/config/assets'
import { DocumentController } from '@/document/DocumentController'
import { createAppStore } from '@/document/tldrawAdapter'
import type {
	AppDialog,
	AppUiState,
	ExternalChangeChoice,
	RecoveryChoice,
	UnsavedChoice,
} from '@/document/types'

type NotifyFn = (message: string, kind?: 'info' | 'error') => void

type PendingDialog = {
	dialog: AppDialog
	resolve(value: UnsavedChoice | ExternalChangeChoice | RecoveryChoice | true): void
}

const components: TLComponents = {
	MainMenu: FileMainMenu,
}

const tldrawLicenseKey = licenseKey()

export function EditorApp() {
	const [store, setStore] = useState<TLStore>(() => createAppStore())
	const [storeKey, setStoreKey] = useState(0)
	const [ui, setUi] = useState<AppUiState>({
		fileName: 'untitled.tldraw.svg',
		dirty: false,
		busy: false,
		status: '読み込み中…',
		error: null,
		locked: false,
	})
	const [pending, setPending] = useState<PendingDialog | null>(null)
	const controllerRef = useRef<DocumentController | null>(null)
	const notifyRef = useRef<NotifyFn>(() => undefined)

	if (controllerRef.current === null) {
		controllerRef.current = new DocumentController(store, {
			replaceStore(next) {
				setStore((prev) => {
					if (prev !== next) {
						const old = prev
						queueMicrotask(() => old.dispose())
					}
					return next
				})
				setStoreKey((value) => value + 1)
			},
			askUnsaved: () =>
				askDialog<UnsavedChoice>({
					id: crypto.randomUUID(),
					kind: 'unsaved',
					message:
						'保存しないと変更が失われます。ダウンロード環境では、ダウンロード開始後も未保存として扱います。',
				}),
			askExternalChange: () =>
				askDialog<ExternalChangeChoice>({
					id: crypto.randomUUID(),
					kind: 'external-change',
					message: 'このファイルは他のアプリで変更されています。上書きせず、別名で保存してください。',
				}),
			askRecovery: (fileName) =>
				askDialog<RecoveryChoice>({
					id: crypto.randomUUID(),
					kind: 'recovery',
					message: `${fileName} の未保存内容を復元しますか？`,
				}),
			notify: (message, kind) => notifyRef.current(message, kind),
		})
	}

	const controller = controllerRef.current

	function askDialog<T>(dialog: AppDialog): Promise<T> {
		return new Promise((resolve) => {
			setPending({
				dialog,
				resolve: (value) => resolve(value as T),
			})
		})
	}

	useEffect(() => controller.subscribe(setUi), [controller])

	useEffect(() => {
		notifyRef.current = (message, kind) => {
			setUi((current) => ({
				...current,
				status: message,
				error: kind === 'error' ? message : current.error,
			}))
		}
	})

	useEffect(() => {
		void controller.initialize()
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!controller.isDirty()) return
			event.preventDefault()
			event.returnValue = ''
		}
		window.addEventListener('beforeunload', onBeforeUnload)
		return () => {
			window.removeEventListener('beforeunload', onBeforeUnload)
			controller.dispose()
		}
	}, [controller])

	return (
		<div className={`app-shell${ui.locked ? ' is-locked' : ''}`}>
			{needsProductionLicenseNotice() ? (
				<div className="license-banner" data-testid="license-banner">
					GitHub Pages などの本番公開には tldraw のライセンスキーが必要です。キーがないと数秒後にエディタが停止します。
					リポジトリの Actions secrets に <code>VITE_TLDRAW_LICENSE_KEY</code> を入れ、許可ホストへこの Pages のドメイン（例: sugitlab.github.io）を含めてください。localhost ではキーなしで使えます。
				</div>
			) : null}
			<StatusBar state={ui} />
			<div className="editor-frame">
				<TldrawWorkspace store={store} storeKey={storeKey} controller={controller} notifyRef={notifyRef} />
			</div>
			<AppDialogHost
				dialog={pending?.dialog ?? null}
				onUnsaved={(choice) => resolvePending(choice)}
				onExternal={(choice) => resolvePending(choice)}
				onRecovery={(choice) => resolvePending(choice)}
				onNotice={() => resolvePending(true)}
			/>
		</div>
	)

	function resolvePending(value: UnsavedChoice | ExternalChangeChoice | RecoveryChoice | true) {
		pending?.resolve(value)
		setPending(null)
	}
}

const TldrawWorkspace = memo(function TldrawWorkspace({
	store,
	storeKey,
	controller,
	notifyRef,
}: {
	store: TLStore
	storeKey: number
	controller: DocumentController
	notifyRef: MutableRefObject<NotifyFn>
}) {
	const overrides = useMemo<TLUiOverrides>(
		() => ({
			actions(_editor, actions) {
				delete actions['export-as-svg']
				delete actions['export-as-png']
				delete actions['export-all-as-svg']
				delete actions['export-all-as-png']
				delete actions['insert-embed']
				const items: Record<string, TLUiActionItem> = {
					'tldraw-svg.new': {
						id: 'tldraw-svg.new',
						label: '新規作成',
						readonlyOk: true,
						onSelect: () => void controller.newDocument(),
					},
					'tldraw-svg.open': {
						id: 'tldraw-svg.open',
						label: '開く',
						kbd: 'cmd+o,ctrl+o',
						readonlyOk: true,
						onSelect: () => void controller.open(),
					},
					'tldraw-svg.save': {
						id: 'tldraw-svg.save',
						label: '保存',
						kbd: 'cmd+s,ctrl+s',
						readonlyOk: true,
						onSelect: () => void controller.save(),
					},
					'tldraw-svg.save-as': {
						id: 'tldraw-svg.save-as',
						label: '名前を付けて保存',
						kbd: 'cmd+shift+s,ctrl+shift+s',
						readonlyOk: true,
						onSelect: () => void controller.saveAs(),
					},
					'tldraw-svg.export-preview': {
						id: 'tldraw-svg.export-preview',
						label: '表示用SVGを書き出す',
						readonlyOk: true,
						onSelect: () => void controller.exportPreviewSvg(),
					},
				}
				return { ...actions, ...items }
			},
		}),
		[controller]
	)

	const onMount = useCallback(
		(editor: Editor) => {
			controller.attachEditor(editor)
			registerAppContentHandlers(editor, controller, (message, kind) => {
				notifyRef.current(message, kind)
			})
			window.__tldrawSvgMountCount = (window.__tldrawSvgMountCount ?? 0) + 1
			const mountCount = window.__tldrawSvgMountCount
			window.__tldrawSvg = {
				ready: true,
				mountCount,
				encodeCurrent: () => controller.encodeCurrent(),
				openSvgText: (text) => controller.openSvgText(text),
				getFileName: () => controller.getFileName(),
				isDirty: () => controller.isDirty(),
				getPageCount: () => editor.getPages().length,
				getDocumentStats: () => {
					const records = editor.store.allRecords()
					return {
						pages: records.filter((record) => record.typeName === 'page').length,
						shapes: records.filter((record) => record.typeName === 'shape').length,
						assets: records.filter((record) => record.typeName === 'asset').length,
					}
				},
				createDemo: (kind) => createDemo(editor, kind),
				insertPng: async (base64) => {
					const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
					const file = new File([bytes], 'sample.png', { type: 'image/png' })
					await editor.putExternalContent({ type: 'files', files: [file] })
				},
			}
			return () => {
				if (window.__tldrawSvg?.mountCount === mountCount) {
					window.__tldrawSvg = undefined
				}
			}
		},
		[controller, notifyRef]
	)

	return (
		<Tldraw
			key={storeKey}
			store={store}
			licenseKey={tldrawLicenseKey}
			assetUrls={assetUrls}
			colorScheme="light"
			overrides={overrides}
			components={components}
			{...editorMediaLimits}
			onMount={onMount}
		/>
	)
})
