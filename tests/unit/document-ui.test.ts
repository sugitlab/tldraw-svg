import { describe, expect, it, vi } from 'vitest'
import { DocumentController, type ControllerHooks } from '@/document/DocumentController'
import { createAppStore } from '@/document/tldrawAdapter'
import { isSameUiState, type AppUiState } from '@/document/types'

function hooks(overrides: Partial<ControllerHooks> = {}): ControllerHooks {
	return {
		replaceStore: () => undefined,
		askUnsaved: async () => 'discard',
		askExternalChange: async () => 'cancel',
		askRecovery: async () => 'discard',
		notify: () => undefined,
		...overrides,
	}
}

describe('isSameUiState', () => {
	const state: AppUiState = {
		fileName: 'untitled.tldraw.svg',
		dirty: true,
		busy: false,
		status: '未保存の変更があります',
		error: null,
		locked: false,
	}

	it('is true for identical snapshots', () => {
		expect(isSameUiState(state, { ...state })).toBe(true)
	})

	it('is false when a field changes', () => {
		expect(isSameUiState(state, { ...state, dirty: false })).toBe(false)
	})
})

describe('DocumentController UI updates', () => {
	it('does not notify listeners again while already dirty with the same status', () => {
		const store = createAppStore()
		const controller = new DocumentController(store, hooks())
		controller.beginTrackingEdits()
		const listener = vi.fn()
		controller.subscribe(listener)
		listener.mockClear()

		const page = store.allRecords().find((record) => record.typeName === 'page')
		if (!page || page.typeName !== 'page') throw new Error('expected a page record')

		store.put([{ ...page, name: 'first' }])
		expect(listener).toHaveBeenCalledTimes(1)
		expect(listener.mock.calls[0][0]).toMatchObject({
			dirty: true,
			status: '未保存の変更があります',
		})

		listener.mockClear()
		store.put([{ ...page, name: 'second' }])
		expect(listener).not.toHaveBeenCalled()
		expect(controller.isDirty()).toBe(true)
		expect(controller.getState().status).toBe('未保存の変更があります')
	})

	it('resumes document listeners after dispose', () => {
		const store = createAppStore()
		const controller = new DocumentController(store, hooks())
		controller.beginTrackingEdits()
		const listener = vi.fn()
		controller.subscribe(listener)
		listener.mockClear()

		const page = store.allRecords().find((record) => record.typeName === 'page')
		if (!page || page.typeName !== 'page') throw new Error('expected a page record')

		controller.dispose()
		store.put([{ ...page, name: 'after-dispose' }])
		expect(listener).not.toHaveBeenCalled()

		controller.start()
		controller.beginTrackingEdits()
		store.put([{ ...page, name: 'after-start' }])
		expect(listener).toHaveBeenCalledTimes(1)
		expect(controller.isDirty()).toBe(true)
	})
})
