import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter(),
			// Neue Version erkennen (Hinweis „Neu laden“, NeueVersion.svelte): zusätzlich zu
			// Seitenwechseln und Rückkehr in den Tab alle 5 Minuten (lange offene Teams-Reiter)
			version: { pollInterval: 5 * 60 * 1000 },
			// Content Security Policy: Skripte und Styles nur von der eigenen Herkunft,
			// SvelteKit ergänzt Hashes bzw. Nonces für eigene Inline-Skripte.
			// Schutz gegen CSRF ist in SvelteKit immer aktiv.
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'blob:'],
					'font-src': ['self'],
					'connect-src': ['self'],
					// Einbetten nur in die Teams-App (Teams, Outlook, Microsoft 365)
					'frame-ancestors': [
						'self',
						'https://teams.microsoft.com',
						'https://*.teams.microsoft.com',
						'https://teams.cloud.microsoft',
						'https://*.cloud.microsoft',
						'https://*.office.com',
						'https://outlook.office.com',
						'https://*.microsoft365.com'
					],
					'form-action': ['self'],
					'base-uri': ['self'],
					'object-src': ['none']
				}
			}
		})
	],
	test: {
		include: ['src/**/*.test.ts']
	}
});
