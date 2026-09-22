import type { AppUiState } from '@/document/types'

export function StatusBar({ state }: { state: AppUiState }) {
	const marker = state.dirty ? '未保存' : '保存済み'
	return (
		<div className="status-bar" data-testid="status-bar">
			<strong data-testid="file-name">{state.fileName}</strong>
			<span data-testid="dirty-state">{marker}</span>
			<span data-testid="status-text">{state.status}</span>
			{state.error ? (
				<span className="status-error" data-testid="status-error">
					{state.error}
				</span>
			) : null}
		</div>
	)
}
