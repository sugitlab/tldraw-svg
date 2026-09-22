import {
	DefaultMainMenu,
	EditSubmenu,
	PreferencesGroup,
	TldrawUiMenuActionItem,
	TldrawUiMenuGroup,
	ViewSubmenu,
} from 'tldraw'

export function FileMainMenu() {
	return (
		<DefaultMainMenu>
			<TldrawUiMenuGroup id="tldraw-svg-file">
				<TldrawUiMenuActionItem actionId="tldraw-svg.new" />
				<TldrawUiMenuActionItem actionId="tldraw-svg.open" />
				<TldrawUiMenuActionItem actionId="tldraw-svg.save" />
				<TldrawUiMenuActionItem actionId="tldraw-svg.save-as" />
				<TldrawUiMenuActionItem actionId="tldraw-svg.export-preview" />
			</TldrawUiMenuGroup>
			<TldrawUiMenuGroup id="basic">
				<EditSubmenu />
				<ViewSubmenu />
				<TldrawUiMenuActionItem actionId="insert-media" />
			</TldrawUiMenuGroup>
			<PreferencesGroup />
		</DefaultMainMenu>
	)
}
