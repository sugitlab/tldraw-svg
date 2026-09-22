import {
	defaultHandleExternalFileContent,
	defaultHandleExternalFileReplaceContent,
	defaultHandleExternalTextContent,
	type Editor,
	type TLDefaultExternalContentHandlerOpts,
} from 'tldraw'
import { ACCEPTED_IMAGE_MIME_TYPES } from '@/config/app'
import { editorMediaLimits } from '@/config/assets'
import type { DocumentController } from '@/document/DocumentController'
import { DocumentFileError } from '@/document/errors'
import { decodeEditableSvg } from '@/format/svgCodec'

export function registerAppContentHandlers(
	editor: Editor,
	controller: DocumentController,
	notify: (message: string, kind?: 'info' | 'error') => void
): void {
	const options = createHandlerOptions(notify)

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
			if (isAcceptedImageFile(file)) {
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
		await defaultHandleExternalFileContent(editor, { ...content, files: images }, options)
	})

	editor.registerExternalContentHandler('file-replace', async (content) => {
		if (!isAcceptedImageFile(content.file)) {
			notify('画像の置き換えは PNG / JPEG / 静止WebPのみです。', 'error')
			return
		}
		await defaultHandleExternalFileReplaceContent(editor, content, options)
	})
}

function createHandlerOptions(
	notify: (message: string, kind?: 'info' | 'error') => void
): TLDefaultExternalContentHandlerOpts {
	return {
		...editorMediaLimits,
		toasts: {
			addToast: (toast: { title?: string; description?: string }) => {
				notify(String(toast.title ?? toast.description ?? ''), 'error')
				return 'toast'
			},
			removeToast: () => undefined,
			clearToasts: () => undefined,
			toasts: [],
		} as unknown as TLDefaultExternalContentHandlerOpts['toasts'],
		msg: ((key: string) => key) as TLDefaultExternalContentHandlerOpts['msg'],
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

function isAcceptedImageFile(file: File): boolean {
	return ACCEPTED_IMAGE_MIME_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number])
}
