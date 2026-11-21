<script lang="ts">
	/**
	 * Entwurf im Formular: speichert automatisch kurz nach jeder Änderung und
	 * per Knopf „Als Entwurf speichern“. Nur für die eigene Person sichtbar.
	 * Beim Veröffentlichen löscht der Server den Entwurf.
	 */
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import type { EntwurfArt } from '#lib/entwuerfe.ts';
	import { alsGesichert } from '#lib/verlassen.svelte.ts';

	let {
		art,
		id = null,
		gespeichert = null
	}: { art: EntwurfArt; id?: string | null; gespeichert?: Date | string | null } = $props();

	const WARTEN_MS = 3000;

	// svelte-ignore state_referenced_locally
	let entwurfId = $state(id);
	// svelte-ignore state_referenced_locally
	let zeit = $state<Date | null>(gespeichert ? new Date(gespeichert) : null);
	let status = $state<'' | 'laeuft' | 'fehler'>('');
	let fehler = $state('');
	let anker: HTMLElement | undefined = $state();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let laeuft = false;
	let nochmal = false;
	let geaendert = false;

	const form = () => anker?.closest('form') ?? null;

	async function speichern() {
		clearTimeout(timer);
		const f = form();
		if (!f) return;
		if (laeuft) {
			nochmal = true;
			return;
		}
		laeuft = true;
		geaendert = false;
		status = 'laeuft';
		const daten = new FormData(f);
		daten.set('art', art);
		daten.set('entwurf', entwurfId ?? '');
		try {
			const res = await fetch('/entwuerfe/speichern', { method: 'POST', body: daten });
			const r = (await res.json().catch(() => ({}))) as { id?: string; fehler?: string };
			if (!res.ok || !r.id)
				throw new Error(r.fehler ?? 'Der Entwurf konnte nicht gespeichert werden.');
			entwurfId = r.id;
			zeit = new Date();
			status = '';
			fehler = '';
			// Neu laden oder später wiederkommen: Entwurf steht in der Adresse
			if (page.url.searchParams.get('entwurf') !== r.id) {
				const u = new URL(page.url.href);
				u.searchParams.set('entwurf', r.id);
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- aktuelle Seite, nur Parameter
				replaceState(u, page.state);
			}
			if (!geaendert && !nochmal) alsGesichert(f);
		} catch (err) {
			status = 'fehler';
			fehler =
				err instanceof Error && navigator.onLine
					? err.message
					: 'Keine Verbindung. Der Entwurf wird gespeichert, sobald du wieder online bist.';
			geaendert = true;
		} finally {
			laeuft = false;
			if (nochmal) {
				nochmal = false;
				void speichern();
			}
		}
	}

	onMount(() => {
		const f = form();
		if (!f) return;
		const eingabe = () => {
			geaendert = true;
			clearTimeout(timer);
			timer = setTimeout(() => void speichern(), WARTEN_MS);
		};
		const abschicken = () => clearTimeout(timer);
		const online = () => {
			if (geaendert) void speichern();
		};
		f.addEventListener('input', eingabe);
		f.addEventListener('submit', abschicken);
		window.addEventListener('online', online);
		return () => {
			clearTimeout(timer);
			f.removeEventListener('input', eingabe);
			f.removeEventListener('submit', abschicken);
			window.removeEventListener('online', online);
		};
	});

	const uhrzeit = (d: Date) =>
		d.toLocaleTimeString('de-DE', {
			hour: '2-digit',
			minute: '2-digit',
			timeZone: 'Europe/Berlin'
		});
</script>

<div class="entwurf" bind:this={anker}>
	<input type="hidden" name="entwurf" value={entwurfId ?? ''} />
	<button class="knopf zweit" type="button" onclick={speichern} disabled={status === 'laeuft'}>
		Als Entwurf speichern
	</button>
	<span class="status" class:fehlertext={status === 'fehler'} role="status">
		{#if status === 'laeuft'}
			Wird gespeichert …
		{:else if status === 'fehler'}
			{fehler}
		{:else if zeit}
			Entwurf gespeichert um {uhrzeit(zeit)} Uhr. Nur du siehst ihn.
		{:else}
			Wird beim Schreiben automatisch als Entwurf gespeichert.
		{/if}
	</span>
</div>

<style>
	.entwurf {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 14px;
	}
	.status {
		color: var(--mu);
		font-size: 14px;
	}
	.fehlertext {
		color: var(--err-tx);
	}
</style>
