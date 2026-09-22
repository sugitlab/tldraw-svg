import {
	AssetRecordType,
	createShapeId,
	toRichText,
	type Editor,
	type TLAssetId,
	type TLShapeId,
} from 'tldraw'
import { blobToDataUrl } from '@/assets/imageValidation'

const TINY_PNG =
	'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIUlEQVQoU2NkYGD4z0AEYBxVSFQ0qhA/dBHh6lGF+OEGADbdBBHY3k6KAAAAAElFTkSuQmCC'

export async function createDemo(editor: Editor, kind: 'basic' | 'japanese' | 'images' | 'empty'): Promise<void> {
	editor.selectAll()
	if (editor.getSelectedShapeIds().length > 0) editor.deleteShapes(editor.getSelectedShapeIds())

	if (kind === 'empty') return

	if (kind === 'basic') {
		const a = createShapeId()
		const b = createShapeId()
		const arrow = createShapeId()
		editor.createShapes([
			{
				id: a,
				type: 'geo',
				x: 100,
				y: 120,
				props: { geo: 'rectangle', w: 180, h: 110, richText: toRichText('Start') },
			},
			{
				id: b,
				type: 'geo',
				x: 420,
				y: 180,
				props: { geo: 'ellipse', w: 180, h: 110, color: 'blue', richText: toRichText('End') },
			},
			{
				id: arrow,
				type: 'arrow',
				x: 280,
				y: 170,
				props: { richText: toRichText('connect') },
			},
		])
		bindArrow(editor, arrow, a, b)
		return
	}

	if (kind === 'japanese') {
		editor.createShapes([
			{
				id: createShapeId(),
				type: 'note',
				x: 80,
				y: 80,
				props: { richText: toRichText('日本語の付箋です。\n改行と絵文字 🙂') },
			},
			{
				id: createShapeId(),
				type: 'text',
				x: 320,
				y: 90,
				props: { richText: toRichText('長い文章の折り返し確認。これは日本語の段落で、専用ファイルに保存しても欠けてはいけません。& < > </metadata> ]]>') },
			},
			{
				id: createShapeId(),
				type: 'geo',
				x: 80,
				y: 280,
				props: { w: 220, h: 90, richText: toRichText('ラベル付き図形') },
			},
		])
		return
	}

	const page1 = editor.getCurrentPageId()
	const imageId = createShapeId()
	const assetId = await createImageAsset(editor)
	editor.createShape({
		id: imageId,
		type: 'image',
		x: 80,
		y: 80,
		props: {
			assetId,
			w: 240,
			h: 240,
			crop: { topLeft: { x: 0.1, y: 0.1 }, bottomRight: { x: 0.9, y: 0.9 } },
		},
	})
	editor.createShape({
		id: createShapeId(),
		type: 'frame',
		x: 360,
		y: 80,
		props: { w: 260, h: 180, name: 'Frame' },
	})
	editor.createPage({ name: 'ページ2' })
	const pages = editor.getPages()
	const page2 = pages.find((page) => page.id !== page1)
	if (page2) {
		editor.setCurrentPage(page2.id)
		editor.createShape({
			id: createShapeId(),
			type: 'geo',
			x: 120,
			y: 120,
			props: { geo: 'triangle', w: 160, h: 140, color: 'green', richText: toRichText('2ページ目') },
		})
		editor.setCurrentPage(page1)
	}
}

function bindArrow(editor: Editor, arrowId: TLShapeId, start: TLShapeId, end: TLShapeId): void {
	editor.createBindings([
		{
			type: 'arrow',
			fromId: arrowId,
			toId: start,
			props: {
				terminal: 'start',
				normalizedAnchor: { x: 0.5, y: 0.5 },
				isExact: false,
				isPrecise: false,
				snap: 'none',
			},
		},
		{
			type: 'arrow',
			fromId: arrowId,
			toId: end,
			props: {
				terminal: 'end',
				normalizedAnchor: { x: 0.5, y: 0.5 },
				isExact: false,
				isPrecise: false,
				snap: 'none',
			},
		},
	])
}

async function createImageAsset(editor: Editor): Promise<TLAssetId> {
	const bytes = Uint8Array.from(atob(TINY_PNG), (char) => char.charCodeAt(0))
	const file = new File([bytes], 'sample.png', { type: 'image/png' })
	const src = await blobToDataUrl(file)
	const id = AssetRecordType.createId()
	editor.createAssets([
		{
			id,
			typeName: 'asset',
			type: 'image',
			props: {
				name: 'sample.png',
				src,
				w: 10,
				h: 10,
				mimeType: 'image/png',
				isAnimated: false,
				fileSize: bytes.byteLength,
			},
			meta: {},
		},
	])
	return id
}
