import { expect, test } from '@playwright/test'
import { Resvg } from '@resvg/resvg-js'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

test('generate example files from the running editor', async ({ page }) => {
	test.setTimeout(180_000)
	await page.goto('/')
	await page.waitForFunction(() => window.__tldrawSvg?.ready === true, null, { timeout: 60_000 })
	const outDir = path.resolve(process.cwd(), 'examples')
	await mkdir(outDir, { recursive: true })

	const kinds = [
		['basic', 'basic.tldraw.svg'],
		['japanese', 'japanese-notes.tldraw.svg'],
		['images', 'images-and-pages.tldraw.svg'],
		['empty', 'empty.tldraw.svg'],
	] as const

	let previewSource = ''
	for (const [kind, fileName] of kinds) {
		await page.evaluate(async (demoKind) => {
			await window.__tldrawSvg!.createDemo(demoKind)
		}, kind)
		const xml = await page.evaluate(async () => window.__tldrawSvg!.encodeCurrent())
		expect(xml).toContain('urn:tldraw-svg:document:1')
		if (kind === 'basic') {
			expect(xml).toContain('"mode":"svg"')
			expect(xml).toMatch(/<(path|rect|ellipse|g)\b/)
		}
		if (kind === 'empty') {
			const stats = await page.evaluate(() => window.__tldrawSvg!.getDocumentStats())
			expect(stats).toEqual({ pages: 1, shapes: 0, assets: 0 })
		}
		await writeFile(path.join(outDir, fileName), xml, 'utf8')
		if (kind === 'basic') previewSource = xml
	}

	expect(previewSource.length).toBeGreaterThan(100)
	const png = new Resvg(previewSource).render().asPng()
	await writeFile(path.join(outDir, 'preview.png'), png)
})
