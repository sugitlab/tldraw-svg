import {
	ALLOWED_ASSET_TYPES,
	ALLOWED_BINDING_TYPES,
	ALLOWED_SHAPE_TYPES,
	UNSUPPORTED_SHAPE_TYPES,
} from '@/config/app'
import { LIMITS } from '@/config/limits'
import { errorFor } from '@/config/messages'
import type { DocumentSnapshot } from '@/document/types'
import { decodeAndValidateImage } from '@/assets/imageValidation'

type StoreRecord = {
	id?: string
	typeName?: string
	type?: string
	parentId?: string
	props?: Record<string, unknown>
	meta?: unknown
}

export async function validateDocumentSnapshot(
	document: DocumentSnapshot,
	options?: { previewPageId?: string }
): Promise<void> {
	const store = (document as { store?: Record<string, StoreRecord> }).store
	if (!store || typeof store !== 'object') {
		throw errorFor('INVALID_PAYLOAD', 'document.storeがありません。')
	}

	const records = Object.values(store)
	const pages = records.filter((record) => record.typeName === 'page')
	const shapes = records.filter((record) => record.typeName === 'shape')
	const assets = records.filter((record) => record.typeName === 'asset')
	const bindings = records.filter((record) => record.typeName === 'binding')

	if (pages.length === 0) {
		throw errorFor('INVALID_DOCUMENT_REFERENCES', 'ページがありません。')
	}
	if (pages.length > LIMITS.PAGE_COUNT) {
		throw errorFor('UNSUPPORTED_CONTENT', `ページ数が上限（${LIMITS.PAGE_COUNT}）を超えています。`)
	}
	if (shapes.length > LIMITS.SHAPE_COUNT) {
		throw errorFor('UNSUPPORTED_CONTENT', `図形数が上限（${LIMITS.SHAPE_COUNT}）を超えています。`)
	}

	const pageIds = new Set(pages.map((page) => page.id).filter((id): id is string => Boolean(id)))
	const shapeIds = new Set(shapes.map((shape) => shape.id).filter((id): id is string => Boolean(id)))
	const assetIds = new Set(assets.map((asset) => asset.id).filter((id): id is string => Boolean(id)))

	if (options?.previewPageId && !pageIds.has(options.previewPageId)) {
		throw errorFor('INVALID_PAYLOAD', 'preview.pageIdが文書内に存在しません。')
	}

	const unsupportedShapes = shapes.filter(
		(shape) => !ALLOWED_SHAPE_TYPES.includes(shape.type as (typeof ALLOWED_SHAPE_TYPES)[number])
	)
	if (unsupportedShapes.length > 0) {
		const kinds = [...new Set(unsupportedShapes.map((shape) => shape.type ?? 'unknown'))]
		const knownUnsupported = kinds.filter((kind) =>
			UNSUPPORTED_SHAPE_TYPES.includes(kind as (typeof UNSUPPORTED_SHAPE_TYPES)[number])
		)
		throw errorFor(
			'UNSUPPORTED_CONTENT',
			`未対応の図形: ${ (knownUnsupported.length > 0 ? knownUnsupported : kinds).join(', ') }`
		)
	}

	const unsupportedBindings = bindings.filter(
		(binding) => !ALLOWED_BINDING_TYPES.includes(binding.type as (typeof ALLOWED_BINDING_TYPES)[number])
	)
	if (unsupportedBindings.length > 0) {
		throw errorFor(
			'UNSUPPORTED_CONTENT',
			`未対応の接続: ${[...new Set(unsupportedBindings.map((binding) => binding.type ?? 'unknown'))].join(', ')}`
		)
	}

	const unsupportedAssets = assets.filter(
		(asset) => !ALLOWED_ASSET_TYPES.includes(asset.type as (typeof ALLOWED_ASSET_TYPES)[number])
	)
	if (unsupportedAssets.length > 0) {
		throw errorFor(
			'UNSUPPORTED_CONTENT',
			`未対応のアセット: ${[...new Set(unsupportedAssets.map((asset) => asset.type ?? 'unknown'))].join(', ')}`
		)
	}

	for (const shape of shapes) {
		if (!shape.parentId || (!pageIds.has(shape.parentId) && !shapeIds.has(shape.parentId))) {
			throw errorFor('INVALID_DOCUMENT_REFERENCES', '図形の親参照が不正です。')
		}
		const assetId = shape.props?.assetId
		if (typeof assetId === 'string' && !assetIds.has(assetId)) {
			throw errorFor('INVALID_DOCUMENT_REFERENCES', '図形が存在しない画像を参照しています。')
		}
	}

	for (const binding of bindings) {
		const fromId = binding.props?.fromId
		const toId = binding.props?.toId
		if (typeof fromId === 'string' && !shapeIds.has(fromId)) {
			throw errorFor('INVALID_DOCUMENT_REFERENCES', '矢印の接続先が不正です。')
		}
		if (typeof toId === 'string' && !shapeIds.has(toId)) {
			throw errorFor('INVALID_DOCUMENT_REFERENCES', '矢印の接続先が不正です。')
		}
	}

	let totalImageBytes = 0
	for (const asset of assets) {
		if (asset.type !== 'image') continue
		const src = typeof asset.props?.src === 'string' ? asset.props.src : null
		if (!src) {
			throw errorFor('ASSET_UNAVAILABLE', '画像の実データがありません。')
		}
		if (/^https?:\/\//i.test(src) || src.startsWith('blob:')) {
			throw errorFor('ASSET_UNAVAILABLE', '外部URLや一時参照の画像は保存できません。')
		}
		if (!src.startsWith('data:')) {
			throw errorFor('INVALID_ASSET', '画像はdata URLである必要があります。')
		}
		const validated = await decodeAndValidateImage(src)
		totalImageBytes += validated.byteLength
	}

	if (totalImageBytes > LIMITS.IMAGE_BYTES_TOTAL) {
		throw errorFor('INVALID_ASSET', '文書内の画像合計サイズが上限を超えています。')
	}
}
