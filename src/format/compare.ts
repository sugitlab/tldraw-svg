export function sortKeysDeep(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortKeysDeep)
	}
	if (value && typeof value === 'object') {
		const record = value as Record<string, unknown>
		const next: Record<string, unknown> = {}
		for (const key of Object.keys(record).sort()) {
			next[key] = sortKeysDeep(record[key])
		}
		return next
	}
	return value
}

export function jsonEqual(a: unknown, b: unknown): boolean {
	return JSON.stringify(sortKeysDeep(a)) === JSON.stringify(sortKeysDeep(b))
}

export function maxJsonDepth(value: unknown, depth = 1): number {
	if (Array.isArray(value)) {
		let max = depth
		for (const item of value) {
			max = Math.max(max, maxJsonDepth(item, depth + 1))
		}
		return max
	}
	if (value && typeof value === 'object') {
		let max = depth
		for (const item of Object.values(value as Record<string, unknown>)) {
			max = Math.max(max, maxJsonDepth(item, depth + 1))
		}
		return max
	}
	return depth
}

export function maxElementDepth(node: Element, depth = 1): number {
	let max = depth
	for (const child of Array.from(node.children)) {
		max = Math.max(max, maxElementDepth(child, depth + 1))
	}
	return max
}
