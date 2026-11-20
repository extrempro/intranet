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

<section class="karte" aria-labelledby="titel">
	<h1 id="titel">Anmeldung</h1>

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
</section>

<style>
	.karte {
		max-width: 36rem;
		margin: 3rem auto;
		padding: 0 1rem;
	}
	.felder {
		display: grid;
		gap: 1rem;
	}
	fieldset {
		border: 1px solid #767676;
		border-radius: 0.75rem;
		padding: 1rem;
	}
	legend {
		font-weight: 600;
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
	}
	.knopf {
		min-height: 44px;
		padding: 0 1.25rem;
		border-radius: 999px;
		background: var(--akzent, #1f4f8f);
		color: #fff;
		font: inherit;
		font-weight: 600;
		border: 0;
		cursor: pointer;
		justify-self: start;
	}
	:focus-visible {
		outline: 3px solid #1f4f8f;
		outline-offset: 2px;
	}
	.meldung {
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		background: #eef3fb;
		color: #10233f;
	}
	.meldung.fehler {
		background: #fdecec;
		color: #6b1010;
	}
</style>
