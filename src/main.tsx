import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { EditorApp } from '@/app/EditorApp'
import '@/app/styles.css'

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<EditorApp />
	</StrictMode>
)
