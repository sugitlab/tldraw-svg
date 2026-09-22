import { createTLStore } from 'tldraw'
import { describe, expect, it } from 'vitest'
import { assertPayload, createPayload } from '@/format/payload'

describe('payload', () => {
	it('creates and accepts a v1 payload from an SDK snapshot', () => {
		const store = createTLStore()
		;(store as { ensureStoreIsUsable?: () => void }).ensureStoreIsUsable?.()
		const document = store.getStoreSnapshot()
		const page = store.allRecords().find((record) => record.typeName === 'page')
		store.dispose()
		const payload = createPayload({
			document,
			pageId: page?.id ?? 'page:page',
			mode: 'svg',
		})
		expect(assertPayload(payload).formatVersion).toBe(1)
	})

	it('rejects a payload that includes session state', () => {
		expect(() =>
			assertPayload({
				format: 'tldraw-svg',
				formatVersion: 1,
				session: { camera: {} },
				producer: { app: 'x', appVersion: '1', tldrawVersion: '5' },
				preview: { pageId: 'page:1', background: '#ffffff', padding: 32, mode: 'svg' },
				document: { store: {}, schema: {} },
			})
		).toThrow(/session/)
	})
})
