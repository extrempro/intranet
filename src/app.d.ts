// Typen für SvelteKit, siehe https://svelte.dev/docs/kit/types#app.d.ts
import type { Principal } from '#lib/server/auth/access.ts';
import type { SessionPerson } from '#lib/server/auth/session.ts';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Angemeldete Person, sonst null. */
			person: SessionPerson | null;
			session: { id: string; authMethod: 'entra' | 'local'; confirmedAt: Date | null } | null;
			/** Rollen und Mitgliedschaften der angemeldeten Person für die Rechteprüfung. */
			principal: Principal | null;
			/** Gewählte Darstellung; „auto“ folgt dem System. */
			theme: 'auto' | 'hell' | 'dunkel';
			/** Anfrage aus der Teams-App (Sitzung über das Teams-Cookie) */
			teams: boolean;
			/** 403 nur wegen fehlender erneuter Anmeldung (kein verweigerter Zugriff fürs Protokoll) */
			bestaetigungVerlangt?: boolean;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
