interface FileSystemHandlePermissionDescriptor {
	mode?: 'read' | 'readwrite'
}

interface FileSystemFileHandle {
	readonly name: string
	getFile(): Promise<File>
	createWritable(): Promise<FileSystemWritableFileStream>
	queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
	requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface FileSystemWritableFileStream extends WritableStream {
	write(data: BufferSource | Blob | string): Promise<void>
	close(): Promise<void>
	abort(): Promise<void>
}

interface Window {
	showSaveFilePicker?(options?: {
		suggestedName?: string
		types?: Array<{ description?: string; accept: Record<string, string[]> }>
	}): Promise<FileSystemFileHandle>
	showOpenFilePicker?(options?: {
		multiple?: boolean
		types?: Array<{ description?: string; accept: Record<string, string[]> }>
	}): Promise<FileSystemFileHandle[]>
}
