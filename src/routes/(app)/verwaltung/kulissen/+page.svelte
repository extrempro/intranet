<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, form } = $props();
</script>

<svelte:head><title>Hinter den Kulissen · Verwaltung · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/verwaltung')}>← Verwaltung</a>
	<h1>Hinter den Kulissen</h1>
	{#if form?.gespeichert}<p class="meldung" role="status">Gespeichert.</p>{/if}
	<form method="POST" class="karte felder">
		<label class="feld">
			<span>Hinweis „So geht’s“</span>
			<textarea name="text" rows="5" maxlength="1000">{data.text}</textarea>
			<span class="hinweis">
				Erklärt, wie Abteilungen die Funktion freischalten. Leer = Standardtext.
			</span>
		</label>
		<div><button class="knopf" type="submit">Speichern</button></div>
	</form>
	<p class="hinweis">
		Freischalten je Einheit: Verwaltung → Abteilungen und Hubs („Hinter den Kulissen“
		freigeschaltet) oder durch die Abteilungsverwaltung auf der Seite „Hinter den Kulissen“.
	</p>
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
