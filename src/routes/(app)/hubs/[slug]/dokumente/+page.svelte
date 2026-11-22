<script lang="ts">
	/** Hub-Seite, Reiter „Dokumente“ */
	import { resolve } from '$app/paths';
	import HubDokumente from '#lib/components/hub/HubDokumente.svelte';
	import HubLeer from '#lib/components/hub/HubLeer.svelte';
	import { reiterVon } from '#lib/hub-seite.ts';

	let { data } = $props();
	const h = $derived(data.hub);
	const r = $derived(reiterVon(data, 'dokumente'));
	const pflegen = $derived(
		`${resolve('/(app)/hubs/[slug]/bearbeiten', { slug: h.slug })}#dokumente`
	);
</script>

<svelte:head><title>Dokumente · {h.name} · Hubs · Intranet</title></svelte:head>

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
		text="Hier findest du Anleitungen, Formulare und Pläne zu diesem Thema, sobald das Hub-Team sie ablegt."
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
