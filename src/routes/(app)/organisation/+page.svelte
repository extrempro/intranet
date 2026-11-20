<script lang="ts">
	import Bereichsliste from '#lib/components/Bereichsliste.svelte';
	import Bereichssuche from '#lib/components/Bereichssuche.svelte';
	import { navAreas } from '#lib/nav.ts';

	let { data } = $props();
	const bereich = navAreas().find((a) => a.key === 'organisation')!;
	const zeilen = $derived(bereich.pages.map((p) => ({ ...p, text: data.texte[p.key] ?? p.text })));
</script>

<svelte:head><title>Organisation · Intranet</title></svelte:head>

<div class="stapel">
	<h1>Organisation</h1>
	<Bereichssuche label="Personen und Themen suchen" platzhalter="Wen suchst du? Name oder Thema" />
	<Bereichsliste {zeilen} />
</div>

<style>
	.stapel {
		gap: 16px;
	}
</style>
