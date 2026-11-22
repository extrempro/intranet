<script lang="ts">
	import { resolve } from '$app/paths';
	import FaqFormular from '#lib/components/FaqFormular.svelte';
	import ThemaVorschlag from '#lib/components/ThemaVorschlag.svelte';
	import MitFrage from '#lib/components/MitFrage.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>FAQ bearbeiten · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href="{resolve('/(app)/faqs')}?einheit={data.werte.unitId}">← FAQs</a>
	<h1>FAQ bearbeiten</h1>
	{#if form && 'loeschFehler' in form}
		<p class="meldung fehler" role="alert">{form.loeschFehler}</p>
	{/if}
	{#key form}
		<form method="POST" action="?/speichern" class="felder karte">
			<FaqFormular
				einheiten={data.einheiten}
				themen={data.themen}
				werte={form && 'werte' in form && form.werte ? form.werte : data.werte}
				fehler={form && 'fehler' in form && form.fehler ? form.fehler : {}}
			/>
			<div class="aktionen">
				<button class="knopf" type="submit">Speichern</button>
				<a class="knopf zweit" href="{resolve('/(app)/faqs')}?einheit={data.werte.unitId}">
					Abbrechen
				</a>
			</div>
		</form>
	{/key}
	<ThemaVorschlag />

	<section class="karte">
		<MitFrage
			action="?/loeschen"
			knopf="FAQ löschen"
			frage={{
				titel: 'FAQ löschen?',
				text: 'Die FAQ wird samt Anhängen endgültig gelöscht.',
				ja: 'Löschen',
				gefahr: true
			}}
		/>
	</section>
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
		align-items: center;
	}
</style>
