import { createRoot, type Root } from 'react-dom/client'
import { Tldraw, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { blobToDataUrl } from '@/assets/imageValidation'
import { PREVIEW_BACKGROUND, PREVIEW_PADDING, SVG_NS } from '@/config/app'
import { assetUrls, editorMediaLimits, licenseKey } from '@/config/assets'
import { LIMITS } from '@/config/limits'
import { errorFor } from '@/config/messages'
import { createAppStore, focusPreviewPage } from '@/document/tldrawAdapter'
import type { PortableDocument, PreviewResult } from '@/document/types'
import { previewNeedsRaster } from '@/export/validatePreview'

export async function renderPreview(
	snapshot: PortableDocument,
	pageId: string,
	signal: AbortSignal
): Promise<PreviewResult> {
	const host = document.createElement('div')
	host.setAttribute('data-tldraw-svg-export', 'true')
	host.style.cssText =
		'position:fixed;left:-20000px;top:0;width:1200px;height:800px;opacity:0;pointer-events:none;'
	document.body.appendChild(host)

	const store = createAppStore(snapshot)
	let root: Root | null = null
	let editor: Editor | null = null

	const cleanup = () => {
		root?.unmount()
		host.remove()
		store.dispose()
	}

	try {
		assertNotAborted(signal)
		editor = await mountEditor(host, store, (nextRoot) => {
			root = nextRoot
		}, signal)
		focusPreviewPage(editor, pageId)
		await waitForExportReady(signal)

		const ids = [...editor.getCurrentPageShapeIds()]
		if (ids.length === 0) {
			return emptyPreview(pageId)
		}

		const svgResult = await editor.getSvgElement(ids, {
			background: true,
			padding: PREVIEW_PADDING,
			darkMode: false,
			scale: 1,
		})
		if (!svgResult) {
			return emptyPreview(pageId)
		}

		const needsRaster = previewNeedsRaster(svgResult.svg)
		if (!needsRaster) {
			return {
				svg: svgResult.svg,
				mode: 'svg',
				pageId,
				width: svgResult.width,
				height: svgResult.height,
				viewBox: svgResult.svg.getAttribute('viewBox') ?? `0 0 ${svgResult.width} ${svgResult.height}`,
				resolutionReduced: false,
			}
		}

		const ratio = computePixelRatio(svgResult.width, svgResult.height)
		const image = await editor.toImage(ids, {
			format: 'png',
			pixelRatio: ratio.pixelRatio,
			background: true,
			padding: PREVIEW_PADDING,
			darkMode: false,
		})
		const dataUrl = await blobToDataUrl(image.blob)
		const svg = document.createElementNS(SVG_NS, 'svg')
		svg.setAttribute('width', String(svgResult.width))
		svg.setAttribute('height', String(svgResult.height))
		svg.setAttribute('viewBox', `0 0 ${svgResult.width} ${svgResult.height}`)
		const imageEl = document.createElementNS(SVG_NS, 'image')
		imageEl.setAttribute('href', dataUrl)
		imageEl.setAttribute('width', String(svgResult.width))
		imageEl.setAttribute('height', String(svgResult.height))
		svg.appendChild(imageEl)
		return {
			svg,
			mode: 'raster',
			pageId,
			width: svgResult.width,
			height: svgResult.height,
			viewBox: `0 0 ${svgResult.width} ${svgResult.height}`,
			resolutionReduced: ratio.reduced,
		}
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') throw error
		if (error && typeof error === 'object' && 'code' in error) throw error
		throw errorFor('PREVIEW_EXPORT_FAILED')
	} finally {
		cleanup()
	}
}

function emptyPreview(pageId: string): PreviewResult {
	const width = LIMITS.EMPTY_PREVIEW_WIDTH
	const height = LIMITS.EMPTY_PREVIEW_HEIGHT
	const svg = document.createElementNS(SVG_NS, 'svg')
	svg.setAttribute('width', String(width))
	svg.setAttribute('height', String(height))
	svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
	const rect = document.createElementNS(SVG_NS, 'rect')
	rect.setAttribute('width', String(width))
	rect.setAttribute('height', String(height))
	rect.setAttribute('fill', PREVIEW_BACKGROUND)
	svg.appendChild(rect)
	return {
		svg,
		mode: 'svg',
		pageId,
		width,
		height,
		viewBox: `0 0 ${width} ${height}`,
		resolutionReduced: false,
	}
}

function computePixelRatio(width: number, height: number): { pixelRatio: number; reduced: boolean } {
	let pixelRatio: number = LIMITS.PREVIEW_PIXEL_RATIO
	const longEdge = Math.max(width, height)
	if (longEdge * pixelRatio > LIMITS.PREVIEW_MAX_EDGE) {
		pixelRatio = LIMITS.PREVIEW_MAX_EDGE / longEdge
	}
	if (width * height * pixelRatio * pixelRatio > LIMITS.PREVIEW_MAX_PIXELS) {
		pixelRatio = Math.sqrt(LIMITS.PREVIEW_MAX_PIXELS / (width * height))
	}
	if (pixelRatio < 1) {
		throw errorFor('PREVIEW_TOO_LARGE')
	}
	return { pixelRatio, reduced: pixelRatio < LIMITS.PREVIEW_PIXEL_RATIO - 1e-6 }
}

function mountEditor(
	host: HTMLElement,
	store: ReturnType<typeof createAppStore>,
	setRoot: (root: Root) => void,
	signal: AbortSignal
): Promise<Editor> {
	return new Promise((resolve, reject) => {
		const root = createRoot(host)
		setRoot(root)
		const onAbort = () => reject(new DOMException('Aborted', 'AbortError'))
		signal.addEventListener('abort', onAbort, { once: true })
		root.render(
			<Tldraw
				store={store}
				hideUi
				colorScheme="light"
				licenseKey={licenseKey()}
				assetUrls={assetUrls}
				{...editorMediaLimits}
				onMount={(editor) => {
					editor.user.updateUserPreferences({ colorScheme: 'light' })
					signal.removeEventListener('abort', onAbort)
					resolve(editor)
				}}
			/>
		)
	})
}

async function waitForExportReady(signal: AbortSignal): Promise<void> {
	if (document.fonts?.ready) {
		await Promise.race([
			document.fonts.ready,
			new Promise((resolve) => window.setTimeout(resolve, 1500)),
		])
	}
	await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
	assertNotAborted(signal)
}

function assertNotAborted(signal: AbortSignal): void {
	if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
}
