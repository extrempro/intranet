<script lang="ts">
	/**
	 * Öffnet sich, wenn eine Formular-Aktion eine erneute Anmeldung verlangt
	 * (`bestaetigung: true`). Nach der Bestätigung wird dasselbe Formular noch
	 * einmal abgeschickt, Eingaben bleiben erhalten.
	 */
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import BestaetigenFormular from './BestaetigenFormular.svelte';
	import { BESTAETIGUNG_KANAL, bisUhrzeit, type BestaetigungsWege } from '#lib/bestaetigung.ts';

	let dialog = $state<HTMLDialogElement>();
	let wege = $state<BestaetigungsWege | null>(null);
	let offen = $state(false);
	let letzte: { form: HTMLFormElement; submitter: HTMLElement | null } | null = null;

	const hier = $derived(page.url.pathname + page.url.search);
	const seite = $derived(`${resolve('/(app)/bestaetigen')}?ziel=${encodeURIComponent(hier)}`);
	const verlangt = $derived(
		Boolean((page.form as { bestaetigung?: boolean } | null)?.bestaetigung)
	);

	async function oeffnen() {
		nochmal = '';
		try {
			const r = await fetch('/bestaetigen/status', { cache: 'no-store' });
			const s = (await r.json()) as { bis: string | null; wege: BestaetigungsWege | null };
			// Inzwischen bestätigt (z. B. in einem anderen Tab): gleich noch einmal senden
			if (s.bis) return bestaetigt(s.bis);
			wege = s.wege;
		} catch {
			wege = null;
		}
		offen = true;
		if (!dialog?.open) dialog?.showModal();
	}

	function schliessen() {
		offen = false;
		dialog?.close();
	}

	let nochmal = $state('');

	function bestaetigt(bis?: string) {
		const z = letzte;
		letzte = null;
		if (z?.form.isConnected) {
			schliessen();
			z.form.requestSubmit(z.submitter ?? undefined);
			return;
		}
		// Formular gibt es nicht mehr (z. B. Rückfrage geschlossen): selbst noch einmal
		nochmal = bis ? `Bestätigt bis ${bisUhrzeit(bis)} Uhr.` : 'Bestätigt.';
		offen = true;
		if (!dialog?.open) dialog?.showModal();
	}

	/** Microsoft-Anmeldung im eigenen Fenster; ohne Fenster in diesem Tab */
	function microsoft(href: string): boolean {
		const f = window.open(href, 'intranet-bestaetigen', 'popup,width=520,height=720');
		if (!f) location.href = `/anmelden/entra?bestaetigen=1&ziel=${encodeURIComponent(hier)}`;
		return true;
	}

	async function nachfragen() {
		if (!offen) return;
		try {
			const r = await fetch('/bestaetigen/status', { cache: 'no-store' });
			const s = (await r.json()) as { bis: string | null };
			if (s.bis) bestaetigt(s.bis);
		} catch {
			/* später noch einmal */
		}
	}

	$effect(() => {
		// Jede neue Ablehnung (neues page.form) öffnet den Dialog
		const f = page.form as { bestaetigung?: boolean } | null;
		if (f?.bestaetigung) untrack(() => oeffnen());
	});

	onMount(() => {
		const merken = (e: SubmitEvent) => {
			if (e.target instanceof HTMLFormElement && !e.target.closest('.bestaetigen-dialog'))
				letzte = { form: e.target, submitter: e.submitter };
		};
		document.addEventListener('submit', merken, true);
		let kanal: BroadcastChannel | null = null;
		try {
			kanal = new BroadcastChannel(BESTAETIGUNG_KANAL);
			kanal.onmessage = (e: MessageEvent<{ bis?: string }>) => offen && bestaetigt(e.data?.bis);
		} catch {
			/* ohne BroadcastChannel: beim Zurückkehren nachfragen */
		}
		window.addEventListener('focus', nachfragen);
		return () => {
			document.removeEventListener('submit', merken, true);
			window.removeEventListener('focus', nachfragen);
			kanal?.close();
		};
	});
</script>

{#if verlangt}
	<noscript>
		<p class="meldung warnung">
			Bitte bestätige zuerst deine Anmeldung:
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- oben mit resolve() gebaut -->
			<a href={seite}>Anmeldung bestätigen</a>
		</p>
	</noscript>
{/if}

<dialog
	bind:this={dialog}
	class="bestaetigen-dialog"
	aria-labelledby="bestaetigen-titel"
	onclose={() => (offen = false)}
>
	<div class="kopf">
		<h2 id="bestaetigen-titel">Anmeldung bestätigen</h2>
		<button type="button" class="linkknopf" onclick={schliessen}>Abbrechen</button>
	</div>
	{#if offen}
		{#if nochmal}
			<p class="meldung" role="status">{nochmal} Führe deine Änderung bitte noch einmal aus.</p>
			<button type="button" class="knopf" onclick={schliessen}>Schließen</button>
		{:else if wege}
			<BestaetigenFormular
				{wege}
				ziel={hier}
				dialog
				onbestaetigt={bestaetigt}
				onmicrosoft={microsoft}
			/>
		{:else}
			<p class="meldung fehler" role="alert">
				Das hat nicht geklappt.
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- oben mit resolve() gebaut -->
				<a href={seite}>Anmeldung auf eigener Seite bestätigen</a>
			</p>
		{/if}
	{/if}
</dialog>

<style>
	.bestaetigen-dialog {
		width: min(28rem, calc(100vw - 32px));
		border: 1px solid var(--bd);
		border-radius: 16px;
		padding: 20px;
		background: var(--sf);
		color: inherit;
		box-shadow: 0 12px 40px rgb(0 0 0 / 0.25);
	}
	.bestaetigen-dialog::backdrop {
		background: rgb(0 0 0 / 0.45);
	}
	.kopf {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
		margin-bottom: 12px;
	}
	.kopf h2 {
		margin: 0;
		font-size: 1.2rem;
	}
</style>
