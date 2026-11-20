<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeZone: 'Europe/Berlin'
	});
</script>

<svelte:head><title>Meine Meldungen · Intranet</title></svelte:head>

<div class="stapel seite">
	<div class="kopfzeile">
		<h1>Meine Meldungen</h1>
		<a class="knopf" href={resolve('/(app)/rueckmeldung/neu')}>Rückmeldung geben</a>
	</div>
	{#if data.meldungen.length === 0}
		<p class="karte hinweis">Du hast noch nichts gemeldet.</p>
	{/if}
	{#each data.meldungen as m (m.id)}
		<article class="karte stapel eng">
			<div class="zeile">
				<span class="schild rand">{m.kind === 'fehler' ? 'Fehler' : 'Idee'}</span>
				<span class="schild" class:fertig={m.status === 'erledigt'}>{m.statusLabel}</span>
				<span class="hinweis">{datum.format(m.createdAt)}{m.page ? ` · ${m.page}` : ''}</span>
			</div>
			<p class="text">{m.text}</p>
			{#if m.answer}<p class="antwort"><strong>Antwort:</strong> {m.answer}</p>{/if}
			{#if m.gespraech}
				<a href={resolve('/(app)/nachrichten/[id]', { id: m.gespraech })}>Zum Gespräch</a>
			{/if}
		</article>
	{/each}
	<p class="hinweis">Abgeschlossene Meldungen werden nach einiger Zeit gelöscht.</p>
</div>

<style>
	.seite {
		max-width: 44rem;
	}
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	h1 {
		margin: 0;
	}
	.eng {
		gap: 6px;
	}
	.zeile {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 10px;
		align-items: center;
	}
	.text,
	.antwort {
		margin: 0;
		white-space: pre-line;
	}
	.antwort {
		padding: 8px 12px;
		border-radius: 10px;
		background: var(--tint);
	}
	.schild.fertig {
		background: var(--fill);
		color: #fff;
	}
</style>
