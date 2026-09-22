import type { DocumentFileErrorCode } from '@/document/errors'
import { fileError } from '@/document/errors'

export function errorFor(
	code: DocumentFileErrorCode,
	extra?: string
): ReturnType<typeof fileError> {
	const suffix = extra ? ` ${extra}` : ''
	switch (code) {
		case 'FILE_TOO_LARGE':
			return fileError(code, `ファイルが大きすぎます。50MiB以下にしてください。${suffix}`, extra)
		case 'INVALID_XML':
			return fileError(code, `SVGとして読み取れません。ファイルが壊れている可能性があります。${suffix}`, extra)
		case 'NOT_EDITABLE_SVG':
			return fileError(code, `このSVGには編集データがありません。専用ファイルを開いてください。${suffix}`, extra)
		case 'AMBIGUOUS_METADATA':
			return fileError(
				code,
				`編集データを読み取れません。metadataが壊れているか重複しています。${suffix}`,
				extra
			)
		case 'INVALID_PAYLOAD':
			return fileError(code, `編集データの形式が正しくありません。${suffix}`, extra)
		case 'UNSUPPORTED_FORMAT_VERSION':
			return fileError(code, `未対応の形式バージョンです。${suffix}`.trim(), extra)
		case 'UNSUPPORTED_SCHEMA':
			return fileError(code, `この文書のスキーマは、現在のエディタでは開けません。${suffix}`, extra)
		case 'UNSUPPORTED_CONTENT':
			return fileError(code, `未対応の内容が含まれています。${suffix}`.trim(), extra)
		case 'ASSET_UNAVAILABLE':
			return fileError(
				code,
				`画像をファイル内に含められません。画像を取り込み直してから保存してください。${suffix}`,
				extra
			)
		case 'INVALID_ASSET':
			return fileError(code, `画像が不正です。${suffix}`.trim(), extra)
		case 'INVALID_DOCUMENT_REFERENCES':
			return fileError(code, `文書内の参照関係が壊れているため開けません。${suffix}`, extra)
		case 'PREVIEW_EXPORT_FAILED':
			return fileError(code, `表示用画像の生成に失敗しました。${suffix}`, extra)
		case 'PREVIEW_TOO_LARGE':
			return fileError(code, `ページが大きすぎるため保存できません。内容を分けてください。${suffix}`, extra)
		case 'FILE_CHANGED_EXTERNALLY':
			return fileError(
				code,
				`ファイルが他のアプリで変更されています。別名で保存するか、キャンセルしてください。${suffix}`,
				extra
			)
		case 'SAVE_FAILED':
			return fileError(code, `保存に失敗しました。編集内容は残っています。${suffix}`, extra)
	}
}
