import { useEffect, useMemo, useRef, useState } from 'react'
import {
	Tldraw,
	type TLComponents,
	type TLStore,
	type TLUiOverrides,
	type TLUiActionItem,
} from 'tldraw'
import 'tldraw/tldraw.css'
import { FileMainMenu } from '@/app/FileMenu'
import { AppDialogHost } from '@/app/Dialogs'
import { StatusBar } from '@/app/StatusBar'
import { registerAppContentHandlers } from '@/app/contentHandlers'
import { createDemo } from '@/app/demos'
import { ACCEPTED_IMAGE_MIME_TYPES } from '@/config/app'
import { assetUrls, editorMediaLimits, licenseKey } from '@/config/assets'
import { DocumentController } from '@/document/DocumentController'
import { createAppStore } from '@/document/tldrawAdapter'
import type {
	AppDialog,
	AppUiState,
	ExternalChangeChoice,
	RecoveryChoice,
	UnsavedChoice,
} from '@/document/types'

type PendingDialog = {
	dialog: AppDialog
	resolve(value: UnsavedChoice | ExternalChangeChoice | RecoveryChoice | true): void
}

const components: TLComponents = {
	MainMenu: FileMainMenu,
}

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
	const notifyRef = useRef<(message: string, kind?: 'info' | 'error') => void>(() => undefined)

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

	return (
		<div className={`app-shell${ui.locked ? ' is-locked' : ''}`}>
			<StatusBar state={ui} />
			<div className="editor-frame">
				<Tldraw
					key={storeKey}
					store={store}
					licenseKey={licenseKey()}
					assetUrls={assetUrls}
					colorScheme="light"
					overrides={overrides}
					components={components}
					{...editorMediaLimits}
					acceptedImageMimeTypes={[...ACCEPTED_IMAGE_MIME_TYPES]}
					acceptedVideoMimeTypes={[]}
					onMount={(editor) => {
						controller.attachEditor(editor)
						registerAppContentHandlers(editor, controller, notifyRef.current)
						window.__tldrawSvg = {
							ready: true,
							encodeCurrent: () => controller.encodeCurrent(),
							openSvgText: (text) => controller.openSvgText(text),
							getFileName: () => controller.getFileName(),
							isDirty: () => controller.isDirty(),
							getPageCount: () => editor.getPages().length,
							createDemo: (kind) => createDemo(editor, kind),
						}
						return () => {
							window.__tldrawSvg = undefined
						}
					}}
				/>
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
