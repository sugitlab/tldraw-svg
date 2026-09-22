import {
	APP_NAME,
	APP_VERSION,
	FORMAT_NAME,
	FORMAT_VERSION,
	PREVIEW_BACKGROUND,
	PREVIEW_PADDING,
	TLDRAW_VERSION,
} from '@/config/app'
import { LIMITS } from '@/config/limits'
import { errorFor } from '@/config/messages'
import { maxJsonDepth } from '@/format/compare'
import type { DocumentSnapshot, PreviewMode, TldrawSvgPayloadV1 } from '@/document/types'

export function createPayload(input: {
	document: DocumentSnapshot
	pageId: string
	mode: PreviewMode
}): TldrawSvgPayloadV1 {
	return {
		format: FORMAT_NAME,
		formatVersion: FORMAT_VERSION,
		producer: {
			app: APP_NAME,
			appVersion: APP_VERSION,
			tldrawVersion: TLDRAW_VERSION,
		},
		preview: {
			pageId: input.pageId,
			background: PREVIEW_BACKGROUND,
			padding: PREVIEW_PADDING,
			mode: input.mode,
		},
		document: input.document,
	}
}

export function parsePayloadJson(raw: string): TldrawSvgPayloadV1 {
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		throw errorFor('INVALID_PAYLOAD', 'JSONを解析できません。')
	}
	return assertPayload(parsed)
}

export function assertPayload(value: unknown): TldrawSvgPayloadV1 {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw errorFor('INVALID_PAYLOAD', 'payloadがオブジェクトではありません。')
	}
	if (maxJsonDepth(value) > LIMITS.MAX_NESTING_DEPTH) {
		throw errorFor('INVALID_PAYLOAD', 'JSONの入れ子が深すぎます。')
	}

	const record = value as Record<string, unknown>
	if (record.format !== FORMAT_NAME) {
		throw errorFor('INVALID_PAYLOAD', 'formatがtldraw-svgではありません。')
	}
	if (typeof record.formatVersion !== 'number') {
		throw errorFor('INVALID_PAYLOAD', 'formatVersionがありません。')
	}
	if (record.formatVersion !== FORMAT_VERSION) {
		throw errorFor('UNSUPPORTED_FORMAT_VERSION', `必要な形式は ${FORMAT_VERSION} です。`)
	}
	if ('session' in record) {
		throw errorFor('INVALID_PAYLOAD', 'sessionを含めることはできません。')
	}

	const producer = record.producer
	if (!producer || typeof producer !== 'object' || Array.isArray(producer)) {
		throw errorFor('INVALID_PAYLOAD', 'producerが不正です。')
	}
	const producerRecord = producer as Record<string, unknown>
	if (
		typeof producerRecord.app !== 'string' ||
		typeof producerRecord.appVersion !== 'string' ||
		typeof producerRecord.tldrawVersion !== 'string'
	) {
		throw errorFor('INVALID_PAYLOAD', 'producerの必須項目がありません。')
	}

	const preview = record.preview
	if (!preview || typeof preview !== 'object' || Array.isArray(preview)) {
		throw errorFor('INVALID_PAYLOAD', 'previewが不正です。')
	}
	const previewRecord = preview as Record<string, unknown>
	if (typeof previewRecord.pageId !== 'string' || previewRecord.pageId.length === 0) {
		throw errorFor('INVALID_PAYLOAD', 'preview.pageIdがありません。')
	}
	if (previewRecord.background !== PREVIEW_BACKGROUND) {
		throw errorFor('INVALID_PAYLOAD', 'preview.backgroundは#ffffffである必要があります。')
	}
	if (previewRecord.padding !== PREVIEW_PADDING) {
		throw errorFor('INVALID_PAYLOAD', 'preview.paddingは32である必要があります。')
	}
	if (previewRecord.mode !== 'svg' && previewRecord.mode !== 'raster') {
		throw errorFor('INVALID_PAYLOAD', 'preview.modeが不正です。')
	}

	const document = record.document
	if (!document || typeof document !== 'object' || Array.isArray(document)) {
		throw errorFor('INVALID_PAYLOAD', 'documentがありません。')
	}
	const documentRecord = document as Record<string, unknown>
	if (!documentRecord.store || typeof documentRecord.store !== 'object') {
		throw errorFor('INVALID_PAYLOAD', 'document.storeがありません。')
	}
	if (!documentRecord.schema || typeof documentRecord.schema !== 'object') {
		throw errorFor('INVALID_PAYLOAD', 'document.schemaがありません。')
	}

	return {
		format: FORMAT_NAME,
		formatVersion: FORMAT_VERSION,
		producer: {
			app: producerRecord.app,
			appVersion: producerRecord.appVersion,
			tldrawVersion: producerRecord.tldrawVersion,
		},
		preview: {
			pageId: previewRecord.pageId,
			background: PREVIEW_BACKGROUND,
			padding: PREVIEW_PADDING,
			mode: previewRecord.mode,
		},
		document: document as DocumentSnapshot,
	}
}
