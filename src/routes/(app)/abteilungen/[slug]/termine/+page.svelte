<script lang="ts">
	/** Abteilungsseite, Reiter „Termine“ */
	import { resolve } from '$app/paths';
	import HubLeer from '#lib/components/hub/HubLeer.svelte';
	import HubTermine from '#lib/components/hub/HubTermine.svelte';
	import { abteilungReiterVon } from '#lib/abteilung-seite.ts';

	let { data } = $props();
	const h = $derived(data.einheit);
	const r = $derived(abteilungReiterVon(data, 'termine'));
	const anlegen = $derived(`${resolve('/(app)/kalender/neu')}?absender=${h.id}`);
</script>

<svelte:head><title>Termine · {h.name} · Abteilungen · Intranet</title></svelte:head>

{#if h.termine.length}
	<section class="karte" aria-labelledby="h-t">
		<div class="kopfzeile">
			<h2 id="h-t">Anstehende Termine</h2>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- aus resolve() gebaut -->
			{#if r.pflegbar}<a class="klein-link" href={anlegen}>Termin anlegen</a>{/if}
		</div>
		<HubTermine termine={h.termine} />
	</section>
{:else}
	<HubLeer
		titel="Keine anstehenden Termine"
		text="Hier erscheinen Sprechstunden, Schulungen und andere Termine der Abteilung."
		aktion={r.pflegbar ? { href: anlegen, label: 'Termin anlegen' } : null}
	/>
{/if}

<style>
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 6px 10px;
		margin-bottom: 6px;
	}
	h2 {
		margin: 0;
		font-size: 20px;
	}
	.klein-link {
		font-size: 14px;
		font-weight: 600;
	}
</style>
