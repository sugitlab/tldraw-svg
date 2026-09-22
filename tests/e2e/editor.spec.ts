import { expect, test } from '@playwright/test'

test.describe('tldraw-svg editor', () => {
	test('starts and exposes the editor API', async ({ page }) => {
		await page.goto('/')
		await page.waitForFunction(() => window.__tldrawSvg?.ready === true, null, { timeout: 60_000 })
		await expect(page.getByTestId('file-name')).toHaveText('untitled.tldraw.svg')
		await expect(page.getByTestId('license-banner')).toHaveCount(0)
	})

	test('D01/D03/D06: create, save, reload, and keep pages', async ({ page }) => {
		await page.goto('/')
		await page.waitForFunction(() => window.__tldrawSvg?.ready === true, null, { timeout: 60_000 })
		await page.evaluate(async () => {
			await window.__tldrawSvg!.createDemo('basic')
		})
		const xml = await page.evaluate(async () => window.__tldrawSvg!.encodeCurrent())
		expect(xml).toContain('urn:tldraw-svg:document:1')
		expect(xml).toContain('tldraw-preview')

		await page.evaluate(async (text) => {
			await window.__tldrawSvg!.openSvgText(text)
		}, xml)
		await page.waitForFunction(() => window.__tldrawSvg?.ready === true)
		const dirty = await page.evaluate(() => window.__tldrawSvg!.isDirty())
		expect(dirty).toBe(false)
	})

	test('D07: empty document encode/open', async ({ page }) => {
		await page.goto('/')
		await page.waitForFunction(() => window.__tldrawSvg?.ready === true, null, { timeout: 60_000 })
		await page.evaluate(async () => {
			await window.__tldrawSvg!.createDemo('images')
			await window.__tldrawSvg!.createDemo('empty')
		})
		const xml = await page.evaluate(async () => window.__tldrawSvg!.encodeCurrent())
		expect(xml).toContain('width="800"')
		expect(await page.evaluate(() => window.__tldrawSvg!.getDocumentStats())).toEqual({
			pages: 1,
			shapes: 0,
			assets: 0,
		})
		await page.evaluate(async (text) => {
			await window.__tldrawSvg!.openSvgText(text)
		}, xml)
	})

	test('D05: inserting a PNG keeps the bytes after encode/open', async ({ page }) => {
		await page.goto('/')
		await page.waitForFunction(() => window.__tldrawSvg?.ready === true, null, { timeout: 60_000 })
		const png =
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
		await page.evaluate(async (base64) => {
			await window.__tldrawSvg!.insertPng(base64)
		}, png)
		expect(await page.evaluate(() => window.__tldrawSvg!.getDocumentStats())).toMatchObject({
			shapes: 1,
			assets: 1,
		})
		const xml = await page.evaluate(async () => window.__tldrawSvg!.encodeCurrent())
		expect(xml).toContain('data:image/png;base64,')
		await page.evaluate(async (text) => {
			await window.__tldrawSvg!.openSvgText(text)
		}, xml)
		expect(await page.evaluate(() => window.__tldrawSvg!.getDocumentStats())).toMatchObject({
			shapes: 1,
			assets: 1,
		})
	})

	test('F01: broken file does not replace the current document', async ({ page }) => {
		await page.goto('/')
		await page.waitForFunction(() => window.__tldrawSvg?.ready === true, null, { timeout: 60_000 })
		await page.evaluate(async () => {
			await window.__tldrawSvg!.createDemo('basic')
		})
		const before = await page.evaluate(async () => window.__tldrawSvg!.encodeCurrent())
		await page.evaluate(async () => {
			try {
				await window.__tldrawSvg!.openSvgText('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
			} catch {
				// handled by controller
			}
		})
		await expect(page.getByTestId('status-error')).toBeVisible()
		const after = await page.evaluate(async () => window.__tldrawSvg!.encodeCurrent())
		expect(after).toContain('"geo":"ellipse"')
		expect(before).toContain('"geo":"ellipse"')
	})
})
