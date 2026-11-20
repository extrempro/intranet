<script lang="ts">
	import { resolve } from '$app/paths';
	import KontoBenachrichtigungen from '#lib/components/konto/KontoBenachrichtigungen.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Benachrichtigungen · Konto · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/konto')}>← Konto</a>
	<h1>Benachrichtigungen</h1>
	<KontoBenachrichtigungen daten={data} {form} />
</div>

<style>
	.schmal {
		max-width: 820px;
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
