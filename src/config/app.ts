export const APP_NAME = 'tldraw-svg'
export const APP_VERSION = '0.1.0'
export const TLDRAW_VERSION = '5.4.2'
export const DEFAULT_FILE_NAME = 'untitled.tldraw.svg'
export const PREVIEW_BACKGROUND = '#ffffff' as const
export const PREVIEW_PADDING = 32
export const RECOVERY_DEBOUNCE_MS = 1000
export const DOWNLOAD_REVOKE_DELAY_MS = 60_000

export const SVG_NS = 'http://www.w3.org/2000/svg'
export const DOCUMENT_NS = 'urn:tldraw-svg:document:1'
export const METADATA_ID = 'tldraw-document'
export const DOCUMENT_LOCAL_NAME = 'document'
export const PREVIEW_GROUP_ID = 'tldraw-preview'
export const PAYLOAD_ENCODING = 'json'
export const FORMAT_NAME = 'tldraw-svg'
export const FORMAT_VERSION = 1

export const ACCEPTED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export type AcceptedImageMimeType = (typeof ACCEPTED_IMAGE_MIME_TYPES)[number]

export const ALLOWED_SHAPE_TYPES = [
	'geo',
	'text',
	'note',
	'draw',
	'highlight',
	'line',
	'arrow',
	'group',
	'frame',
	'image',
] as const

export const UNSUPPORTED_SHAPE_TYPES = ['video', 'embed', 'bookmark'] as const
export const ALLOWED_BINDING_TYPES = ['arrow'] as const
export const ALLOWED_ASSET_TYPES = ['image'] as const
