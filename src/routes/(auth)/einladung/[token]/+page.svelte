<script lang="ts">
	import NeuesPasswort from '#lib/components/NeuesPasswort.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Einladung annehmen · Intranet</title>
</svelte:head>

<div class="stapel">
	{#if !data.gueltig}
		<h1>Einladung abgelaufen</h1>
		<p>
			Dieser Link gilt nicht mehr – entweder ist er älter als 7 Tage oder er wurde schon benutzt.
			Bitte die Person, die dich eingeladen hat, um eine neue Einladung.
		</p>
	{:else}
		<h1>Willkommen, {data.name}</h1>
		<p>Leg dein Passwort fest. Danach richtest du noch einen zweiten Faktor ein.</p>

		<form method="POST" class="felder">
			{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
			<NeuesPasswort min={data.min} email={data.email} />
			<button class="knopf" type="submit">Weiter</button>
		</form>
	{/if}
</div>
