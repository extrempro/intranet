<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */
	import { resolve } from '$app/paths';

	let { data } = $props();
	const zeit = new Intl.DateTimeFormat('de-DE', {
		day: '2-digit',
		month: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Berlin'
	});
	const q = (box: string, erledigt: boolean) =>
		`?postfach=${box}${erledigt ? '&status=erledigt' : ''}`;
</script>

<svelte:head><title>Nachrichten · Intranet</title></svelte:head>

<div class="stapel schmal">
	<div>
		<h1>Nachrichten</h1>
		<p class="hinweis">Gespräche zu Anzeigen am Schwarzen Brett, Hub-Anträgen und Rückmeldungen.</p>
	</div>

	{#if data.boxes.length > 1}
		<nav class="pillen" aria-label="Postfach">
			{#each data.boxes as b (b.key)}
				<a
					class="pille"
					href={q(b.key, data.erledigt)}
					aria-current={b.key === data.box ? 'true' : undefined}
				>
					{b.label}
				</a>
			{/each}
		</nav>
	{/if}
	{#if data.rolle}
		<p class="hinweis">
			Gemeinsames Postfach: Alle mit dieser Rolle sehen und beantworten dieselben Gespräche.
		</p>
	{/if}
	<nav class="pillen klein" aria-label="Filtern">
		<a class="pille" href={q(data.box, false)} aria-current={!data.erledigt ? 'true' : undefined}>
			Offen
		</a>
		<a class="pille" href={q(data.box, true)} aria-current={data.erledigt ? 'true' : undefined}>
			Erledigt
		</a>
	</nav>

	{#if data.liste.length === 0}
		<p class="karte hinweis">Keine Gespräche.</p>
	{:else}
		<ul class="liste karte">
			{#each data.liste as g (g.id)}
				<li class:neu={g.unread}>
					<a href={resolve('/(app)/nachrichten/[id]', { id: g.id })}>
						<span class="zeile">
							<span class="schild rand">{g.kindLabel}</span>
							<strong>{g.subject}</strong>
							{#if g.unread}<span class="sr-only">, neue Nachricht</span>{/if}
							<span class="zeit hinweis">{zeit.format(g.lastMessageAt)}</span>
						</span>
						{#if g.withLabel}<span class="hinweis">{g.withLabel}</span>{/if}
						{#if g.preview}<span class="vorschau">{g.preview}</span>{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.schmal {
		max-width: 820px;
	}
	h1 {
		margin: 0;
	}
	.pillen {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.pille {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 16px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		text-decoration: none;
		font-weight: 600;
	}
	.klein .pille {
		min-height: 38px;
		font-size: 14px;
	}
	.pille[aria-current='true'] {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.liste li + li {
		border-top: 1px solid var(--bd);
	}
	.liste a {
		display: grid;
		gap: 2px;
		padding: 12px 16px 12px 24px;
		color: var(--tx);
		text-decoration: none;
		position: relative;
	}
	.neu a::before {
		content: '';
		position: absolute;
		left: 9px;
		top: 20px;
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--fill);
	}
	.zeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
	}
	.liste li:not(.neu) strong {
		font-weight: 500;
	}
	.zeit {
		margin-left: auto;
		font-size: 12px;
	}
	.vorschau {
		color: var(--mu);
		font-size: 14px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
