<script lang="ts">
	/** Abteilungsseite, Reiter „Intern“ (Kap. 8.17): nur für das Team */
	import { resolve } from '$app/paths';
	import HubBeitraege from '#lib/components/hub/HubBeitraege.svelte';
	import HubDokumente from '#lib/components/hub/HubDokumente.svelte';
	import HubTermine from '#lib/components/hub/HubTermine.svelte';

	let { data } = $props();
	const h = $derived(data.einheit);
	const schreiben = $derived(`${resolve('/(app)/neuigkeiten/neu')}?absender=${h.id}&sicht=team`);
	const terminAnlegen = $derived(`${resolve('/(app)/kalender/neu')}?absender=${h.id}&sicht=team`);
	const dokumentePflegen = $derived(
		h.canManage || h.canAdminister
			? `${resolve('/(app)/abteilungen/[slug]/bearbeiten', { slug: h.slug })}#dokumente`
			: resolve('/(app)/abteilungen/[slug]/dokumente-pflegen', { slug: h.slug })
	);
	const leer = $derived(
		!data.beitraege.length && !data.termine.length && !h.internDokumente.length
	);
</script>

<svelte:head><title>Intern · {h.name} · Abteilungen · Intranet</title></svelte:head>

<p class="hinweis intern-hinweis">
	Nur für das Team {h.name}: Mitglieder, Leitung und Stellvertretung. Alle anderen sehen diesen
	Bereich nicht, auch nicht die Redaktion.
</p>

{#if leer}
	<section class="karte stapel eng">
		<h2>Noch nichts Internes</h2>
		<p class="hinweis">
			Hier stehen Beiträge, Termine und Ordner, die nur für euer Team bestimmt sind. Wähle beim
			Schreiben „Nur für unser Team“.
		</p>
		<div class="aktionen">
			<!-- eslint-disable svelte/no-navigation-without-resolve -- aus resolve() gebaut -->
			{#if h.canPost}<a class="knopf" href={schreiben}>Internen Beitrag schreiben</a>{/if}
			{#if h.canEvents}<a class="knopf zweit" href={terminAnlegen}>Internen Termin anlegen</a>{/if}
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	</section>
{:else}
	<section class="stapel" aria-labelledby="h-ib">
		<div class="kopfzeile">
			<h2 id="h-ib">Beiträge</h2>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- aus resolve() gebaut -->
			{#if h.canPost}<a class="knopf zweit" href={schreiben}>Internen Beitrag schreiben</a>{/if}
		</div>
		{#if data.beitraege.length}
			<HubBeitraege beitraege={data.beitraege} />
		{:else}
			<p class="hinweis">Noch keine internen Beiträge.</p>
		{/if}
	</section>

	<section class="karte" aria-labelledby="h-it">
		<div class="kopfzeile">
			<h2 id="h-it">Termine</h2>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- aus resolve() gebaut -->
			{#if h.canEvents}<a class="klein-link" href={terminAnlegen}>Internen Termin anlegen</a>{/if}
		</div>
		{#if data.termine.length}
			<HubTermine termine={data.termine} />
		{:else}
			<p class="hinweis">Keine anstehenden internen Termine.</p>
		{/if}
	</section>

	<section class="karte" aria-labelledby="h-id">
		<div class="kopfzeile">
			<h2 id="h-id">Dokumente</h2>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- aus resolve() gebaut -->
			{#if h.canDocs}<a class="klein-link" href={dokumentePflegen}>Dokumente pflegen</a>{/if}
		</div>
		{#if h.internDokumente.length}
			<HubDokumente dokumente={h.internDokumente} ordner={h.internOrdner} />
		{:else}
			<p class="hinweis">
				Noch keine internen Ordner. Beim Pflegen der Dokumente kannst du Ordner als „nur für das
				Team“ markieren.
			</p>
		{/if}
	</section>
{/if}

<style>
	.intern-hinweis {
		margin: 0;
	}
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 6px 12px;
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
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
