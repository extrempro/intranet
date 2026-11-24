<script lang="ts">
	/** Abteilungsseite, Reiter „Dokumente“ */
	import { resolve } from '$app/paths';
	import HubDokumente from '#lib/components/hub/HubDokumente.svelte';
	import HubLeer from '#lib/components/hub/HubLeer.svelte';
	import { abteilungReiterVon } from '#lib/abteilung-seite.ts';

	let { data } = $props();
	const h = $derived(data.einheit);
	const r = $derived(abteilungReiterVon(data, 'dokumente'));
	const pflegen = $derived(
		`${resolve('/(app)/abteilungen/[slug]/bearbeiten', { slug: h.slug })}#dokumente`
	);
</script>

<svelte:head><title>Dokumente · {h.name} · Abteilungen · Intranet</title></svelte:head>

{#if h.dokumente.length}
	<section class="karte" aria-labelledby="h-d">
		<div class="kopfzeile">
			<h2 id="h-d">Dokumente und Anleitungen</h2>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- aus resolve() gebaut -->
			{#if r.pflegbar}<a class="klein-link" href={pflegen}>Dokumente pflegen</a>{/if}
		</div>
		<HubDokumente dokumente={h.dokumente} ordner={h.ordner} />
	</section>
{:else}
	<HubLeer
		titel="Noch keine Dokumente"
		text="Hier findest du Anleitungen, Formulare und Pläne der Abteilung, sobald sie sie ablegt."
		aktion={r.pflegbar ? { href: pflegen, label: 'Erstes Dokument anlegen' } : null}
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
