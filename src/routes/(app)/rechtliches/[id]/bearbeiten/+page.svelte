<script lang="ts">
	import MitFrage from '#lib/components/MitFrage.svelte';
	import { resolve } from '$app/paths';
	import VereinbarungFormular from '#lib/components/VereinbarungFormular.svelte';

	let { data, form } = $props();
	const werte = $derived(form?.werte ?? data.werte);
</script>

<svelte:head><title>Vereinbarung bearbeiten · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/rechtliches/[id]', { id: data.id })}>
		← Zur Vereinbarung
	</a>
	<h1>Vereinbarung bearbeiten</h1>
	<p class="hinweis">
		Für eine neue Fassung ersetzt du die Dokumente und passt Stand und „gilt ab“ an. Frühere
		Fassungen werden nicht aufbewahrt: Entfernte Dokumente werden beim Speichern gelöscht.
	</p>
	{#if form?.fehler}<p class="meldung fehler" role="alert">
			Bitte prüfe die markierten Felder.
		</p>{/if}
	<form method="POST" action="?/speichern" class="karte stapel">
		{#key werte}
			<VereinbarungFormular {werte} mandanten={data.mandanten} fehler={form?.fehler} neu={false} />
		{/key}
		<label class="option">
			<input type="checkbox" name="bekanntgeben" />
			Als neue Fassung bekanntgeben (alle im Mandanten werden benachrichtigt)
		</label>
		<button class="knopf" type="submit">Speichern</button>
	</form>
	<section class="karte stapel">
		<p class="hinweis">Löschen entfernt die Vereinbarung und alle Dokumente endgültig.</p>
		<div>
			<MitFrage
				action="?/loeschen"
				knopf="Vereinbarung löschen"
				knopfKlasse="knopf rot"
				frage={{
					titel: 'Vereinbarung löschen?',
					text: 'Die Vereinbarung und alle Dokumente werden endgültig gelöscht.',
					ja: 'Löschen',
					gefahr: true
				}}
			/>
		</div>
	</section>
</div>

<style>
	.seite {
		max-width: 44rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h1 {
		margin: 0;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
	}
	.option input {
		width: 20px;
		height: 20px;
		flex: none;
		accent-color: var(--fill);
	}
</style>
