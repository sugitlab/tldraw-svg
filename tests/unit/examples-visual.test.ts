import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractPayloadFromXml } from '@/format/svgCodec'

const basicPath = resolve(process.cwd(), 'examples/basic.tldraw.svg')

describe('example visual compatibility', () => {
	it.skipIf(!existsSync(basicPath))('V05: metadata-stripped file is no longer editable', () => {
		const xml = readFileSync(basicPath, 'utf8')
		expect(() => extractPayloadFromXml(xml, 'basic.tldraw.svg')).not.toThrow()
		const stripped = xml.replace(/<metadata[\s\S]*?<\/metadata>/i, '')
		expect(() => extractPayloadFromXml(stripped, 'basic.tldraw.svg')).toThrow(/読み取れません/)
	})

	it.skipIf(!existsSync(basicPath))('V04: example files do not reference external resources', () => {
		const xml = readFileSync(basicPath, 'utf8')
		expect(xml).not.toMatch(/https?:\/\//)
		expect(xml).toContain('urn:tldraw-svg:document:1')
	})
})
