import type { AppDialog, ExternalChangeChoice, RecoveryChoice, UnsavedChoice } from '@/document/types'

type Props = {
	dialog: AppDialog | null
	onUnsaved(choice: UnsavedChoice): void
	onExternal(choice: ExternalChangeChoice): void
	onRecovery(choice: RecoveryChoice): void
	onNotice(): void
}

export function AppDialogHost({ dialog, onUnsaved, onExternal, onRecovery, onNotice }: Props) {
	if (!dialog) return null

	return (
		<div className="app-dialog-backdrop" role="presentation">
			<div className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
				<h2 id="app-dialog-title">{titleFor(dialog)}</h2>
				<p>{dialog.kind === 'notice' ? dialog.message : dialog.message}</p>
				<div className="app-dialog-actions">
					{dialog.kind === 'unsaved' && (
						<>
							<button type="button" onClick={() => onUnsaved('save')}>
								保存
							</button>
							<button type="button" onClick={() => onUnsaved('discard')}>
								破棄
							</button>
							<button type="button" className="secondary" onClick={() => onUnsaved('cancel')}>
								キャンセル
							</button>
						</>
					)}
					{dialog.kind === 'external-change' && (
						<>
							<button type="button" onClick={() => onExternal('save-as')}>
								別名で保存
							</button>
							<button type="button" className="secondary" onClick={() => onExternal('cancel')}>
								キャンセル
							</button>
						</>
					)}
					{dialog.kind === 'recovery' && (
						<>
							<button type="button" onClick={() => onRecovery('restore')}>
								復元する
							</button>
							<button type="button" className="secondary" onClick={() => onRecovery('discard')}>
								破棄する
							</button>
						</>
					)}
					{dialog.kind === 'notice' && (
						<button type="button" onClick={onNotice}>
							{dialog.confirmLabel ?? 'OK'}
						</button>
					)}
				</div>
			</div>
		</div>
	)
}

function titleFor(dialog: AppDialog): string {
	switch (dialog.kind) {
		case 'unsaved':
			return '未保存の変更があります'
		case 'external-change':
			return 'ファイルが変更されています'
		case 'recovery':
			return '未保存の内容があります'
		case 'notice':
			return dialog.title
	}
}
