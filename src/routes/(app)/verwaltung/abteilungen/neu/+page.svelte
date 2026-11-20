<script lang="ts">
	import EinheitFelder from '#lib/components/EinheitFelder.svelte';

	let { data, form } = $props();
	const leer = {
		tenantId: '',
		type: 'abteilung' as const,
		name: '',
		title: null,
		isCentral: false,
		hidden: false,
		mayPostUrgent: null,
		isKbb: false
	};
</script>

<svelte:head><title>Einheit anlegen · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<h1>Einheit anlegen</h1>
	<p class="hinweis">Typ und Mandant lassen sich später nicht mehr ändern.</p>
	<form method="POST" class="felder">
		{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
		<EinheitFelder werte={form?.werte ?? leer} mandanten={data.mandanten} neu />
		<button class="knopf" type="submit">Anlegen</button>
	</form>
</div>

<style>
	.seite {
		max-width: 40rem;
	}
	.knopf {
		justify-self: start;
	}
</style>
