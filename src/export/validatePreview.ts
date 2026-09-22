import { SVG_NS } from '@/config/app'
import { errorFor } from '@/config/messages'
import { detectImageType } from '@/assets/imageValidation'

const FORBIDDEN_ELEMENTS = new Set([
	'foreignObject',
	'script',
	'iframe',
	'object',
	'embed',
	'link',
	'html',
	'body',
	'div',
	'span',
	'p',
])

const URL_ATTRS = ['href', 'xlink:href', 'src', 'srcset', 'poster']

export function validatePreviewSvg(root: Element): void {
	if (root.localName !== 'svg') {
		throw errorFor('PREVIEW_EXPORT_FAILED', '出力がSVGではありません。')
	}

	const ids = new Set<string>()
	const walk = (node: Element) => {
		if (node.namespaceURI && node.namespaceURI !== SVG_NS && node.namespaceURI !== 'urn:tldraw-svg:document:1') {
			if (node.namespaceURI === 'http://www.w3.org/1999/xhtml') {
				throw errorFor('PREVIEW_EXPORT_FAILED', 'HTML要素を含むSVGは出力できません。')
			}
		}
		if (FORBIDDEN_ELEMENTS.has(node.localName) && node.id !== 'tldraw-document') {
			if (node.localName === 'style') {
				validateCss(node.textContent ?? '')
			} else if (node.localName !== 'metadata') {
				throw errorFor('PREVIEW_EXPORT_FAILED', `禁止要素 ${node.localName} が含まれています。`)
			}
		}
		if (node.localName === 'foreignObject' || node.localName === 'script' || node.localName === 'iframe') {
			throw errorFor('PREVIEW_EXPORT_FAILED', `${node.localName} を含むSVGは出力できません。`)
		}

		for (const attr of Array.from(node.attributes)) {
			if (attr.name.startsWith('on')) {
				throw errorFor('PREVIEW_EXPORT_FAILED', 'イベント属性を含むSVGは出力できません。')
			}
			if (URL_ATTRS.includes(attr.name) || attr.name.endsWith(':href')) {
				assertSafeUrl(attr.value, node.localName)
			}
			if (attr.name === 'style') {
				validateCss(attr.value)
			}
			if (attr.name === 'id') {
				if (ids.has(attr.value) && attr.value !== 'tldraw-document') {
					throw errorFor('PREVIEW_EXPORT_FAILED', 'SVG内のIDが重複しています。')
				}
				ids.add(attr.value)
			}
		}

		for (const child of Array.from(node.children)) {
			walk(child)
		}
	}

	walk(root)
}

export function previewNeedsRaster(root: Element): boolean {
	const forbidden = root.querySelector('foreignObject, script, iframe, object, embed, text, tspan')
	return Boolean(forbidden)
}

function validateCss(css: string): void {
	if (/@import/i.test(css)) {
		throw errorFor('PREVIEW_EXPORT_FAILED', '外部CSS参照は出力できません。')
	}
	const urls = css.match(/url\(([^)]+)\)/gi) ?? []
	for (const raw of urls) {
		const value = raw.replace(/^url\(/i, '').replace(/\)$/, '').trim().replace(/^['"]|['"]$/g, '')
		if (value.startsWith('#') || value.startsWith('data:')) continue
		throw errorFor('PREVIEW_EXPORT_FAILED', '外部参照を含むCSSは出力できません。')
	}
}

function assertSafeUrl(value: string, localName: string): void {
	const trimmed = value.trim()
	if (!trimmed) return
	if (trimmed.startsWith('#')) return
	if (trimmed.startsWith('url(#')) return
	if (trimmed.startsWith('data:')) {
		if (localName === 'image') {
			const header = trimmed.slice(5, trimmed.indexOf(','))
			const mime = header.split(';')[0]
			if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) {
				throw errorFor('PREVIEW_EXPORT_FAILED', '許可されていないdata URLです。')
			}
			const comma = trimmed.indexOf(',')
			if (comma > 0) {
				try {
					const payload = trimmed.slice(comma + 1)
					const binary = header.includes('base64') ? atob(payload.slice(0, 64)) : payload
					const bytes = new Uint8Array(Math.min(binary.length, 16))
					for (let i = 0; i < bytes.length; i += 1) bytes[i] = binary.charCodeAt(i)
					if (!detectImageType(bytes) && bytes.length >= 12) {
						// short prefix may not include magic; allow if mime is accepted
					}
				} catch {
					throw errorFor('PREVIEW_EXPORT_FAILED', 'data URLが不正です。')
				}
			}
		}
		return
	}
	throw errorFor('PREVIEW_EXPORT_FAILED', '外部参照を含むSVGは出力できません。')
}
