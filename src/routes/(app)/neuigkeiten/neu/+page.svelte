<script lang="ts">
	import { resolve } from '$app/paths';
	import Beitragsformular from '#lib/components/Beitragsformular.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Beitrag erstellen · Neuigkeiten · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/neuigkeiten')}>← Neuigkeiten</a>
	<h1>Beitrag erstellen</h1>
	<form method="POST" class="felder">
		{#key form}
			<Beitragsformular
				werte={form?.werte ?? data.werte}
				einheiten={data.einheiten}
				mandanten={data.mandanten}
				fehler={form?.fehler ?? {}}
				pinKonflikt={form?.pinKonflikt ?? null}
				regeln={data.regeln}
				knopf="Speichern und freigeben"
			/>
		{/key}
	</form>
</div>

<style>
	.seite {
		max-width: 48rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
</style>
