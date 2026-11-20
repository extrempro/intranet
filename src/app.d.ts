// Typen für SvelteKit, siehe https://svelte.dev/docs/kit/types#app.d.ts
import type { SessionPerson } from '#lib/server/auth/session.ts';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Angemeldete Person, sonst null. */
			person: SessionPerson | null;
			session: { id: string; authMethod: 'entra' | 'local' } | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
