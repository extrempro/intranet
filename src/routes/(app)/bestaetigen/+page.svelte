<script lang="ts">
	import { goto } from '$app/navigation';
	import BestaetigenFormular from '#lib/components/BestaetigenFormular.svelte';
	import { bisUhrzeit } from '#lib/bestaetigung.ts';

	let { data, form } = $props();

	const fehler = $derived(
		form?.codeFehler ??
			(data.fehler ? 'Die Bestätigung hat nicht geklappt. Versuch es noch einmal.' : '')
	);
</script>

<svelte:head>
	<title>Anmeldung bestätigen · Intranet</title>
</svelte:head>

<div class="stapel">
	<h1>Anmeldung bestätigen</h1>
	<p class="hinweis">
		Rollen vergeben, Personen sperren und Einstellungen zur Anmeldung und zum E-Mail-Versand ändern
		geht nur nach einer erneuten Anmeldung. So kann niemand mit einer fremden, offen gelassenen
		Sitzung diese Rechte nutzen.
	</p>
	{#if data.bis}
		<p class="meldung" role="status">Bestätigt bis {bisUhrzeit(data.bis)} Uhr.</p>
		<a class="knopf" href={data.ziel}>Weiter</a>
	{:else if data.wege}
		<BestaetigenFormular
			wege={data.wege}
			ziel={data.ziel}
			{fehler}
			onbestaetigt={() => goto(data.ziel, { invalidateAll: true })}
		/>
	{/if}
</div>
