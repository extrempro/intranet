<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { matchesSearch } from '#lib/departments.ts';

	let { data, children } = $props();
	let suche = $state('');
	const kapitel = $derived(
		data.chapters
			.map((c) => ({
				...c,
				articles: c.articles.filter((a) => matchesSearch(suche, [a.title, a.summary, a.text]))
			}))
			.filter((c) => c.articles.length)
	);
	const aktuell = $derived(page.params.slug ?? '');
	const startseite = $derived(!page.params.slug);
</script>

<div class="stapel">
	<div>
		<h1>Handbuch</h1>
		<p class="hinweis">So nutzt du das Intranet.</p>
	</div>
	<div class="suchfeld">
		<label class="sr-only" for="suche-handbuch">Im Handbuch suchen</label>
		<input
			id="suche-handbuch"
			type="search"
			bind:value={suche}
			placeholder="Im Handbuch suchen …"
			autocomplete="off"
			maxlength="100"
		/>
	</div>

	<div class="raster" class:start={startseite}>
		<nav class="leiste" aria-label="Themen im Handbuch">
			<p class="hinweis klein">
				{data.alle ? 'Alle Themen für alle Rollen.' : 'Themen passend zu deinen Rollen.'}
				{#if data.alle}
					<a href="?">Nur meine Themen</a>
				{:else if data.hidden}
					<a href="?alle=1">{data.hidden} weitere Themen anzeigen</a>
				{/if}
			</p>
			{#each kapitel as c (c.key)}
				<h2 id="k-{c.key}">{c.label}</h2>
				<ul aria-labelledby="k-{c.key}">
					{#each c.articles as a (a.slug)}
						<li>
							<a
								href="{resolve('/(app)/handbuch/[slug]', { slug: a.slug })}{data.alle
									? '?alle=1'
									: ''}"
								aria-current={a.slug === aktuell ||
								(startseite && a.slug === 'erste-schritte' && !suche)
									? 'page'
									: undefined}
							>
								<span class="titel">{a.title}</span>
								<span class="kurz">{a.summary}</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="hinweis">Nichts gefunden.</p>
			{/each}
			<p class="hinweis klein">
				Etwas fehlt oder ist unklar?
				<a href={resolve('/(app)/rueckmeldung/neu')}>Gib uns Bescheid.</a>
			</p>
		</nav>
		<div class="inhalt">
			{@render children()}
		</div>
	</div>
</div>

<style>
	h1 {
		margin: 0;
	}
	.suchfeld {
		max-width: 560px;
	}
	.raster {
		display: grid;
		grid-template-columns: 260px minmax(0, 1fr);
		gap: 20px;
		align-items: start;
	}
	.leiste h2 {
		margin: 14px 0 4px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--mu);
	}
	.leiste ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 2px;
	}
	.leiste li a {
		display: flex;
		flex-direction: column;
		min-height: 40px;
		justify-content: center;
		padding: 6px 10px;
		border-radius: 10px;
		color: var(--tx);
		text-decoration: none;
	}
	.leiste li a:hover {
		background: var(--sf);
	}
	.leiste li a[aria-current='page'] {
		background: var(--tint);
		color: var(--ac);
		font-weight: 600;
	}
	.titel {
		font-size: 14px;
	}
	.kurz {
		display: none;
	}
	.klein {
		font-size: 13px;
		margin: 0;
	}
	/* Schmal: Startseite zeigt die Themenliste, ein Thema nur den Text */
	@media (max-width: 899px) {
		.raster {
			grid-template-columns: minmax(0, 1fr);
		}
		.raster.start .inhalt,
		.raster:not(.start) .leiste {
			display: none;
		}
		.kurz {
			display: block;
			font-size: 13px;
			font-weight: 400;
			color: var(--mu);
		}
		.leiste li a {
			background: var(--sf);
			border: 1px solid var(--bd);
			margin-bottom: 6px;
		}
	}
</style>
