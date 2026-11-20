<script lang="ts">
	import { resolve } from '$app/paths';
	import StandortWahl from '#lib/components/StandortWahl.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Meine Standorte · Konto · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/konto')}>← Konto</a>
	<h1>Meine Standorte</h1>
	{#if form?.gespeichert}<p class="meldung" role="status">Gespeichert.</p>{/if}
	{#if data.alle.length === 0}
		<p class="hinweis">Es ist noch kein Kantinen-Standort eingerichtet.</p>
	{:else}
		<section class="karte">
			<StandortWahl alle={data.alle} meine={data.meine} />
		</section>
	{/if}
</div>

<style>
	.schmal {
		max-width: 720px;
	}
	h1 {
		margin: 0;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
</style>
