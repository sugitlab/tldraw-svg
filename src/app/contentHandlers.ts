import {
	AssetRecordType,
	createShapesForAssets,
	defaultHandleExternalTextContent,
	type Editor,
	type TLAsset,
	type TLAssetId,
	type TLImageAsset,
	type VecLike,
} from 'tldraw'
import { decodeAndValidateImage } from '@/assets/imageValidation'
import { ACCEPTED_IMAGE_MIME_TYPES } from '@/config/app'
import type { DocumentController } from '@/document/DocumentController'
import { DocumentFileError } from '@/document/errors'
import { decodeEditableSvg } from '@/format/svgCodec'

export function registerAppContentHandlers(
	editor: Editor,
	controller: DocumentController,
	notify: (message: string, kind?: 'info' | 'error') => void
): void {
	editor.registerExternalAssetHandler('file', async ({ file, assetId }) => {
		return createImageAssetRecord(file, assetId)
	})

	editor.registerExternalAssetHandler('url', async () => {
		throw new DocumentFileError('UNSUPPORTED_CONTENT', 'URLブックマークは初版では扱えません。')
	})

	editor.registerExternalContentHandler('url', async (content) => {
		notify('URLの埋め込みとブックマークは初版では扱えません。テキストとして貼り付けます。')
		await defaultHandleExternalTextContent(editor, {
			text: content.url,
			point: content.point,
		})
	})

	editor.registerExternalContentHandler('embed', async () => {
		notify('外部埋め込みは初版では扱えません。', 'error')
	})

	editor.registerExternalContentHandler('svg-text', async (content) => {
		const file = new File([content.text], 'dropped.svg', { type: 'image/svg+xml' })
		if (await isDedicatedSvg(file)) {
			await controller.openFile(file)
			return
		}
		notify('このSVGには編集データがありません。', 'error')
	})

	editor.registerExternalContentHandler('files', async (content) => {
		const dedicated: File[] = []
		const images: File[] = []
		const rejected: string[] = []

		for (const file of content.files) {
			if (await isDedicatedSvg(file)) {
				dedicated.push(file)
				continue
			}
			if (await isAcceptedImageFile(file)) {
				images.push(file)
				continue
			}
			rejected.push(file.name || file.type || '不明なファイル')
		}

		if (dedicated.length > 1) {
			notify('専用ファイルは1つずつ開いてください。', 'error')
			return
		}
		if (dedicated.length === 1) {
			await controller.openFile(dedicated[0])
			return
		}
		if (rejected.length > 0 && images.length === 0) {
			notify(`未対応のファイルです: ${rejected.join(', ')}`, 'error')
			return
		}
		if (rejected.length > 0) {
			notify(`一部のファイルは取り込みませんでした: ${rejected.join(', ')}`)
		}
		if (images.length === 0) return
		try {
			await insertLocalImages(editor, images, content.point)
		} catch (error) {
			notify(error instanceof Error ? error.message : '画像を取り込みできませんでした。', 'error')
		}
	})

	editor.registerExternalContentHandler('file-replace', async (content) => {
		if (!(await isAcceptedImageFile(content.file))) {
			notify('画像の置き換えは PNG / JPEG / 静止WebPのみです。', 'error')
			return
		}
		try {
			const asset = await createImageAssetRecord(content.file)
			editor.createAssets([asset])
			const shape = editor.getShape(content.shapeId)
			if (!shape || shape.type !== 'image') return
			editor.updateShape({
				id: shape.id,
				type: 'image',
				props: {
					assetId: asset.id,
					w: asset.props.w,
					h: asset.props.h,
				},
			})
		} catch (error) {
			notify(error instanceof Error ? error.message : '画像を置き換えできませんでした。', 'error')
		}
	})
}

export async function insertLocalImages(
	editor: Editor,
	files: File[],
	point?: VecLike
): Promise<void> {
	const assets: TLAsset[] = []
	for (const file of files) {
		assets.push(await createImageAssetRecord(file))
	}
	const position = point ?? editor.getViewportPageBounds().center
	await createShapesForAssets(editor, assets, position)
}

async function createImageAssetRecord(file: File, assetId?: TLAssetId): Promise<TLImageAsset> {
	const validated = await decodeAndValidateImage(file)
	return {
		id: assetId ?? AssetRecordType.createId(),
		typeName: 'asset',
		type: 'image',
		props: {
			name: file.name || 'image.png',
			src: validated.dataUrl,
			w: validated.width,
			h: validated.height,
			mimeType: validated.mimeType,
			isAnimated: false,
			fileSize: validated.byteLength,
		},
		meta: {},
	}
}

async function isDedicatedSvg(file: File): Promise<boolean> {
	const name = file.name.toLowerCase()
	const typed = file.type === 'image/svg+xml' || name.endsWith('.svg')
	if (!typed) return false
	try {
		await decodeEditableSvg(file)
		return true
	} catch (error) {
		if (error instanceof DocumentFileError && error.code === 'NOT_EDITABLE_SVG') return false
		if (error instanceof DocumentFileError && error.code === 'AMBIGUOUS_METADATA') return true
		return name.endsWith('.tldraw.svg')
	}
}

async function isAcceptedImageFile(file: File): Promise<boolean> {
	if (ACCEPTED_IMAGE_MIME_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number])) {
		return true
	}
	if (file.type && file.type !== 'application/octet-stream') return false
	try {
		await decodeAndValidateImage(file)
		return true
	} catch {
		return false
	}
}
