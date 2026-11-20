<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Ziel ist resolve() plus Suchparameter */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	const g = $derived(data.gespraech);
	const zeit = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Europe/Berlin'
	});
	const vorgang = $derived(
		g.kind === 'moderation' && g.viaRole
			? `${resolve('/(app)/schwarzes-brett')}?ansicht=moderation`
			: g.kind === 'moderation'
				? `${resolve('/(app)/schwarzes-brett')}?ansicht=meine`
				: resolve('/(app)/schwarzes-brett')
	);
</script>

<svelte:head><title>{g.subject} · Nachrichten · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/nachrichten')}>← Alle Nachrichten</a>
	<div class="kopf">
		<div class="schilder">
			<span class="schild rand">{g.kindLabel}</span>
			{#if g.closedAt}<span class="schild">Erledigt</span>{/if}
		</div>
		<h1>{g.subject}</h1>
		<p class="hinweis">
			{g.withLabel}{g.withLabel ? ' · ' : ''}<a href={vorgang}>Zum Schwarzen Brett</a>
		</p>
	</div>

	<section class="karte verlauf" aria-label="Verlauf">
		{#each g.messages as m (m.id)}
			<div class="nachricht" class:meine={m.mine}>
				<span class="meta">{m.mine ? 'Du' : m.author} · {zeit.format(m.createdAt)}</span>
				<span class="text">{m.body}</span>
			</div>
		{:else}
			<p class="hinweis">Noch keine Nachricht. Schreib die erste.</p>
		{/each}
	</section>

	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	{#if !g.closedAt}
		<form method="POST" action="?/senden" class="karte felder" use:enhance>
			<label class="feld">
				<span>Deine Nachricht</span>
				<textarea name="text" rows="3" maxlength="1000" required>{form?.text ?? ''}</textarea>
			</label>
			<div class="aktionen">
				{#if g.canClose}
					<button class="knopf zweit" type="submit" formaction="?/schliessen" formnovalidate>
						Als erledigt schließen
					</button>
				{/if}
				<button class="knopf senden" type="submit">Senden</button>
			</div>
		</form>
	{:else}
		<p class="hinweis">Dieses Gespräch ist geschlossen. Es wird nach der Löschfrist entfernt.</p>
	{/if}
</div>

<style>
	.schmal {
		max-width: 820px;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h1 {
		margin: 0;
		font-size: 1.5rem;
	}
	.kopf {
		display: grid;
		gap: 4px;
	}
	.schilder {
		display: flex;
		gap: 6px;
	}
	.verlauf {
		display: grid;
		gap: 10px;
	}
	.nachricht {
		display: grid;
		gap: 2px;
		max-width: 85%;
		padding: 10px 12px;
		border-radius: 14px;
		background: var(--bg);
		justify-self: start;
	}
	.nachricht.meine {
		justify-self: end;
		background: var(--tint);
	}
	.meta {
		font-size: 12px;
		font-weight: 600;
		color: var(--mu);
	}
	.text {
		white-space: pre-line;
		line-height: 1.5;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.senden {
		margin-left: auto;
	}
</style>
