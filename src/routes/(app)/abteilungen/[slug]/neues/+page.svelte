<script lang="ts">
	/** Abteilungsseite, Reiter „Neues“ */
	import { resolve } from '$app/paths';
	import HubBeitraege from '#lib/components/hub/HubBeitraege.svelte';
	import HubLeer from '#lib/components/hub/HubLeer.svelte';
	import MehrLaden from '#lib/components/MehrLaden.svelte';
	import { page } from '$app/state';
	import { mitZahl } from '#lib/lange-liste.ts';
	import { abteilungReiterVon } from '#lib/abteilung-seite.ts';

	let { data } = $props();
	const h = $derived(data.einheit);
	const r = $derived(abteilungReiterVon(data, 'neues'));
	const mehrHref = $derived.by(() => {
		const u = new URL(page.url.href);
		u.searchParams.set('anzahl', String(data.anzahl + data.schritt));
		return u.search;
	});
	const schreiben = $derived(`${resolve('/(app)/neuigkeiten/neu')}?absender=${h.id}`);
</script>

<svelte:head><title>Neues · {h.name} · Abteilungen · Intranet</title></svelte:head>

<section class="stapel" aria-labelledby="h-n">
	<div class="kopfzeile">
		<h2 id="h-n">Neues aus {h.name}</h2>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- aus resolve() gebaut -->
		{#if r.pflegbar && data.beitraege.length}<a class="knopf zweit" href={schreiben}>
				Beitrag schreiben
			</a>{/if}
	</div>
	{#if data.beitraege.length}
		<p class="hinweis zaehler">
			{data.beitraege.length} von {mitZahl(data.gesamt, 'Beitrag', 'Beiträgen')}
		</p>
		<HubBeitraege beitraege={data.beitraege} />
		<MehrLaden
			geladen={data.beitraege.length}
			gesamt={data.gesamt}
			schritt={data.schritt}
			href={mehrHref}
			einheit={['Beitrag', 'Beiträge']}
		/>
	{:else}
		<HubLeer
			titel="Noch keine Beiträge"
			text="Hier erscheinen Neuigkeiten der Abteilung, sobald sie etwas veröffentlicht."
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
