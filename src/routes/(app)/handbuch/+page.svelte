<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */
	import { resolve } from '$app/paths';
	import { matchesSearch } from '#lib/departments.ts';

	let { data } = $props();
	let suche = $state('');
	const kapitel = $derived(
		data.chapters
			.map((c) => ({
				...c,
				articles: c.articles.filter((a) => matchesSearch(suche, [a.title, a.summary, a.text]))
			}))
			.filter((c) => c.articles.length)
	);
</script>

<svelte:head><title>Handbuch · Intranet</title></svelte:head>

<div class="stapel seite">
	<div>
		<h1>Handbuch</h1>
		<p class="hinweis">
			{data.alle
				? 'Alle Kapitel für alle Rollen.'
				: 'Passend zu deinen Aufgaben. Kapitel für andere Rollen blendest du bei Bedarf ein.'}
		</p>
	</div>
	<div class="karte">
		<label class="sr-only" for="suche-handbuch">Im Handbuch suchen</label>
		<input
			id="suche-handbuch"
			type="search"
			bind:value={suche}
			placeholder="Im Handbuch suchen"
			autocomplete="off"
			maxlength="100"
		/>
	</div>

	{#each kapitel as c (c.key)}
		<section class="stapel" aria-labelledby="h-{c.key}">
			<h2 id="h-{c.key}">{c.label}</h2>
			<ul class="karte liste">
				{#each c.articles as a (a.slug)}
					<li>
						<a href={resolve('/(app)/handbuch/[slug]', { slug: a.slug })}>{a.title}</a>
						{#if a.summary}<span class="hinweis">{a.summary}</span>{/if}
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<p class="karte hinweis">Nichts gefunden.</p>
	{/each}

	{#if data.alle}
		<a href="?">Nur Kapitel für meine Aufgaben</a>
	{:else if data.hidden}
		<a href="?alle=1">Alle Kapitel zeigen ({data.hidden} weitere für andere Rollen)</a>
	{/if}
	<p class="hinweis">
		Etwas fehlt oder ist unklar? <a href={resolve('/(app)/rueckmeldung/neu')}>Gib uns Bescheid.</a>
	</p>
</div>

<style>
	.seite {
		max-width: 44rem;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	input[type='search'] {
		width: 100%;
	}
	.liste {
		list-style: none;
		margin: 0;
		display: grid;
	}
	.liste li {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.liste li:first-child {
		border-top: 0;
		padding-top: 0;
	}
	.liste li:last-child {
		padding-bottom: 0;
	}
	.liste a {
		font-weight: 700;
	}
</style>
