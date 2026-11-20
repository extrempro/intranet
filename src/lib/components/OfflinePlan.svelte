<script lang="ts">
	/** „Offline speichern“ für einen Plan (Kap. 8.6). */
	import { onMount } from 'svelte';
	import {
		offlineMoeglich,
		offlinePlaene,
		planOfflineEntfernen,
		planOfflineSpeichern
	} from '#lib/offline.ts';

	let {
		plan
	}: { plan: { id: string; fileId: string; title: string; kbb: string; validUntil: string } } =
		$props();

	let moeglich = $state(false);
	let gespeichert = $state<'nein' | 'aktuell' | 'alt'>('nein');
	let arbeitet = $state(false);
	let meldung = $state('');

	async function pruefen() {
		const p = (await offlinePlaene()).find((x) => x.id === plan.id);
		gespeichert = !p ? 'nein' : p.fileId === plan.fileId ? 'aktuell' : 'alt';
	}

	onMount(() => {
		moeglich = offlineMoeglich();
		if (moeglich) void pruefen();
	});

	async function speichern() {
		arbeitet = true;
		meldung = '';
		try {
			await planOfflineSpeichern(plan);
			await pruefen();
			meldung = 'Der Plan ist auf diesem Gerät offline verfügbar.';
		} catch {
			meldung = 'Speichern hat nicht geklappt. Bist du online?';
		} finally {
			arbeitet = false;
		}
	}

	async function entfernen() {
		arbeitet = true;
		await planOfflineEntfernen(plan.id);
		await pruefen();
		meldung = 'Offline-Kopie entfernt.';
		arbeitet = false;
	}
</script>

{#if moeglich}
	<div class="offline" aria-live="polite">
		{#if gespeichert === 'aktuell'}
			<span class="schild">Offline gespeichert</span>
			<button class="linkknopf" type="button" disabled={arbeitet} onclick={entfernen}>
				Offline-Kopie entfernen
			</button>
		{:else}
			{#if gespeichert === 'alt'}
				<span class="schild warnung">Offline-Kopie ist veraltet</span>
			{/if}
			<button class="knopf zweit klein" type="button" disabled={arbeitet} onclick={speichern}>
				{gespeichert === 'alt' ? 'Neue Fassung offline speichern' : 'Offline speichern'}
			</button>
		{/if}
		{#if meldung}<span class="hinweis">{meldung}</span>{/if}
	</div>
{/if}

<style>
	.offline {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
	}
	.klein {
		min-height: 38px;
		padding: 6px 12px;
		font-size: 14px;
	}
	.schild.warnung {
		background: #fdf1dc;
		color: #8a5300;
	}
</style>
