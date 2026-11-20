<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Trefferlinks kommen vom Server (eigene Pfade), Filter sind Suchparameter */
	import Avatar from '#lib/components/Avatar.svelte';
	import { splitMarks } from '#lib/search.ts';

	let { data } = $props();
	const t = $derived(data.treffer);
	const mitTreffern = $derived(t ? data.arten.filter((a) => t[a.key].length > 0) : []);
	const link = (art: string | null) =>
		`?q=${encodeURIComponent(data.q)}${art ? `&art=${art}` : ''}`;
</script>

<svelte:head><title>{data.q ? `${data.q} · Suche` : 'Suche'} · Intranet</title></svelte:head>

<div class="stapel seite">
	<h1>Suche</h1>
	<form method="GET" role="search" class="suchzeile">
		<label class="sr-only" for="suche-seite">Suchbegriff</label>
		<input
			id="suche-seite"
			type="search"
			name="q"
			value={data.q}
			maxlength="100"
			placeholder="Personen, Abteilungen, Beiträge, FAQs …"
			autocomplete="off"
		/>
		{#if data.art}<input type="hidden" name="art" value={data.art} />{/if}
		<button class="knopf" type="submit">Suchen</button>
	</form>

	{#if !t}
		<p class="hinweis">
			Gesucht wird in Personen, Abteilungen, Zuständigkeiten, Beiträgen, FAQs, Rechtlichem,
			Terminen, Hubs, am Schwarzen Brett und in „Hinter den Kulissen“ – nur was du sehen darfst.
		</p>
	{:else}
		<nav class="pillen" aria-label="Trefferart">
			<a class="pille" href={link(null)} aria-current={!data.art ? 'true' : undefined}>Alle</a>
			{#each data.arten as a (a.key)}
				{#if data.art === a.key || t[a.key].length}
					<a
						class="pille"
						href={link(a.key)}
						aria-current={data.art === a.key ? 'true' : undefined}
					>
						{a.label}
					</a>
				{/if}
			{/each}
		</nav>

		{#if mitTreffern.length === 0}
			<p class="karte hinweis" role="status">
				Nichts gefunden für „{data.q}“. Versuche ein kürzeres oder anderes Wort.
			</p>
		{/if}

		{#each mitTreffern as a (a.key)}
			{@const liste = data.art ? t[a.key] : t[a.key].slice(0, 5)}
			<section class="stapel" aria-labelledby="h-{a.key}">
				<h2 id="h-{a.key}">{a.label}</h2>
				<ul class="karte treffer">
					{#each liste as h (h.id)}
						<li>
							{#if h.kind === 'personen'}<Avatar name={h.title} foto={h.foto} groesse={40} />{/if}
							<div class="inhalt">
								<a class="titel" href={h.href}>{h.title}</a>
								{#if h.meta}<span class="hinweis">{h.meta}</span>{/if}
								{#if h.snippet}
									<p class="ausschnitt">
										{#each splitMarks(h.snippet) as s, i (i)}{#if s.mark}<mark>
													{s.text}
												</mark>{:else}{s.text}{/if}{/each}
									</p>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
				{#if !data.art && t[a.key].length > 5}
					<a class="mehr" href={link(a.key)}>Mehr {a.label}</a>
				{/if}
			</section>
		{/each}
	{/if}
</div>

<style>
	.seite {
		max-width: 52rem;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	.suchzeile {
		display: flex;
		gap: 10px;
	}
	.suchzeile input {
		flex: 1;
	}
	.pillen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.treffer {
		list-style: none;
		margin: 0;
		display: grid;
	}
	.treffer li {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.treffer li:first-child {
		border-top: 0;
		padding-top: 0;
	}
	.treffer li:last-child {
		padding-bottom: 0;
	}
	.inhalt {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.titel {
		font-weight: 700;
	}
	.ausschnitt {
		margin: 2px 0 0;
		font-size: 14px;
		color: var(--mu);
	}
	mark {
		background: color-mix(in srgb, var(--ac) 22%, transparent);
		color: inherit;
		border-radius: 3px;
		padding: 0 2px;
	}
	.mehr {
		font-weight: 600;
		font-size: 14px;
	}
</style>
