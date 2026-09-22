import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: 'tests/e2e',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: [['list']],
	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
	},
	webServer: {
		command: 'npm run dev -- --host localhost --port 5173',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
		},
	],
})
