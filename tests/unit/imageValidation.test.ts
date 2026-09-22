import { describe, expect, it } from 'vitest'
import { dataUrlByteLength, decodeAndValidateImage, detectImageType } from '@/assets/imageValidation'

const PNG_1X1 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('imageValidation', () => {
	it('accepts a real PNG data URL', async () => {
		const dataUrl = `data:image/png;base64,${PNG_1X1}`
		const result = await decodeAndValidateImage(dataUrl)
		expect(result.mimeType).toBe('image/png')
		expect(result.byteLength).toBe(dataUrlByteLength(dataUrl))
		expect(result.width).toBeGreaterThan(0)
	})

	it('rejects a disguised non-image (F03)', async () => {
		const fake = `data:image/png;base64,${btoa('not-an-image')}`
		await expect(decodeAndValidateImage(fake)).rejects.toThrow()
	})

	it('detects PNG magic bytes', () => {
		const bytes = Uint8Array.from(atob(PNG_1X1), (char) => char.charCodeAt(0))
		expect(detectImageType(bytes)).toBe('image/png')
	})
})
