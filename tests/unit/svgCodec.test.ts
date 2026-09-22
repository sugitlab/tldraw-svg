import { createTLStore } from 'tldraw'
import { describe, expect, it } from 'vitest'
import { PREVIEW_BACKGROUND, SVG_NS } from '@/config/app'
import type { PreviewResult } from '@/document/types'
import { jsonEqual } from '@/format/compare'
import { createPayload } from '@/format/payload'
import { encodeEditableSvg, extractPayloadFromXml, parseSvgDocument } from '@/format/svgCodec'

function emptyPreview(pageId: string): PreviewResult {
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

function emptyPayload() {
	const store = createTLStore()
	;(store as { ensureStoreIsUsable?: () => void }).ensureStoreIsUsable?.()
	const document = store.getStoreSnapshot()
	const page = store.allRecords().find((record) => record.typeName === 'page')
	store.dispose()
	return createPayload({
		document,
		pageId: page?.id ?? 'page:page',
		mode: 'svg',
	})
}

describe('svgCodec', () => {
	it('round-trips a real SDK snapshot and special characters (D02, D07)', async () => {
		const payload = emptyPayload()
		payload.producer.appVersion = '日本語 絵文字🙂 改行\n& < > </metadata> ]]>'
		const blob = encodeEditableSvg(emptyPreview(payload.preview.pageId), payload)
		const xml = await blob.text()
		expect(xml.startsWith('<?xml')).toBe(true)
		expect(xml).toContain('urn:tldraw-svg:document:1')
		const extracted = extractPayloadFromXml(xml, 'sample.tldraw.svg')
		expect(extracted.producer.appVersion).toBe(payload.producer.appVersion)
		expect(jsonEqual(extracted, payload)).toBe(true)
		expect(jsonEqual(extracted.document, payload.document)).toBe(true)
	})

	it('classifies missing metadata by file name (F01)', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
		expect(() => extractPayloadFromXml(svg, 'plain.svg')).toThrow(/編集データがありません/)
		expect(() => extractPayloadFromXml(svg, 'broken.tldraw.svg')).toThrow(/読み取れません/)
	})

	it('rejects duplicate metadata and invalid XML (F01)', () => {
		expect(() => extractPayloadFromXml('<not-svg>', 'plain.svg')).toThrow()
		const duplicated = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:td="urn:tldraw-svg:document:1">
  <metadata id="tldraw-document"><td:document encoding="json" version="1">{}</td:document></metadata>
  <metadata id="tldraw-document"><td:document encoding="json" version="1">{}</td:document></metadata>
</svg>`
		expect(() => extractPayloadFromXml(duplicated, 'dup.svg')).toThrow(/読み取れません/)
	})

	it('rejects DOCTYPE (F04)', () => {
		const xml =
			'<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"></svg>'
		expect(() => extractPayloadFromXml(xml, 'xxe.svg')).toThrow()
	})

	it('rejects unsupported format versions (F02)', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:td="urn:tldraw-svg:document:1">
  <metadata id="tldraw-document"><td:document encoding="json" version="2">{"format":"tldraw-svg","formatVersion":2}</td:document></metadata>
</svg>`
		expect(() => extractPayloadFromXml(xml, 'future.svg')).toThrow(/形式バージョン/)
	})

	it('keeps preview markup', async () => {
		const payload = emptyPayload()
		const blob = encodeEditableSvg(emptyPreview(payload.preview.pageId), payload)
		const xml = await blob.text()
		const doc = parseSvgDocument(xml)
		expect(doc.querySelector('#tldraw-preview')).not.toBeNull()
		expect(doc.querySelector('rect')).not.toBeNull()
	})
})
