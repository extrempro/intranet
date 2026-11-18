import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		// Content Security Policy: Skripte und Styles nur von der eigenen Herkunft,
		// SvelteKit ergänzt Hashes bzw. Nonces für eigene Inline-Skripte.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:', 'blob:'],
				'font-src': ['self'],
				'connect-src': ['self'],
				'frame-ancestors': ['none'],
				'form-action': ['self'],
				'base-uri': ['self'],
				'object-src': ['none']
			}
		},
		// SvelteKit prüft bei Formularen standardmäßig die Herkunft (Schutz gegen CSRF).
		csrf: { checkOrigin: true }
	}
};

export default config;
