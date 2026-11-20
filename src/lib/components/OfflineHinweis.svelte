<script lang="ts">
	/**
	 * Hinweise zur Verbindung (Kap. 8.6): „Du bist offline“ und nach dem
	 * Wiederverbinden, ob sich offline gespeicherte Pläne geändert haben.
	 */
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import {
		geaenderteOfflinePlaene,
		offlineMoeglich,
		planOfflineEntfernen,
		planOfflineSpeichern,
		type PlanAenderung
	} from '#lib/offline.ts';

	let online = $state(true);
	let aenderungen = $state<PlanAenderung[]>([]);
	let arbeitet = $state(false);

	async function pruefen() {
		if (!offlineMoeglich() || !navigator.onLine) return;
		try {
			aenderungen = await geaenderteOfflinePlaene();
		} catch {
			// später erneut
		}
	}

	onMount(() => {
		online = navigator.onLine;
		void pruefen();
		const an = () => {
			online = true;
			void pruefen();
		};
		const aus = () => (online = false);
		addEventListener('online', an);
		addEventListener('offline', aus);
		return () => {
			removeEventListener('online', an);
			removeEventListener('offline', aus);
		};
	});

	async function aktualisieren() {
		arbeitet = true;
		for (const a of aenderungen) {
			if (a.neu)
				await planOfflineSpeichern({
					id: a.plan.id,
					fileId: a.neu.fileId,
					title: a.neu.title,
					kbb: a.plan.kbb,
					validUntil: a.neu.validUntil
				}).catch(() => {});
			else await planOfflineEntfernen(a.plan.id);
		}
		aenderungen = [];
		arbeitet = false;
	}
</script>

{#if !online}
	<p class="meldung offline" role="status">
		Du bist offline. Offline gespeicherte Pläne kannst du trotzdem öffnen.
	</p>
{/if}
{#if online && aenderungen.length}
	<div class="meldung" role="status">
		<p>
			{aenderungen.length === 1
				? 'Ein offline gespeicherter Plan hat sich geändert:'
				: `${aenderungen.length} offline gespeicherte Pläne haben sich geändert:`}
		</p>
		<ul>
			{#each aenderungen as a (a.plan.id)}
				<li>
					{#if a.neu}
						<a href={resolve('/(app)/plaene/[id]', { id: a.plan.id })}>{a.neu.title}</a> – neue Fassung
					{:else}
						{a.plan.title} – gibt es nicht mehr
					{/if}
				</li>
			{/each}
		</ul>
		<button class="knopf zweit klein" type="button" disabled={arbeitet} onclick={aktualisieren}>
			Offline-Kopien aktualisieren
		</button>
	</div>
{/if}

<style>
	p,
	ul {
		margin: 0;
	}
	ul {
		padding-left: 1.2em;
		margin: 4px 0 8px;
	}
	.offline {
		background: #fdf1dc;
		color: #6b4100;
	}
	.klein {
		min-height: 38px;
		padding: 6px 12px;
		font-size: 14px;
	}
</style>
