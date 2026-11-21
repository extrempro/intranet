<script lang="ts">
	/** Fehlerseite innerhalb des Intranets (Navigation bleibt erhalten) */
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { fehlerText, fehlerTitel } from '#lib/fehler.ts';

	const titel = $derived(fehlerTitel(page.status));
	const zusatz = $derived(fehlerText(page.error?.message, titel));
</script>

<svelte:head><title>{titel} · Intranet</title></svelte:head>

<div class="stapel">
	<h1>{titel}</h1>
	{#if zusatz}
		<p>{zusatz}</p>
	{/if}
	<p class="hinweis">Fehlercode {page.status}</p>
	<p><a href={resolve('/(app)')}>Zur Startseite</a></p>
</div>
