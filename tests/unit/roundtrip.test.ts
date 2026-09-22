import { createTLStore, loadSnapshot } from 'tldraw'
import { describe, expect, it } from 'vitest'
import { PREVIEW_BACKGROUND, SVG_NS } from '@/config/app'
import type { PreviewResult } from '@/document/types'
import { jsonEqual } from '@/format/compare'
import { createPayload } from '@/format/payload'
import { encodeEditableSvg, extractPayloadFromXml } from '@/format/svgCodec'
import { validateDocumentSnapshot } from '@/format/validateDocument'

function preview(pageId: string): PreviewResult {
	const svg = document.createElementNS(SVG_NS, 'svg')
	svg.setAttribute('width', '800')
	svg.setAttribute('height', '600')
	svg.setAttribute('viewBox', '0 0 800 600')
	const rect = document.createElementNS(SVG_NS, 'rect')
	rect.setAttribute('width', '800')
	rect.setAttribute('height', '600')
	rect.setAttribute('fill', PREVIEW_BACKGROUND)
	svg.appendChild(rect)
	return {
		svg,
		mode: 'svg',
		pageId,
		width: 800,
		height: 600,
		viewBox: '0 0 800 600',
		resolutionReduced: false,
	}
}

describe('save/load reversibility (D01, D07, D08)', () => {
	it('keeps an SDK document identical across five encode/decode cycles', async () => {
		const origin = createTLStore()
		;(origin as { ensureStoreIsUsable?: () => void }).ensureStoreIsUsable?.()
		let document = origin.getStoreSnapshot()
		const page = origin.allRecords().find((record) => record.typeName === 'page')
		origin.dispose()
		const pageId = page?.id ?? 'page:page'

		for (let i = 0; i < 5; i += 1) {
			const payload = createPayload({ document, pageId, mode: 'svg' })
			const blob = encodeEditableSvg(preview(pageId), payload)
			const xml = await blob.text()
			const extracted = extractPayloadFromXml(xml, 'cycle.tldraw.svg')
			await validateDocumentSnapshot(extracted.document, { previewPageId: extracted.preview.pageId })
			const next = createTLStore()
			loadSnapshot(next, { document: extracted.document })
			const migrated = next.getStoreSnapshot()
			next.dispose()
			expect(jsonEqual(migrated.store, extracted.document.store)).toBe(true)
			document = migrated
		}
	})
})
