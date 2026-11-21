/**
 * Schutz vor Datenverlust: Hat jemand in einem Formular (POST) etwas
 * eingegeben und noch nicht abgeschickt oder als Entwurf gesichert, fragt das
 * Intranet vor dem Verlassen der Seite nach. Beim Schließen oder Neuladen
 * fragt der Browser selbst. Ausnahme per Attribut `data-ohne-schutz`.
 */
import { beforeNavigate, goto } from '$app/navigation';
import { onMount } from 'svelte';
import { frage } from './frage.svelte.ts';

// Nicht reaktiv: nur für die Abfrage beim Verlassen
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const offen = new Set<HTMLFormElement>();

/** Formular gilt als gesichert (z. B. Entwurf gespeichert) */
export function alsGesichert(form: HTMLFormElement) {
	offen.delete(form);
}

export function verlassenSchutz() {
	onMount(() => {
		const eingabe = (e: Event) => {
			const form = (e.target as Element | null)?.closest?.('form');
			if (form && form.method === 'post' && !form.hasAttribute('data-ohne-schutz')) offen.add(form);
		};
		const abgeschickt = (e: Event) => {
			if (e.target instanceof HTMLFormElement) offen.delete(e.target);
		};
		document.addEventListener('input', eingabe, true);
		document.addEventListener('submit', abgeschickt, true);
		return () => {
			document.removeEventListener('input', eingabe, true);
			document.removeEventListener('submit', abgeschickt, true);
		};
	});

	let durchlassen = false;
	beforeNavigate((nav) => {
		if (durchlassen) {
			durchlassen = false;
			return;
		}
		for (const f of offen) if (!f.isConnected) offen.delete(f);
		if (!offen.size || nav.type === 'form') return;
		// Schließen, Neuladen, fremde Seite: Der Browser fragt selbst
		nav.cancel();
		if (nav.willUnload || !nav.to) return;
		const ziel = nav.to.url;
		void frage({
			titel: 'Seite verlassen?',
			text: 'Deine Eingaben sind noch nicht gespeichert und gehen sonst verloren.',
			ja: 'Verlassen',
			nein: 'Hierbleiben',
			gefahr: true
		}).then((ja) => {
			if (!ja) return;
			offen.clear();
			durchlassen = true;
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- Ziel der abgebrochenen Navigation
			void goto(ziel);
		});
	});
}
