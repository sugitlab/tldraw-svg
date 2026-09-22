import { DEFAULT_FILE_NAME } from '@/config/app'

export function normalizeSaveName(input: string): string {
	const trimmed = input.trim() || DEFAULT_FILE_NAME.replace(/\.tldraw\.svg$/, '')
	if (trimmed.toLowerCase().endsWith('.tldraw.svg')) return trimmed
	if (trimmed.toLowerCase().endsWith('.svg')) {
		return `${trimmed.slice(0, -4)}.tldraw.svg`
	}
	return `${trimmed}.tldraw.svg`
}

export function looksLikeDedicatedName(name: string): boolean {
	return name.toLowerCase().endsWith('.tldraw.svg')
}

export function previewExportName(currentName: string): string {
	const base = currentName.replace(/\.tldraw\.svg$/i, '').replace(/\.svg$/i, '')
	return `${base || 'untitled'}.svg`
}

export function displayFileName(name: string | null | undefined): string {
	return name?.trim() || DEFAULT_FILE_NAME
}
