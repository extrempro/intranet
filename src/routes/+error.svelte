<script lang="ts">
	/** Fehlerseite außerhalb der Bereiche (z. B. unbekannte Adressen, Anmeldung, Teams) */
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { fehlerText, fehlerTitel } from '#lib/fehler.ts';

	const titel = $derived(fehlerTitel(page.status));
	const zusatz = $derived(fehlerText(page.error?.message, titel));
</script>

<svelte:head><title>{titel} · Intranet</title></svelte:head>

<main class="fehlerseite stapel" id="inhalt">
	<h1>{titel}</h1>
	{#if zusatz}
		<p>{zusatz}</p>
	{/if}
	<p class="hinweis">Fehlercode {page.status}</p>
	<p><a href={resolve('/(app)')}>Zur Startseite</a></p>
</main>

<style>
	.fehlerseite {
		max-width: 32rem;
		margin: 15vh auto 0;
		padding: 0 20px;
	}
</style>
