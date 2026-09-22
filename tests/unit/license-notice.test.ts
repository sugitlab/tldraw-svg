import { afterEach, describe, expect, it, vi } from 'vitest'
import { needsProductionLicenseNotice } from '@/config/assets'

describe('needsProductionLicenseNotice', () => {
	afterEach(() => {
		vi.unstubAllEnvs()
		vi.unstubAllGlobals()
	})

	it('is false on localhost without a key', () => {
		expect(needsProductionLicenseNotice()).toBe(false)
	})

	it('is true on public https without a key', () => {
		vi.stubEnv('VITE_TLDRAW_LICENSE_KEY', '')
		vi.stubGlobal('window', {
			location: { protocol: 'https:', hostname: 'sugitlab.github.io' },
		})
		expect(needsProductionLicenseNotice()).toBe(true)
	})

	it('is false on public https when a key is set', () => {
		vi.stubEnv('VITE_TLDRAW_LICENSE_KEY', 'tldraw-test-key')
		vi.stubGlobal('window', {
			location: { protocol: 'https:', hostname: 'sugitlab.github.io' },
		})
		expect(needsProductionLicenseNotice()).toBe(false)
	})
})
