import type { PortableDocument } from '@/document/types'

const DB_NAME = 'tldraw-svg-recovery'
const STORE_NAME = 'documents'
const DB_VERSION = 1

export type RecoveryRecord = {
	tabId: string
	documentId: string
	revision: number
	updatedAt: number
	fileName: string
	portableDocument: PortableDocument
}

export function getTabId(): string {
	const key = 'tldraw-svg.tab-id'
	const existing = sessionStorage.getItem(key)
	if (existing) return existing
	const created = crypto.randomUUID()
	sessionStorage.setItem(key, created)
	return created
}

export function createDocumentId(): string {
	return crypto.randomUUID()
}

export class RecoveryStore {
	private chain: Promise<void> = Promise.resolve()
	private latestRevision = 0

	enqueue(record: RecoveryRecord): void {
		this.latestRevision = Math.max(this.latestRevision, record.revision)
		this.chain = this.chain
			.catch(() => undefined)
			.then(async () => {
				if (record.revision < this.latestRevision) return
				try {
					await putRecord(record)
				} catch {
					// IndexedDB不足でも編集は続ける
				}
			})
	}

	async flush(): Promise<void> {
		await this.chain.catch(() => undefined)
	}

	async loadLatestForTab(tabId: string): Promise<RecoveryRecord | null> {
		const db = await openDb()
		return await new Promise((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readonly')
			const store = tx.objectStore(STORE_NAME)
			const request = store.getAll()
			request.onerror = () => reject(request.error)
			request.onsuccess = () => {
				const records = (request.result as RecoveryRecord[]).filter((item) => item.tabId === tabId)
				records.sort((a, b) => b.updatedAt - a.updatedAt)
				resolve(records[0] ?? null)
			}
		})
	}

	async clearTab(tabId: string): Promise<void> {
		const db = await openDb()
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite')
			const store = tx.objectStore(STORE_NAME)
			const request = store.getAll()
			request.onerror = () => reject(request.error)
			request.onsuccess = () => {
				for (const record of request.result as RecoveryRecord[]) {
					if (record.tabId === tabId) store.delete(record.documentId)
				}
			}
			tx.oncomplete = () => resolve()
			tx.onerror = () => reject(tx.error)
		})
	}

	async clearDocument(documentId: string): Promise<void> {
		const db = await openDb()
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE_NAME, 'readwrite')
			tx.objectStore(STORE_NAME).delete(documentId)
			tx.oncomplete = () => resolve()
			tx.onerror = () => reject(tx.error)
		})
	}
}

export const recoveryStore = new RecoveryStore()

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION)
		request.onerror = () => reject(request.error)
		request.onupgradeneeded = () => {
			const db = request.result
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: 'documentId' })
			}
		}
		request.onsuccess = () => resolve(request.result)
	})
}

function putRecord(record: RecoveryRecord): Promise<void> {
	return openDb().then(
		(db) =>
			new Promise((resolve, reject) => {
				const tx = db.transaction(STORE_NAME, 'readwrite')
				tx.objectStore(STORE_NAME).put(record)
				tx.oncomplete = () => resolve()
				tx.onerror = () => reject(tx.error)
			})
	)
}
