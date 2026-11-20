<script lang="ts">
	import { resolve } from '$app/paths';
	import KulissenFormular from '#lib/components/KulissenFormular.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Beitrag erstellen · Hinter den Kulissen · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/hinter-den-kulissen')}>← Hinter den Kulissen</a>
	<h1>Beitrag erstellen</h1>
	{#key form}
		<form method="POST" class="karte felder">
			<KulissenFormular
				einheiten={data.einheiten}
				mandanten={data.mandanten}
				werte={form?.werte ?? data.werte}
				fehler={form?.fehler ?? {}}
			/>
			<div class="aktionen">
				<button class="knopf" type="submit">Veröffentlichen</button>
				<a class="knopf zweit" href={resolve('/(app)/hinter-den-kulissen')}>Abbrechen</a>
			</div>
		</form>
	{/key}
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
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
</style>
