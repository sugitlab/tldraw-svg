import { expect, test, type Page } from '@playwright/test'

async function waitReady(page: Page) {
	await page.waitForFunction(() => window.__tldrawSvg?.ready === true, null, { timeout: 60_000 })
}

async function openSvgText(page: Page, text: string) {
	const pending = page.evaluate((xml) => window.__tldrawSvg!.openSvgText(xml), text)
	await page.getByRole('button', { name: '破棄' }).click({ timeout: 20_000 })
	await pending
}

test.describe('tldraw-svg editor', () => {
	test('starts and exposes the editor API', async ({ page }) => {
		await page.goto('/')
		await waitReady(page)
		await expect(page.getByTestId('file-name')).toHaveText('untitled.tldraw.svg')
		await expect(page.getByTestId('license-banner')).toHaveCount(0)
	})

	test('D01/D03/D06: create, save, reload, and keep pages', async ({ page }) => {
		await page.goto('/')
		await waitReady(page)
		await page.evaluate(async () => {
			await window.__tldrawSvg!.createDemo('basic')
		})
		const xml = await page.evaluate(async () => window.__tldrawSvg!.encodeCurrent())
		expect(xml).toContain('urn:tldraw-svg:document:1')
		expect(xml).toContain('tldraw-preview')

		await openSvgText(page, xml)
		await waitReady(page)
		const dirty = await page.evaluate(() => window.__tldrawSvg!.isDirty())
		expect(dirty).toBe(false)
	})

	test('D07: empty document encode/open', async ({ page }) => {
		await page.goto('/')
		await waitReady(page)
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
		await openSvgText(page, xml)
	})

	test('D05: inserting a PNG keeps the bytes after encode/open', async ({ page }) => {
		await page.goto('/')
		await waitReady(page)
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
		await openSvgText(page, xml)
		expect(await page.evaluate(() => window.__tldrawSvg!.getDocumentStats())).toMatchObject({
			shapes: 1,
			assets: 1,
		})
	})

	test('drawing does not remount the editor', async ({ page }) => {
		await page.goto('/')
		await waitReady(page)
		const startMount = await page.evaluate(() => window.__tldrawSvg!.mountCount)
		const startShapes = await page.evaluate(() => window.__tldrawSvg!.getDocumentStats().shapes)

		const canvas = page.locator('.tl-canvas')
		await canvas.click({ position: { x: 120, y: 120 } })
		await page.keyboard.press('r')
		const box = await canvas.boundingBox()
		if (!box) throw new Error('canvas bounding box missing')
		await page.mouse.move(box.x + 220, box.y + 160)
		await page.mouse.down()
		await page.mouse.move(box.x + 400, box.y + 300, { steps: 16 })
		await page.mouse.up()

		expect(await page.evaluate(() => window.__tldrawSvg?.ready)).toBe(true)
		expect(await page.evaluate(() => window.__tldrawSvg!.mountCount)).toBe(startMount)
		expect(await page.evaluate(() => window.__tldrawSvg!.isDirty())).toBe(true)
		expect(await page.evaluate(() => window.__tldrawSvg!.getDocumentStats().shapes)).toBeGreaterThan(
			startShapes
		)
		await expect(page.getByTestId('dirty-state')).toHaveText('未保存')
	})

	test('F01: broken file does not replace the current document', async ({ page }) => {
		await page.goto('/')
		await waitReady(page)
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
