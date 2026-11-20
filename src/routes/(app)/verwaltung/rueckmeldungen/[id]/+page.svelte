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
</style>
