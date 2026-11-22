<script lang="ts">
	/** Hub-Seite, Reiter „Neues“ */
	import { resolve } from '$app/paths';
	import HubBeitraege from '#lib/components/hub/HubBeitraege.svelte';
	import HubLeer from '#lib/components/hub/HubLeer.svelte';
	import { reiterVon } from '#lib/hub-seite.ts';

	let { data } = $props();
	const h = $derived(data.hub);
	const r = $derived(reiterVon(data, 'neues'));
	const schreiben = $derived(`${resolve('/(app)/neuigkeiten/neu')}?absender=${h.id}`);
</script>

<svelte:head><title>Neues · {h.name} · Hubs · Intranet</title></svelte:head>

<section class="stapel" aria-labelledby="h-n">
	<div class="kopfzeile">
		<h2 id="h-n">Neues zum Thema</h2>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- aus resolve() gebaut -->
		{#if r.pflegbar && data.beitraege.length}<a class="knopf zweit" href={schreiben}>
				Beitrag schreiben
			</a>{/if}
	</div>
	{#if data.beitraege.length}
		<HubBeitraege beitraege={data.beitraege} />
		{#if data.weitere}<p class="hinweis">Hier stehen die 50 neuesten Beiträge.</p>{/if}
	{:else}
		<HubLeer
			titel="Noch keine Beiträge"
			text="Hier erscheinen Neuigkeiten zu diesem Thema, sobald das Hub-Team etwas veröffentlicht."
			aktion={r.pflegbar ? { href: schreiben, label: 'Beitrag schreiben' } : null}
		/>
	{/if}
</section>

<style>
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 8px 12px;
	}
	h2 {
		margin: 0;
		font-size: 20px;
	}
</style>
