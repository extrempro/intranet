<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import { RETENTION_FIELDS, RETENTION_FIXED } from '#lib/rules-config.ts';

	let { data, form } = $props();
	const fehler = $derived<Record<string, string>>(
		form && 'fehler' in form ? (form.fehler ?? {}) : {}
	);
	const behalten: SubmitFunction =
		() =>
		async ({ update }) =>
			update({ reset: false });
</script>

<svelte:head><title>Löschfristen · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/verwaltung')}>← Verwaltung</a>
	<h1>Löschfristen</h1>
	<p class="hinweis">
		Gelten für alle Mandanten. Gelöscht wird beim stündlichen Aufräumen.
		{data.darfAendern ? '' : 'Ändern können nur System-Admins.'}
	</p>
	{#if form && 'gespeichert' in form}<p class="meldung" role="status">Gespeichert.</p>{/if}
	{#if Object.keys(fehler).length}
		<p class="meldung fehler" role="alert">Bitte prüfe die markierten Felder.</p>
	{/if}

	<form method="POST" class="karte stapel" use:enhance={behalten}>
		<fieldset class="liste" disabled={!data.darfAendern}>
			<legend class="sr-only">Einstellbare Fristen</legend>
			{#each RETENTION_FIELDS as f (f.key)}
				<label class="zeile">
					<span>
						<strong>{f.label}</strong>
						{#if f.hint}<br /><span class="hinweis">{f.hint}</span>{/if}
						{#if fehler[f.key]}<br /><span class="feldfehler">{fehler[f.key]}</span>{/if}
					</span>
					<select name={f.key} value={String(data.fristen[f.key])}>
						{#each f.options as o (o.value)}
							<option value={String(o.value)}>
								{o.label}{o.value === f.default ? ' (Standard)' : ''}
							</option>
						{/each}
					</select>
				</label>
			{/each}
		</fieldset>
		{#if data.darfAendern}<button class="knopf" type="submit">Fristen speichern</button>{/if}
	</form>

	<section class="karte stapel" aria-labelledby="h-fest">
		<h2 id="h-fest">Feste Fristen</h2>
		<dl class="liste">
			{#each RETENTION_FIXED as r (r.label)}
				<div class="zeile">
					<dt>{r.label}</dt>
					<dd>{r.value}</dd>
				</div>
			{/each}
		</dl>
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
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.liste {
		display: grid;
		margin: 0;
	}
	.zeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 8px 16px;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.zeile:first-of-type {
		border-top: 0;
	}
	select {
		min-width: 11rem;
	}
	dd {
		margin: 0;
		color: var(--mu);
	}
	.feldfehler {
		color: var(--err-tx);
		font-size: 0.93rem;
		font-weight: 600;
	}
</style>
