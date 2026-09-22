import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	server: {
		host: 'localhost',
		port: 5173,
	},
	test: {
		environment: 'jsdom',
		include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
		restoreMocks: true,
	},
})
