<script lang="ts">
	import { resolve } from '$app/paths';
	import NeuesPasswort from '#lib/components/NeuesPasswort.svelte';

	let { data, form } = $props();
</script>

<svelte:head>
	<title>Neues Passwort · Intranet</title>
</svelte:head>

<div class="stapel">
	{#if !data.gueltig}
		<h1>Link abgelaufen</h1>
		<p>Dieser Link gilt nicht mehr – entweder ist er abgelaufen oder er wurde schon benutzt.</p>
		<a class="knopf" href={resolve('/(auth)/anmelden/passwort-vergessen')}>Neuen Link anfordern</a>
	{:else}
		<h1>Neues Passwort</h1>
		<p>
			Leg ein neues Passwort fest. Danach meldest du dich wie gewohnt mit deinem zweiten Faktor an.
		</p>
		<form method="POST" class="felder">
			{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
			<NeuesPasswort min={data.min} email={data.email} />
			<button class="knopf" type="submit">Passwort speichern</button>
		</form>
	{/if}
</div>

<style>
	h1 {
		font-size: 24px;
		margin: 0;
	}
</style>
