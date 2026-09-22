import {
	DOCUMENT_LOCAL_NAME,
	DOCUMENT_NS,
	FORMAT_VERSION,
	METADATA_ID,
	PAYLOAD_ENCODING,
	PREVIEW_GROUP_ID,
	SVG_NS,
} from '@/config/app'
import { LIMITS } from '@/config/limits'
import { errorFor } from '@/config/messages'
import type { PreviewResult, TldrawSvgPayloadV1 } from '@/document/types'
import { jsonEqual, maxElementDepth } from '@/format/compare'
import { looksLikeDedicatedName } from '@/format/filename'
import { assertPayload, parsePayloadJson } from '@/format/payload'
import { validatePreviewSvg } from '@/export/validatePreview'

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>\n'

export function encodeEditableSvg(preview: PreviewResult, payload: TldrawSvgPayloadV1): Blob {
	const composed = composeEditableSvg(preview, payload)
	const xml = serializeSvg(composed)
	const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
	if (blob.size > LIMITS.FILE_SIZE_BYTES) {
		throw errorFor('FILE_TOO_LARGE')
	}

	const extracted = extractPayloadFromXml(xml, payload.producer.app)
	if (!jsonEqual(extracted, payload)) {
		throw errorFor('INVALID_PAYLOAD', '書き出したJSONが元のpayloadと一致しません。')
	}
	validatePreviewSvg(composed)
	return blob
}

export async function decodeEditableSvg(file: File, signal?: AbortSignal): Promise<TldrawSvgPayloadV1> {
	assertNotAborted(signal)
	if (file.size > LIMITS.FILE_SIZE_BYTES) {
		throw errorFor('FILE_TOO_LARGE')
	}
	const text = stripBom(await file.text())
	assertNotAborted(signal)
	return extractPayloadFromXml(text, file.name)
}

export function extractPayloadFromXml(xml: string, sourceName = ''): TldrawSvgPayloadV1 {
	if (hasDoctype(xml)) {
		throw errorFor('INVALID_XML', 'DOCTYPEは許可されていません。')
	}

	const parsed = parseSvgDocument(xml)
	const root = parsed.documentElement
	if (root.namespaceURI !== SVG_NS || root.localName !== 'svg') {
		throw errorFor('INVALID_XML', 'rootがSVGではありません。')
	}
	if (maxElementDepth(root) > LIMITS.MAX_NESTING_DEPTH) {
		throw errorFor('INVALID_XML', 'XMLの入れ子が深すぎます。')
	}

	const metadataMatches = Array.from(root.children).filter(
		(el) => el.namespaceURI === SVG_NS && el.localName === 'metadata' && el.id === METADATA_ID
	)
	if (metadataMatches.length > 1) {
		throw errorFor('AMBIGUOUS_METADATA')
	}
	if (metadataMatches.length === 0) {
		throw looksLikeDedicatedName(sourceName)
			? errorFor('AMBIGUOUS_METADATA')
			: errorFor('NOT_EDITABLE_SVG')
	}

	const metadata = metadataMatches[0]
	const documents = Array.from(metadata.children).filter(
		(el) => el.namespaceURI === DOCUMENT_NS && el.localName === DOCUMENT_LOCAL_NAME
	)
	if (documents.length !== 1) {
		throw errorFor('AMBIGUOUS_METADATA')
	}

	const documentEl = documents[0]
	if (documentEl.children.length > 0) {
		throw errorFor('AMBIGUOUS_METADATA', '編集データ要素に子要素があります。')
	}
	const encoding = documentEl.getAttribute('encoding')
	const version = documentEl.getAttribute('version')
	if (encoding !== PAYLOAD_ENCODING) {
		throw errorFor('INVALID_PAYLOAD', 'encodingがjsonではありません。')
	}
	if (version !== String(FORMAT_VERSION)) {
		if (version && /^\d+$/.test(version) && Number(version) !== FORMAT_VERSION) {
			throw errorFor('UNSUPPORTED_FORMAT_VERSION', `必要な形式は ${FORMAT_VERSION} です。`)
		}
		throw errorFor('INVALID_PAYLOAD', 'version属性が不正です。')
	}

	const payload = parsePayloadJson(documentEl.textContent ?? '')
	if (payload.formatVersion !== Number(version)) {
		throw errorFor('INVALID_PAYLOAD', 'XMLのversionとJSONのformatVersionが一致しません。')
	}
	return assertPayload(payload)
}

export function composeEditableSvg(preview: PreviewResult, payload: TldrawSvgPayloadV1): SVGSVGElement {
	const xml = document.implementation.createDocument(SVG_NS, 'svg', null)
	const root = xml.documentElement
	root.setAttribute('xmlns:td', DOCUMENT_NS)
	root.setAttribute('width', String(preview.width))
	root.setAttribute('height', String(preview.height))
	root.setAttribute('viewBox', preview.viewBox)

	const metadata = xml.createElementNS(SVG_NS, 'metadata')
	metadata.setAttribute('id', METADATA_ID)
	const payloadElement = xml.createElementNS(DOCUMENT_NS, 'td:document')
	payloadElement.setAttribute('encoding', PAYLOAD_ENCODING)
	payloadElement.setAttribute('version', String(FORMAT_VERSION))
	payloadElement.textContent = JSON.stringify(payload)
	metadata.appendChild(payloadElement)
	root.appendChild(metadata)

	const previewGroup = xml.createElementNS(SVG_NS, 'g')
	previewGroup.setAttribute('id', PREVIEW_GROUP_ID)
	const imported = xml.importNode(preview.svg.cloneNode(true), true) as Element
	for (const child of Array.from(imported.childNodes)) {
		if (child instanceof Element && child.localName === 'metadata') continue
		previewGroup.appendChild(child)
	}
	root.appendChild(previewGroup)
	return root as unknown as SVGSVGElement
}

export function serializeSvg(svg: Element): string {
	const serialized = new XMLSerializer().serializeToString(svg)
	return serialized.startsWith('<?xml') ? serialized : `${XML_DECLARATION}${serialized}`
}

export function parseSvgDocument(xml: string): Document {
	const parser = new DOMParser()
	const parsed = parser.parseFromString(xml, 'image/svg+xml')
	const errorNode = parsed.querySelector('parsererror')
	if (errorNode) {
		throw errorFor('INVALID_XML')
	}
	if (parsed.doctype) {
		throw errorFor('INVALID_XML', 'DOCTYPEは許可されていません。')
	}
	return parsed
}

export function stripBom(text: string): string {
	return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function hasDoctype(xml: string): boolean {
	return /<!DOCTYPE/i.test(xml)
}

function assertNotAborted(signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new DOMException('Aborted', 'AbortError')
	}
}
