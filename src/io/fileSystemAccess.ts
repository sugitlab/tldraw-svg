import { errorFor } from '@/config/messages'
import { DocumentFileError, UserCancelledError } from '@/document/errors'
import { sha256Hex } from '@/io/hash'

export function hasFileSystemAccess(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof window.showSaveFilePicker === 'function' &&
		typeof window.showOpenFilePicker === 'function' &&
		window.isSecureContext
	)
}

export async function pickSaveFile(suggestedName: string): Promise<FileSystemFileHandle> {
	const picker = window.showSaveFilePicker
	if (!picker) throw errorFor('SAVE_FAILED', 'このブラウザでは保存ダイアログを使えません。')
	try {
		return await picker({
			suggestedName,
			types: [
				{
					description: 'SVG',
					accept: { 'image/svg+xml': ['.svg'] },
				},
			],
		})
	} catch (error) {
		if (isUserAbort(error)) throw new UserCancelledError()
		throw errorFor('SAVE_FAILED', '保存先を選択できませんでした。')
	}
}

export async function pickOpenFile(): Promise<FileSystemFileHandle> {
	const picker = window.showOpenFilePicker
	if (!picker) throw errorFor('SAVE_FAILED', 'このブラウザではファイル選択を使えません。')
	try {
		const [handle] = await picker({
			multiple: false,
			types: [
				{
					description: 'SVG',
					accept: { 'image/svg+xml': ['.svg'] },
				},
			],
		})
		return handle
	} catch (error) {
		if (isUserAbort(error)) throw new UserCancelledError()
		throw errorFor('SAVE_FAILED', 'ファイルを選択できませんでした。')
	}
}

export function pickFileWithInput(accept = 'image/svg+xml,.svg'): Promise<File> {
	return new Promise((resolve, reject) => {
		const input = document.createElement('input')
		input.type = 'file'
		input.accept = accept
		input.style.display = 'none'
		const cleanup = () => input.remove()
		input.addEventListener('change', () => {
			const file = input.files?.[0]
			cleanup()
			if (!file) {
				reject(new UserCancelledError())
				return
			}
			resolve(file)
		})
		input.addEventListener('cancel', () => {
			cleanup()
			reject(new UserCancelledError())
		})
		document.body.appendChild(input)
		input.click()
	})
}

export async function readHandle(handle: FileSystemFileHandle): Promise<{ file: File; hash: string }> {
	const file = await handle.getFile()
	const hash = await sha256Hex(file)
	return { file, hash }
}

export async function ensureWritePermission(handle: FileSystemFileHandle): Promise<void> {
	const permission = await handle.queryPermission({ mode: 'readwrite' })
	if (permission === 'granted') return
	const requested = await handle.requestPermission({ mode: 'readwrite' })
	if (requested !== 'granted') {
		throw errorFor('SAVE_FAILED', 'ファイルへの書き込み権限がありません。')
	}
}

export async function writeHandle(handle: FileSystemFileHandle, blob: Blob): Promise<string> {
	await ensureWritePermission(handle)
	const writable = await handle.createWritable()
	try {
		await writable.write(blob)
		await writable.close()
	} catch (error) {
		try {
			await writable.abort()
		} catch {
			// already closed or aborted
		}
		if (error instanceof DocumentFileError) throw error
		throw errorFor('SAVE_FAILED')
	}
	return sha256Hex(blob)
}

export async function detectExternalChange(
	handle: FileSystemFileHandle,
	expectedHash: string | null
): Promise<boolean> {
	if (!expectedHash) return false
	const { hash } = await readHandle(handle)
	return hash !== expectedHash
}

function isUserAbort(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError'
}
