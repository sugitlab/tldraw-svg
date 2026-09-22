import type { getSnapshot, TLStoreSnapshot } from 'tldraw'

export type DocumentSnapshot = ReturnType<typeof getSnapshot>['document'] | TLStoreSnapshot

export type PreviewMode = 'svg' | 'raster'

export type TldrawSvgPayloadV1 = {
	format: 'tldraw-svg'
	formatVersion: 1
	producer: {
		app: string
		appVersion: string
		tldrawVersion: string
	}
	preview: {
		pageId: string
		background: '#ffffff'
		padding: 32
		mode: PreviewMode
	}
	document: DocumentSnapshot
}

export type PortableDocument = DocumentSnapshot

export type PreviewResult = {
	svg: SVGSVGElement
	mode: PreviewMode
	pageId: string
	width: number
	height: number
	viewBox: string
	resolutionReduced: boolean
}

export type WriteResult =
	| { kind: 'written'; fileName: string; contentHash: string }
	| { kind: 'download-started'; fileName: string }
	| { kind: 'cancelled' }

export type DocumentSession = {
	documentEpoch: number
	documentRevision: number
	savedRevision: number | null
	lastDownloadedRevision: number | null
	isSaving: boolean
	isLoading: boolean
}

export type FileBinding = {
	fileName: string
	handle: FileSystemFileHandle | null
	contentHash: string | null
}

export type AppUiState = {
	fileName: string
	dirty: boolean
	busy: boolean
	status: string
	error: string | null
	locked: boolean
}

export type UnsavedChoice = 'save' | 'discard' | 'cancel'
export type ExternalChangeChoice = 'save-as' | 'cancel'
export type RecoveryChoice = 'restore' | 'discard'

export type AppDialog =
	| { id: string; kind: 'unsaved'; message: string }
	| { id: string; kind: 'external-change'; message: string }
	| { id: string; kind: 'recovery'; message: string }
	| { id: string; kind: 'notice'; title: string; message: string; confirmLabel?: string }
