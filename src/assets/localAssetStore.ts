import type { TLAsset, TLAssetStore } from 'tldraw'
import { ACCEPTED_IMAGE_MIME_TYPES } from '@/config/app'
import { errorFor } from '@/config/messages'
import { decodeAndValidateImage } from '@/assets/imageValidation'

export class LocalAssetStore implements TLAssetStore {
	private readonly pending = new Map<string, Promise<{ src: string }>>()
	private readonly failed = new Set<string>()

	async upload(asset: TLAsset, file: File, abortSignal?: AbortSignal): Promise<{ src: string }> {
		const task = this.uploadImpl(asset, file, abortSignal)
		this.pending.set(asset.id, task)
		try {
			const result = await task
			this.failed.delete(asset.id)
			return result
		} catch (error) {
			this.failed.add(asset.id)
			throw error
		} finally {
			this.pending.delete(asset.id)
		}
	}

	resolve(asset: TLAsset): string | null {
		return asset.props.src ?? null
	}

	async waitForIdle(signal?: AbortSignal): Promise<void> {
		while (this.pending.size > 0) {
			if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
			await Promise.allSettled(this.pending.values())
		}
	}

	hasFailures(): boolean {
		return this.failed.size > 0
	}

	clearFailures(): void {
		this.failed.clear()
	}

	private async uploadImpl(
		asset: TLAsset,
		file: File,
		abortSignal?: AbortSignal
	): Promise<{ src: string }> {
		if (abortSignal?.aborted) throw new DOMException('Aborted', 'AbortError')
		if (asset.type !== 'image') {
			throw errorFor('UNSUPPORTED_CONTENT', '動画や埋め込みは初版では扱えません。')
		}
		if (!ACCEPTED_IMAGE_MIME_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_MIME_TYPES)[number])) {
			const detectedOk = file.type === '' || file.type === 'application/octet-stream'
			if (!detectedOk) {
				throw errorFor('INVALID_ASSET', 'PNG / JPEG / 静止WebPのみ取り込みできます。')
			}
		}
		const validated = await decodeAndValidateImage(file)
		return { src: validated.dataUrl }
	}
}

export const localAssetStore = new LocalAssetStore()
