import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPayloadFromXml } from '@/format/svgCodec'

const basicPath = resolve(process.cwd(), 'examples/basic.tldraw.svg')
const emptyPath = resolve(process.cwd(), 'examples/empty.tldraw.svg')
const imagesPath = resolve(process.cwd(), 'examples/images-and-pages.tldraw.svg')

function storeRecords(xml: string, name: string) {
	const payload = extractPayloadFromXml(xml, name)
	return Object.values(payload.document.store) as Array<{ typeName: string; type?: string }>
}

describe('example visual compatibility', () => {
	it.skipIf(!existsSync(basicPath))('V05: metadata-stripped file is no longer editable', () => {
		const xml = readFileSync(basicPath, 'utf8')
		expect(() => extractPayloadFromXml(xml, 'basic.tldraw.svg')).not.toThrow()
		const stripped = xml.replace(/<metadata[\s\S]*?<\/metadata>/i, '')
		expect(() => extractPayloadFromXml(stripped, 'basic.tldraw.svg')).toThrow(/読み取れません/)
	})

	it.skipIf(!existsSync(basicPath))('V01: basic example keeps vector preview markup', () => {
		const xml = readFileSync(basicPath, 'utf8')
		const payload = extractPayloadFromXml(xml, 'basic.tldraw.svg')
		expect(payload.preview.mode).toBe('svg')
		const preview = xml.replace(/<metadata[\s\S]*?<\/metadata>/i, '')
		expect(preview).toMatch(/<(path|rect|ellipse|polygon)\b/)
		expect(preview).not.toContain('<image')
	})

	it.skipIf(!existsSync(basicPath))('V04: preview markup does not need external resources', () => {
		const xml = readFileSync(basicPath, 'utf8')
		expect(xml).toContain('urn:tldraw-svg:document:1')
		const preview = xml.replace(/<metadata[\s\S]*?<\/metadata>/i, '')
		expect(preview).not.toMatch(/(?:href|src|xlink:href)="https?:\/\//)
		expect(preview).not.toMatch(/url\(https?:\/\//)
		expect(preview).toContain('id="tldraw-preview"')
	})

	it.skipIf(!existsSync(emptyPath))('D07: empty example has one page and no shapes', () => {
		const xml = readFileSync(emptyPath, 'utf8')
		const records = storeRecords(xml, 'empty.tldraw.svg')
		expect(records.filter((record) => record.typeName === 'page')).toHaveLength(1)
		expect(records.filter((record) => record.typeName === 'shape')).toHaveLength(0)
		expect(records.filter((record) => record.typeName === 'asset')).toHaveLength(0)
	})

	it.skipIf(!existsSync(imagesPath))('D05/D06: images example keeps crop and multiple pages', () => {
		const xml = readFileSync(imagesPath, 'utf8')
		const records = storeRecords(xml, 'images-and-pages.tldraw.svg')
		expect(records.filter((record) => record.typeName === 'page').length).toBeGreaterThanOrEqual(2)
		expect(records.some((record) => record.typeName === 'shape' && record.type === 'image')).toBe(true)
		expect(xml).toContain('data:image/png;base64,')
		expect(xml).toContain('topLeft')
	})
})
