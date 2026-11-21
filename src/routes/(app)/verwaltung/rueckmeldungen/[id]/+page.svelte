<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { FEEDBACK_STATUS } from '#lib/feedback.ts';

	let { data, form } = $props();
	const r = $derived(data.r);
	let w = $state(untrack(() => ({ stand: data.r.status as string, antwort: data.r.answer ?? '' })));
	const zeit = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Europe/Berlin'
	});
</script>

<svelte:head><title>Rückmeldung · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/verwaltung/rueckmeldungen')}>← Rückmeldungen</a>
	<div>
		<h1>{r.kind === 'fehler' ? 'Fehler' : 'Idee'}</h1>
		<p class="hinweis">
			{r.author ?? 'Gelöschtes Konto'} · {r.tenant} · {zeit.format(r.createdAt)}
			{#if r.page}· Seite <a href={r.page}>{r.page}</a>{/if}
		</p>
	</div>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'gespeichert' in form}<p class="meldung" role="status">Gespeichert.</p>{/if}

	<section class="karte"><p class="text">{r.text}</p></section>

	{#if r.kind === 'fehler'}
		<section class="karte stapel" aria-labelledby="h-technik">
			<h2 id="h-technik">Technische Angaben</h2>
			{#if r.technik}
				<dl>
					<dt>Version</dt>
					<dd>{r.technik.version ?? '–'}</dd>
					<dt>Fenstergröße</dt>
					<dd>{r.technik.fenster ?? '–'}</dd>
					<dt>Browser</dt>
					<dd>{r.technik.browser ?? '–'}</dd>
					<dt>Teams-App</dt>
					<dd>{r.technik.teams ? 'ja' : 'nein'}</dd>
					<dt>Fehlermeldungen des Browsers</dt>
					<dd>
						{#if r.technik.fehler.length}<pre>{r.technik.fehler.join('\n')}</pre>{:else}keine{/if}
					</dd>
				</dl>
			{:else}
				<p class="hinweis">Keine (Meldung aus einer älteren Version).</p>
			{/if}
			<h2>Bildschirmfoto</h2>
			{#if r.screenshotFileId}
				<a
					href={resolve('/(app)/dateien/[id]', { id: r.screenshotFileId })}
					target="_blank"
					rel="noopener"
				>
					<img
						class="foto"
						src="/dateien/{r.screenshotFileId}"
						alt="Bildschirmfoto zur Fehlermeldung"
					/>
				</a>
				<p class="hinweis">
					Groß ansehen: auf das Bild klicken. Es wird 30 Tage nach Abschluss der Meldung gelöscht.
				</p>
			{:else}
				<p class="hinweis">
					{r.closedAt ? 'Keines (oder schon gelöscht).' : 'Keines mitgeschickt.'}
				</p>
			{/if}
		</section>
	{/if}

	<section class="karte stapel" aria-labelledby="h-rueck">
		<h2 id="h-rueck">Rückfrage</h2>
		{#if r.gespraech}
			<a href={resolve('/(app)/nachrichten/[id]', { id: r.gespraech })}>Zum Gespräch</a>
		{:else if r.personId}
			<form method="POST" action="?/rueckfrage">
				<button class="knopf zweit" type="submit">Rückfrage über Nachrichten stellen</button>
			</form>
		{:else}
			<p class="hinweis">Das Konto gibt es nicht mehr.</p>
		{/if}
	</section>

	<form
		method="POST"
		action="?/stand"
		class="karte stapel"
		use:enhance={() =>
			async ({ update }) =>
				update({ reset: false })}
	>
		<h2>Stand</h2>
		<label class="feld">
			<span>Stand</span>
			<select name="stand" bind:value={w.stand}>
				{#each Object.entries(FEEDBACK_STATUS) as [k, l] (k)}<option value={k}>{l}</option>{/each}
			</select>
		</label>
		<label class="feld">
			<span>Antwort für die meldende Person (optional)</span>
			<textarea name="antwort" rows="3" maxlength="1000" bind:value={w.antwort}></textarea>
		</label>
		<p class="hinweis">
			Bei jeder Änderung des Stands bekommt die Person eine Benachrichtigung. Erledigte und nicht
			umgesetzte Rückmeldungen werden nach der Löschfrist entfernt.
		</p>
		<button class="knopf" type="submit">Speichern</button>
	</form>
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
	.text {
		margin: 0;
		white-space: pre-line;
	}
	.knopf {
		justify-self: start;
	}
	dl {
		display: grid;
		grid-template-columns: minmax(10rem, auto) 1fr;
		gap: 4px 12px;
		margin: 0;
	}
	dt {
		color: var(--mu);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	pre {
		margin: 0;
		white-space: pre-wrap;
		font-size: 13px;
	}
	.foto {
		display: block;
		max-width: 100%;
		max-height: 420px;
		border: 1px solid var(--bd);
		border-radius: 8px;
	}
	@media (max-width: 599px) {
		dl {
			grid-template-columns: 1fr;
		}
	}
</style>
