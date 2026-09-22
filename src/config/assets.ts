import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite'
import { ACCEPTED_IMAGE_MIME_TYPES } from '@/config/app'
import { LIMITS } from '@/config/limits'

export const assetUrls = getAssetUrlsByImport()

export const acceptedImageMimeTypes = [...ACCEPTED_IMAGE_MIME_TYPES]
export const acceptedVideoMimeTypes: string[] = []

export const editorMediaLimits = {
	maxAssetSize: LIMITS.IMAGE_BYTES,
	maxImageDimension: Math.sqrt(LIMITS.IMAGE_PIXELS),
	acceptedImageMimeTypes,
	acceptedVideoMimeTypes,
}

export function licenseKey(): string | undefined {
	const value = import.meta.env.VITE_TLDRAW_LICENSE_KEY
	return value && value.length > 0 ? value : undefined
}

export function needsProductionLicenseNotice(): boolean {
	if (typeof window === 'undefined') return false
	if (licenseKey()) return false
	const { protocol, hostname } = window.location
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
	const loopback = host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host)
	return protocol === 'https:' && !loopback
}
