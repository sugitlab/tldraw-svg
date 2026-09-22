import { createTLStore } from 'tldraw'
import { describe, expect, it } from 'vitest'
import { validateDocumentSnapshot } from '@/format/validateDocument'

describe('validateDocument', () => {
	it('accepts an empty SDK document (D07)', async () => {
		const store = createTLStore()
		;(store as { ensureStoreIsUsable?: () => void }).ensureStoreIsUsable?.()
		const document = store.getStoreSnapshot()
		const page = store.allRecords().find((record) => record.typeName === 'page')
		store.dispose()
		await expect(
			validateDocumentSnapshot(document, { previewPageId: page?.id })
		).resolves.toBeUndefined()
	})

	it('rejects a missing preview page id', async () => {
		const store = createTLStore()
		;(store as { ensureStoreIsUsable?: () => void }).ensureStoreIsUsable?.()
		const document = store.getStoreSnapshot()
		store.dispose()
		await expect(validateDocumentSnapshot(document, { previewPageId: 'page:missing' })).rejects.toThrow(
			/preview.pageId/
		)
	})

	it('rejects unsupported shapes without dropping them (F02)', async () => {
		const store = createTLStore()
		;(store as { ensureStoreIsUsable?: () => void }).ensureStoreIsUsable?.()
		const document = store.getStoreSnapshot() as { store: Record<string, Record<string, unknown>> }
		const page = store.allRecords().find((record) => record.typeName === 'page')
		store.dispose()
		document.store['shape:video1'] = {
			id: 'shape:video1',
			typeName: 'shape',
			type: 'video',
			parentId: page?.id,
			x: 0,
			y: 0,
			rotation: 0,
			index: 'a1',
			opacity: 1,
			isLocked: false,
			meta: {},
			props: {},
		}
		await expect(validateDocumentSnapshot(document, { previewPageId: page?.id })).rejects.toThrow(/video/)
		expect(document.store['shape:video1']).toBeTruthy()
	})

	it('rejects external image URLs (F03)', async () => {
		const store = createTLStore()
		;(store as { ensureStoreIsUsable?: () => void }).ensureStoreIsUsable?.()
		const document = store.getStoreSnapshot() as { store: Record<string, Record<string, unknown>> }
		store.dispose()
		document.store['asset:remote'] = {
			id: 'asset:remote',
			typeName: 'asset',
			type: 'image',
			meta: {},
			props: {
				src: 'https://example.com/secret.png',
				mimeType: 'image/png',
				w: 10,
				h: 10,
				name: 'secret.png',
				isAnimated: false,
			},
		}
		await expect(validateDocumentSnapshot(document)).rejects.toThrow(/外部URL|画像/)
	})
})
