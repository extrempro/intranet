<script lang="ts">
	/**
	 * Weiter am Ende langer Listen (Kap. 6.7): „20 ältere laden · noch 47“,
	 * am Ende „Das waren alle …“ und „Nach oben“. Ohne JavaScript ein Link;
	 * mit JavaScript bleibt die Seite stehen, der Fokus springt auf den
	 * ersten neuen Eintrag (`[data-eintrag]`) und Screenreader hören die Zahl.
	 */
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import { mitZahl } from '#lib/lange-liste.ts';

	let {
		geladen,
		gesamt,
		schritt,
		href,
		einheit,
		verb = 'ältere laden',
		alleHref = null,
		bereich = null
	}: {
		geladen: number;
		gesamt: number;
		schritt: number;
		/** Adresse mit der nächsten Anzahl */
		href: string;
		/** z. B. ['Beitrag', 'Beiträge'] */
		einheit: [string, string];
		verb?: string;
		/** optional „Alle n anzeigen“ */
		alleHref?: string | null;
		/** id des Elements mit den Einträgen, falls es mehrere Listen gibt */
		bereich?: string | null;
	} = $props();

	let ansage = $state('');
	let laedt = $state(false);
	const rest = $derived(Math.max(0, gesamt - geladen));
	const naechste = $derived(Math.min(schritt, rest));

	async function laden(e: MouseEvent, ziel: string) {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		const vorher = geladen;
		laedt = true;
		try {
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- nur Suchparameter der aktuellen Seite
			await goto(ziel, { reset: false, replace: true });
			await tick();
			const wurzel = (bereich && document.getElementById(bereich)) || document;
			const neu = wurzel.querySelectorAll<HTMLElement>('[data-eintrag]')[vorher];
			neu?.querySelector<HTMLElement>('a[href]')?.focus();
			const dazu = geladen - vorher;
			ansage = `${mitZahl(dazu, einheit[0], einheit[1])} geladen.`;
		} finally {
			laedt = false;
		}
	}
</script>

<div class="mehrladen">
	{#if rest > 0}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der aktuellen Seite -->
		<a class="knopf zweit weiter" {href} aria-busy={laedt} onclick={(e) => laden(e, href)}>
			{naechste}
			{verb} · noch {rest}
		</a>
		{#if alleHref}
			<a class="linkknopf" href={alleHref} onclick={(e) => laden(e, alleHref ?? href)}>
				Alle {gesamt} anzeigen
			</a>
		{/if}
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{:else if gesamt > schritt}
		<p class="ende">Das waren alle {mitZahl(gesamt, einheit[0], einheit[1])}.</p>
		<a class="linkknopf" href="#inhalt">Nach oben</a>
	{/if}
	<p class="sr-only" role="status">{ansage}</p>
</div>

<style>
	.mehrladen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 8px 16px;
	}
	.weiter {
		min-width: 260px;
		min-height: 48px;
		justify-content: center;
	}
	.weiter[aria-busy='true'] {
		opacity: 0.6;
	}
	.ende {
		margin: 0;
		color: var(--mu);
		font-size: 14px;
	}
	.linkknopf {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	@media (max-width: 599px) {
		.weiter {
			flex: 1 1 100%;
			min-width: 0;
		}
	}
</style>
