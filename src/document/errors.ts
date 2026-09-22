export type DocumentFileErrorCode =
	| 'FILE_TOO_LARGE'
	| 'INVALID_XML'
	| 'NOT_EDITABLE_SVG'
	| 'AMBIGUOUS_METADATA'
	| 'INVALID_PAYLOAD'
	| 'UNSUPPORTED_FORMAT_VERSION'
	| 'UNSUPPORTED_SCHEMA'
	| 'UNSUPPORTED_CONTENT'
	| 'ASSET_UNAVAILABLE'
	| 'INVALID_ASSET'
	| 'INVALID_DOCUMENT_REFERENCES'
	| 'PREVIEW_EXPORT_FAILED'
	| 'PREVIEW_TOO_LARGE'
	| 'FILE_CHANGED_EXTERNALLY'
	| 'SAVE_FAILED'

export class DocumentFileError extends Error {
	readonly code: DocumentFileErrorCode
	readonly details: string | undefined

	constructor(code: DocumentFileErrorCode, message: string, details?: string) {
		super(message)
		this.name = 'DocumentFileError'
		this.code = code
		this.details = details
	}
}

export class UserCancelledError extends Error {
	constructor() {
		super('cancelled')
		this.name = 'UserCancelledError'
	}
}

export function isCancelled(error: unknown): boolean {
	return error instanceof UserCancelledError || (error instanceof DOMException && error.name === 'AbortError')
}

export function userMessage(error: unknown): string {
	if (isCancelled(error)) return ''
	if (error instanceof DocumentFileError) {
		return error.message
	}
	if (error instanceof Error && error.message) {
		return `予期しないエラーが発生しました。編集内容は残っています。`
	}
	return '予期しないエラーが発生しました。'
}

export function fileError(
	code: DocumentFileErrorCode,
	message: string,
	details?: string
): DocumentFileError {
	return new DocumentFileError(code, message, details)
}
