/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_TLDRAW_LICENSE_KEY?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}

interface Window {
	__tldrawSvg?: {
		ready: boolean
		encodeCurrent(): Promise<string>
		openSvgText(text: string): Promise<void>
		getFileName(): string
		isDirty(): boolean
		getPageCount(): number
		getDocumentStats(): { pages: number; shapes: number; assets: number }
		createDemo(kind: 'basic' | 'japanese' | 'images' | 'empty'): Promise<void>
		insertPng(base64: string): Promise<void>
	}
}
