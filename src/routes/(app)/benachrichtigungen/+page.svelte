<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { TOPICS } from '#lib/notify.ts';

	let { data } = $props();
	const THEMA = Object.fromEntries(TOPICS.map((t) => [t.key, t.label]));
	const zeit = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Europe/Berlin'
	});
	const ungelesen = $derived(data.liste.filter((n) => !n.readAt).length);
</script>

<svelte:head><title>Benachrichtigungen · Intranet</title></svelte:head>

<div class="stapel schmal">
	<div class="kopfzeile">
		<h1>Benachrichtigungen</h1>
		<div class="aktionen">
			{#if ungelesen}
				<form method="POST" action="?/alleGelesen" use:enhance>
					<button class="knopf zweit" type="submit">Alle als gelesen markieren</button>
				</form>
			{/if}
			<a class="knopf zweit" href={resolve('/(app)/konto/benachrichtigungen')}>Einstellungen</a>
		</div>
	</div>

	{#if data.liste.length === 0}
		<p class="karte hinweis">
			Noch keine Benachrichtigungen. Was hier erscheint, legst du unter Einstellungen fest.
		</p>
	{:else}
		<ul class="liste karte">
			{#each data.liste as n (n.id)}
				<li class:neu={!n.readAt}>
					<a href={resolve('/(app)/benachrichtigungen/[id]', { id: n.id })}>
						<span class="thema" class:dringend={n.topic === 'dringend'}>
							{THEMA[n.topic] ?? n.topic}{#if !n.readAt}<span class="sr-only">
									, ungelesen
								</span>{/if}
						</span>
						<strong>{n.title}</strong>
						<span class="hinweis">
							{[n.detail, zeit.format(n.createdAt)].filter(Boolean).join(' · ')}
						</span>
					</a>
				</li>
			{/each}
		</ul>
		<p class="hinweis">Benachrichtigungen werden nach 90 Tagen gelöscht.</p>
	{/if}
</div>

<style>
	.schmal {
		max-width: 820px;
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
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
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
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 12px 16px 12px 22px;
		color: var(--tx);
		text-decoration: none;
		position: relative;
	}
	.liste a:hover strong {
		text-decoration: underline;
	}
	.liste li:not(.neu) strong {
		font-weight: 500;
	}
	.neu a::before {
		content: '';
		position: absolute;
		left: 8px;
		top: 18px;
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--fill);
	}
	.thema {
		font-size: 12px;
		font-weight: 700;
		color: var(--ac);
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
	.thema.dringend {
		color: var(--err-tx);
	}
</style>
