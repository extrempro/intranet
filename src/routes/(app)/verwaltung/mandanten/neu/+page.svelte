<script lang="ts">
	import { resolve } from '$app/paths';
	import MandantFelder from '#lib/components/MandantFelder.svelte';

	let { form } = $props();
	const leer = { name: '', shortName: '', accent: '#0F6E56', accentDark: '#5DCAA5' };
</script>

<svelte:head><title>Mandant anlegen · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/verwaltung/mandanten')}>← Mandanten</a>
	<h1>Mandant anlegen</h1>
	<p class="hinweis">Domains und Mandanten-Admins trägst du im nächsten Schritt ein.</p>
	<form method="POST" class="felder">
		{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
		{#key form}<MandantFelder werte={form?.werte ?? leer} />{/key}
		<button class="knopf" type="submit">Anlegen</button>
	</form>
</div>

<style>
	.seite {
		max-width: 40rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.knopf {
		justify-self: start;
	}
</style>
