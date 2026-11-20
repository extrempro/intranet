<script lang="ts">
	import Bereichsliste from '#lib/components/Bereichsliste.svelte';
	import Bereichssuche from '#lib/components/Bereichssuche.svelte';
	import { navAreas } from '#lib/nav.ts';

	let { data } = $props();
	const bereich = navAreas().find((a) => a.key === 'wissen')!;
	const zeilen = $derived(bereich.pages.map((p) => ({ ...p, text: data.texte[p.key] ?? p.text })));
</script>

<svelte:head><title>Wissen · Intranet</title></svelte:head>

<div class="stapel">
	<h1>Wissen</h1>
	<Bereichssuche label="Im Wissen suchen" platzhalter="Frage stellen, z. B. Urlaub beantragen" />
	<Bereichsliste {zeilen} />
</div>

<style>
	.stapel {
		gap: 16px;
	}
</style>
