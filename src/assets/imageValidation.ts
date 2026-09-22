import { ACCEPTED_IMAGE_MIME_TYPES, type AcceptedImageMimeType } from '@/config/app'
import { LIMITS } from '@/config/limits'
import { errorFor } from '@/config/messages'

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]
const JPEG_MAGIC = [0xff, 0xd8, 0xff]
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50]

export type ValidatedImage = {
	mimeType: AcceptedImageMimeType
	byteLength: number
	width: number
	height: number
	dataUrl: string
	bytes: Uint8Array
}

export async function decodeAndValidateImage(source: string | Blob): Promise<ValidatedImage> {
	const { bytes, declaredMime, dataUrl } = await toBytes(source)
	if (bytes.byteLength > LIMITS.IMAGE_BYTES) {
		throw errorFor('INVALID_ASSET', '画像1件のサイズが8MiBを超えています。')
	}

	const detected = detectImageType(bytes)
	if (!detected) {
		throw errorFor('INVALID_ASSET', 'PNG / JPEG / 静止WebP以外の画像です。')
	}
	if (declaredMime && !mimeMatches(declaredMime, detected)) {
		throw errorFor('INVALID_ASSET', '画像の実体とMIME typeが一致しません。')
	}
	if (detected === 'image/webp' && isAnimatedWebp(bytes)) {
		throw errorFor('INVALID_ASSET', 'アニメーション画像は初版では扱えません。')
	}

	const size = await measureImage(dataUrl, bytes, detected)
	if (size.width * size.height > LIMITS.IMAGE_PIXELS) {
		throw errorFor('INVALID_ASSET', '画像の画素数が上限を超えています。')
	}

	return {
		mimeType: detected,
		byteLength: bytes.byteLength,
		width: size.width,
		height: size.height,
		dataUrl,
		bytes,
	}
}

export function detectImageType(bytes: Uint8Array): AcceptedImageMimeType | null {
	if (startsWith(bytes, PNG_MAGIC)) return 'image/png'
	if (startsWith(bytes, JPEG_MAGIC)) return 'image/jpeg'
	if (
		startsWith(bytes, RIFF_MAGIC) &&
		bytes.byteLength >= 12 &&
		bytes[8] === WEBP_MAGIC[0] &&
		bytes[9] === WEBP_MAGIC[1] &&
		bytes[10] === WEBP_MAGIC[2] &&
		bytes[11] === WEBP_MAGIC[3]
	) {
		return 'image/webp'
	}
	return null
}

export function isAnimatedWebp(bytes: Uint8Array): boolean {
	const marker = 'ANIM'
	for (let i = 12; i < bytes.byteLength - 4; i += 1) {
		if (
			bytes[i] === marker.charCodeAt(0) &&
			bytes[i + 1] === marker.charCodeAt(1) &&
			bytes[i + 2] === marker.charCodeAt(2) &&
			bytes[i + 3] === marker.charCodeAt(3)
		) {
			return true
		}
	}
	return false
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
	if (typeof FileReader !== 'undefined') {
		return await new Promise((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = () => resolve(String(reader.result))
			reader.onerror = () => reject(errorFor('INVALID_ASSET', '画像の読み込みに失敗しました。'))
			reader.readAsDataURL(blob)
		})
	}
	const buffer = new Uint8Array(await blob.arrayBuffer())
	const mime = blob.type || detectImageType(buffer) || 'application/octet-stream'
	return `data:${mime};base64,${bytesToBase64(buffer)}`
}

export function dataUrlByteLength(dataUrl: string): number {
	const comma = dataUrl.indexOf(',')
	if (comma < 0) return 0
	const base64 = dataUrl.slice(comma + 1)
	return Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
}

async function toBytes(source: string | Blob): Promise<{
	bytes: Uint8Array
	declaredMime: string | null
	dataUrl: string
}> {
	if (typeof source !== 'string') {
		const bytes = new Uint8Array(await source.arrayBuffer())
		const dataUrl = await blobToDataUrl(source)
		return { bytes, declaredMime: source.type || null, dataUrl }
	}
	if (!source.startsWith('data:')) {
		throw errorFor('INVALID_ASSET', 'data URLではありません。')
	}
	const comma = source.indexOf(',')
	if (comma < 0) throw errorFor('INVALID_ASSET', 'data URLが不正です。')
	const header = source.slice(5, comma)
	const mime = header.split(';')[0] || null
	const payload = source.slice(comma + 1)
	const binary = header.includes('base64') ? atob(payload) : decodeURIComponent(payload)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
	return { bytes, declaredMime: mime, dataUrl: source }
}

function mimeMatches(declared: string, detected: AcceptedImageMimeType): boolean {
	if (declared === detected) return true
	if (declared === 'image/jpg' && detected === 'image/jpeg') return true
	return ACCEPTED_IMAGE_MIME_TYPES.includes(declared as AcceptedImageMimeType) && declared === detected
}

async function measureImage(
	dataUrl: string,
	bytes: Uint8Array,
	mimeType: AcceptedImageMimeType
): Promise<{ width: number; height: number }> {
	const fromBytes = measureFromBytes(bytes, mimeType)
	if (fromBytes) return fromBytes
	if (typeof Image === 'function' && typeof window !== 'undefined') {
		return await new Promise((resolve, reject) => {
			const image = new Image()
			const timer = window.setTimeout(() => {
				reject(errorFor('INVALID_ASSET', '画像をデコードできません。'))
			}, 2000)
			image.onload = () => {
				window.clearTimeout(timer)
				resolve({ width: image.naturalWidth, height: image.naturalHeight })
			}
			image.onerror = () => {
				window.clearTimeout(timer)
				reject(errorFor('INVALID_ASSET', '画像をデコードできません。'))
			}
			image.src = dataUrl
		})
	}
	throw errorFor('INVALID_ASSET', '画像の寸法を確認できません。')
}

function measureFromBytes(
	bytes: Uint8Array,
	mimeType: AcceptedImageMimeType
): { width: number; height: number } | null {
	if (mimeType === 'image/png' && bytes.byteLength >= 24) {
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
		return { width: view.getUint32(16), height: view.getUint32(20) }
	}
	if (mimeType === 'image/jpeg') {
		return measureJpeg(bytes)
	}
	if (mimeType === 'image/webp' && bytes.byteLength >= 30) {
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
		if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58) {
			return { width: view.getUint32(24, true) + 1, height: view.getUint32(28, true) + 1 }
		}
		if (bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x20) {
			return {
				width: view.getUint16(26, true),
				height: view.getUint16(28, true),
			}
		}
	}
	return null
}

function measureJpeg(bytes: Uint8Array): { width: number; height: number } | null {
	let offset = 2
	while (offset < bytes.byteLength - 8) {
		if (bytes[offset] !== 0xff) break
		const marker = bytes[offset + 1]
		const length = (bytes[offset + 2] << 8) + bytes[offset + 3]
		if (marker >= 0xc0 && marker <= 0xc3) {
			return {
				height: (bytes[offset + 5] << 8) + bytes[offset + 6],
				width: (bytes[offset + 7] << 8) + bytes[offset + 8],
			}
		}
		offset += 2 + length
	}
	return null
}

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
	return magic.every((value, index) => bytes[index] === value)
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = ''
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary)
}
