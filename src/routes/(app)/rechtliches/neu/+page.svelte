<script lang="ts">
	import { resolve } from '$app/paths';
	import VereinbarungFormular from '#lib/components/VereinbarungFormular.svelte';

	let { data, form } = $props();
	const werte = $derived(form?.werte ?? data.werte);
</script>

<svelte:head><title>Vereinbarung einstellen · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/rechtliches')}>← Rechtliches</a>
	<h1>Vereinbarung einstellen</h1>
	<p class="hinweis">
		Alle im Mandanten werden benachrichtigt. Es gibt keine Entwürfe: Die Vereinbarung ist sofort
		sichtbar.
	</p>
	{#if form?.fehler}<p class="meldung fehler" role="alert">
			Bitte prüfe die markierten Felder.
		</p>{/if}
	<form method="POST" class="karte stapel">
		{#key werte}
			<VereinbarungFormular {werte} mandanten={data.mandanten} fehler={form?.fehler} neu />
		{/key}
		<button class="knopf" type="submit">Einstellen</button>
	</form>
</div>

<style>
	.seite {
		max-width: 44rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h1 {
		margin: 0;
	}
</style>
