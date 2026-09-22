import {
	createTLStore,
	getSnapshot,
	loadSnapshot,
	type Editor,
	type TLStore,
} from 'tldraw'
import { localAssetStore } from '@/assets/localAssetStore'
import { errorFor } from '@/config/messages'
import type { DocumentSnapshot, PortableDocument } from '@/document/types'

export function createAppStore(snapshot?: PortableDocument): TLStore {
	const store = createTLStore({
		assets: localAssetStore,
		...(snapshot ? { snapshot: { document: snapshot } } : {}),
	})
	if (!snapshot) ensureStoreUsable(store)
	return store
}

function ensureStoreUsable(store: TLStore): void {
	const candidate = store as TLStore & { ensureStoreIsUsable?: () => void }
	candidate.ensureStoreIsUsable?.()
}

export function getDocumentSnapshot(editor: Editor): DocumentSnapshot {
	try {
		return getSnapshot(editor.store).document
	} catch {
		return editor.store.getStoreSnapshot()
	}
}

export function loadDocumentIntoStore(store: TLStore, document: DocumentSnapshot): void {
	try {
		loadSnapshot(store, { document })
	} catch {
		throw errorFor('UNSUPPORTED_SCHEMA')
	}
}

export function listenDocumentChanges(store: TLStore, onChange: () => void): () => void {
	return store.listen(() => onChange(), { scope: 'document' })
}

export function focusPreviewPage(editor: Editor, pageId: string): void {
	const page = editor.getPage(pageId as never)
	if (!page) {
		throw errorFor('INVALID_PAYLOAD', 'preview.pageIdが文書内に存在しません。')
	}
	editor.setCurrentPage(pageId as never)
	const bounds = editor.getCurrentPageBounds()
	if (bounds && bounds.width > 0 && bounds.height > 0) {
		editor.zoomToFit({ animation: { duration: 0 } })
	}
}

export function getPreviewPageId(editor: Editor): string {
	return editor.getCurrentPageId()
}

export function isStoreReadyForSnapshot(store: TLStore): boolean {
	try {
		getSnapshot(store)
		return true
	} catch {
		return false
	}
}
