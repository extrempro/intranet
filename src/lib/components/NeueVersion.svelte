<script lang="ts">
	/**
	 * Neue Version des Intranets (Browser und Teams-Reiter):
	 * - Hinweis „Neu laden“, sobald SvelteKit eine neue Version erkennt
	 *   (Seitenwechsel, Rückkehr in den Tab, alle 5 Minuten);
	 * - der nächste Klick auf einen Link lädt die Seite ohnehin frisch;
	 * - nach dem Update einmal „Neu in Version …“ (abschaltbar unter Konto).
	 * Neu geladen wird nie von selbst, damit keine Eingaben verloren gehen.
	 */
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { updated } from '$app/state';
	import { untrack } from 'svelte';

	type Neu = { version: string; titel: string };
	let { neu }: { neu: Neu | null } = $props();
	// Der Server meldet den Hinweis nur einmal; bleibt stehen, bis ausgeblendet
	// oder zu einer anderen Seite gewechselt wird (auch wenn Daten neu laden).
	let hinweis = $state<Neu | null>(untrack(() => neu));
	$effect(() => {
		if (neu) hinweis = neu;
	});
	afterNavigate(({ type }) => {
		if (type !== 'enter' && !neu) hinweis = null;
	});

	beforeNavigate(({ willUnload, to }) => {
		if (updated.current && !willUnload && to?.url) location.href = to.url.href;
	});
</script>

{#if updated.current}
	<div class="meldung zeile" role="status">
		<p>Es gibt eine neue Version des Intranets.</p>
		<button class="knopf zweit klein" type="button" onclick={() => location.reload()}>
			Neu laden
		</button>
	</div>
{:else if hinweis}
	<div class="meldung zeile" role="status">
		<p>
			Neu in Version {hinweis.version}: {hinweis.titel}.
			<a href={resolve('/(app)/neu-im-intranet')}>Was ist neu?</a>
		</p>
		<button
			class="linkknopf"
			type="button"
			aria-label="Hinweis ausblenden"
			onclick={() => (hinweis = null)}
		>
			Ausblenden
		</button>
	</div>
{/if}

<style>
	.zeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 16px;
	}
	p {
		margin: 0;
	}
	.klein {
		min-height: 38px;
		padding: 6px 12px;
		font-size: 14px;
	}
</style>
