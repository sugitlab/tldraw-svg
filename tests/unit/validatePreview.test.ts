import { describe, expect, it } from 'vitest'
import { SVG_NS } from '@/config/app'
import { previewNeedsRaster, validatePreviewSvg } from '@/export/validatePreview'

describe('validatePreview', () => {
	it('allows a self-contained vector preview', () => {
		const svg = document.createElementNS(SVG_NS, 'svg')
		const rect = document.createElementNS(SVG_NS, 'rect')
		rect.setAttribute('id', 'box')
		rect.setAttribute('width', '10')
		rect.setAttribute('height', '10')
		svg.appendChild(rect)
		expect(() => validatePreviewSvg(svg)).not.toThrow()
		expect(previewNeedsRaster(svg)).toBe(false)
	})

	it('flags foreignObject and text for raster fallback', () => {
		const svg = document.createElementNS(SVG_NS, 'svg')
		const foreign = document.createElementNS(SVG_NS, 'foreignObject')
		svg.appendChild(foreign)
		expect(previewNeedsRaster(svg)).toBe(true)
		expect(() => validatePreviewSvg(svg)).toThrow()
	})

	it('rejects scripts and external hrefs', () => {
		const svg = document.createElementNS(SVG_NS, 'svg')
		const image = document.createElementNS(SVG_NS, 'image')
		image.setAttribute('href', 'https://example.com/x.png')
		svg.appendChild(image)
		expect(() => validatePreviewSvg(svg)).toThrow(/外部参照/)
	})
})
