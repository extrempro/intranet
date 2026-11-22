import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:3999';
// Lokal ohne heruntergeladene Browser: Pfad zu einem vorhandenen Chromium
const executablePath = process.env.CHROMIUM_PATH || undefined;

// Geräte nach docs/spec.md: PC, Tablet und Handy (Chromium mit Bildschirm,
// Touch und User-Agent des Geräts).
export default defineConfig({
	testDir: './tests',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		locale: 'de-DE',
		timezoneId: 'Europe/Berlin',
		launchOptions: { executablePath }
	},
	projects: [
		{ name: 'pc', use: { ...devices['Desktop Chrome'] } },
		{ name: 'tablet', use: { ...devices['iPad (gen 7)'], browserName: 'chromium' } },
		{ name: 'handy', use: { ...devices['iPhone 13'], browserName: 'chromium' } }
	]
});
