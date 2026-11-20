<script lang="ts">
	let { data, form } = $props();

	const optionen = [
		{ wert: '30m', text: '30 Minuten' },
		{ wert: '8h', text: '8 Stunden (Standard)' },
		{ wert: '7d', text: '7 Tage' }
	];
</script>

<svelte:head>
	<title>Anmeldung · Verwaltung · Intranet</title>
</svelte:head>

<div class="stapel seite">
	<h1>Anmeldung</h1>

	<form method="POST" class="felder">
		{#if form?.gespeichert}<p class="meldung" role="status">Gespeichert.</p>{/if}
		{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
		<fieldset>
			<legend>Abmelden nach Inaktivität</legend>
			<p class="hinweis">
				Gilt für alle Anmeldungen (Microsoft und lokal). Unabhängig davon endet jede Sitzung
				spätestens nach 30 Tagen.
			</p>
			<div role="radiogroup" aria-label="Abmelden nach Inaktivität">
				{#each optionen as o (o.wert)}
					<label class="option">
						<input type="radio" name="idle" value={o.wert} checked={data.idle === o.wert} />
						{o.text}
					</label>
				{/each}
			</div>
		</fieldset>
		<button class="knopf" type="submit">Speichern</button>
	</form>
</div>

<style>
	.seite {
		max-width: 40rem;
	}
	fieldset {
		border: 1px solid var(--bd);
		border-radius: var(--radius);
		padding: 1rem;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
	}
	.option input {
		width: 1.25rem;
		height: 1.25rem;
		accent-color: var(--fill);
	}
</style>
