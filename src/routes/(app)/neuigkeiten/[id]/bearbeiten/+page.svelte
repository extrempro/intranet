<script lang="ts">
	import { resolve } from '$app/paths';
	import Beitragsformular from '#lib/components/Beitragsformular.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Beitrag bearbeiten · Neuigkeiten · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/neuigkeiten/[id]', { id: data.id })}>
		← Zurück zum Beitrag
	</a>
	<h1>Beitrag bearbeiten</h1>
	<form method="POST" class="felder">
		{#key form}
			<Beitragsformular
				pruefenNurBeiAenderung
				werte={form?.werte ?? data.werte}
				einheiten={data.einheiten}
				mandanten={data.mandanten}
				fehler={form?.fehler ?? {}}
				pinKonflikt={form?.pinKonflikt ?? null}
				umfrageGesperrt={data.umfrageGesperrt}
				regeln={data.regeln}
				knopf="Speichern"
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
