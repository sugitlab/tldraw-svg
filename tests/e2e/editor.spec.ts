import { expect, test } from '@playwright/test'

test.describe('tldraw-svg editor', () => {
	test('starts and exposes the editor API', async ({ page }) => {
		await page.goto('/')
		await page.waitForFunction(() => window.__tldrawSvg?.ready === true, null, { timeout: 60_000 })
		await expect(page.getByTestId('file-name')).toHaveText('untitled.tldraw.svg')
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
			await window.__tldrawSvg!.createDemo('empty')
		})
		const xml = await page.evaluate(async () => window.__tldrawSvg!.encodeCurrent())
		expect(xml).toContain('width="800"')
		await page.evaluate(async (text) => {
			await window.__tldrawSvg!.openSvgText(text)
		}, xml)
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
		expect(after).toContain('Start')
		expect(before).toContain('Start')
	})
})
