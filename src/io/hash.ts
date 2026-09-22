export async function sha256Hex(data: BufferSource | Blob | string): Promise<string> {
	const bytes =
		typeof data === 'string'
			? new TextEncoder().encode(data)
			: data instanceof Blob
				? await data.arrayBuffer()
				: data
	const digest = await crypto.subtle.digest('SHA-256', bytes)
	return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}
