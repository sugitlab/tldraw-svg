import { describe, expect, it } from 'vitest'
import { looksLikeDedicatedName, normalizeSaveName, previewExportName } from '@/format/filename'

describe('filename', () => {
	it('normalizes save names once', () => {
		expect(normalizeSaveName('sample')).toBe('sample.tldraw.svg')
		expect(normalizeSaveName('sample.svg')).toBe('sample.tldraw.svg')
		expect(normalizeSaveName('sample.tldraw.svg')).toBe('sample.tldraw.svg')
	})

	it('detects dedicated names and preview export names', () => {
		expect(looksLikeDedicatedName('notes.tldraw.svg')).toBe(true)
		expect(looksLikeDedicatedName('notes.svg')).toBe(false)
		expect(previewExportName('notes.tldraw.svg')).toBe('notes.svg')
	})
})
