<script lang="ts">
	import { resolve } from '$app/paths';
	import TerminFormular from '#lib/components/TerminFormular.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Termin anlegen · Kalender · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/kalender')}>← Kalender</a>
	<h1>Termin anlegen</h1>
	{#key form}
		<form method="POST" class="karte felder">
			<TerminFormular
				einheiten={data.einheiten}
				mandanten={data.mandanten}
				werte={form?.werte ?? data.werte}
				fehler={form?.fehler ?? {}}
			/>
			<div class="aktionen">
				<button class="knopf" type="submit">Speichern</button>
				<a class="knopf zweit" href={resolve('/(app)/kalender')}>Abbrechen</a>
			</div>
		</form>
	{/key}
</div>

<style>
	.schmal {
		max-width: 760px;
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
