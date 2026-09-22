import { errorFor } from '@/config/messages'
import type { DocumentSnapshot, PortableDocument } from '@/document/types'
import { blobToDataUrl, decodeAndValidateImage } from '@/assets/imageValidation'

type AssetRecord = {
	id?: string
	typeName?: string
	type?: string
	props?: {
		src?: string | null
		mimeType?: string | null
		isAnimated?: boolean
		fileSize?: number
		w?: number
		h?: number
	}
}

export async function makePortable(
	snapshot: DocumentSnapshot,
	signal?: AbortSignal
): Promise<PortableDocument> {
	const cloned = structuredClone(snapshot) as DocumentSnapshot & {
		store: Record<string, AssetRecord>
	}
	for (const record of Object.values(cloned.store)) {
		assertNotAborted(signal)
		if (record.typeName !== 'asset') continue
		if (record.type !== 'image') {
			throw errorFor('UNSUPPORTED_CONTENT', `未対応のアセット: ${record.type ?? 'unknown'}`)
		}
		const src = record.props?.src
		if (!src) {
			throw errorFor('ASSET_UNAVAILABLE', '未完了または欠損した画像があります。')
		}
		if (/^https?:\/\//i.test(src)) {
			throw errorFor('ASSET_UNAVAILABLE', '外部URLの画像は取り込み直してください。')
		}

		let dataUrl = src
		if (src.startsWith('blob:')) {
			const blob = await fetchBlob(src, signal)
			dataUrl = await blobToDataUrl(blob)
		} else if (!src.startsWith('data:')) {
			throw errorFor('ASSET_UNAVAILABLE', '解決できない画像参照があります。')
		}

		const validated = await decodeAndValidateImage(dataUrl)
		if (!record.props) record.props = {}
		record.props.src = validated.dataUrl
		record.props.mimeType = validated.mimeType
		record.props.isAnimated = false
		record.props.fileSize = validated.byteLength
		if (!record.props.w) record.props.w = validated.width
		if (!record.props.h) record.props.h = validated.height
	}
	return cloned
}

async function fetchBlob(src: string, signal?: AbortSignal): Promise<Blob> {
	try {
		const response = await fetch(src, { signal })
		if (!response.ok) throw new Error('fetch failed')
		return await response.blob()
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') throw error
		throw errorFor('ASSET_UNAVAILABLE', '一時参照の画像を解決できません。')
	}
}

function assertNotAborted(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new DOMException('Aborted', 'AbortError')
	}
}
