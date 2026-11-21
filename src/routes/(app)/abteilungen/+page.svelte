<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { matchesSearch } from '#lib/departments.ts';

	let { data, form } = $props();
	let suche = $state('');

	const GRUPPEN = [
		{ type: 'geschaeftsfuehrung', label: 'Geschäftsführung' },
		{ type: 'stabsstelle', label: 'Stabsstellen' },
		{ type: 'abteilung', label: 'Abteilungen' }
	] as const;

	const aktiv = $derived(suche.trim().length > 0);
	const einheitTreffer = $derived(
		aktiv ? data.einheiten.filter((e) => matchesSearch(suche, [e.name, e.label])) : []
	);
	const themenTreffer = $derived(
		aktiv
			? data.einheiten.flatMap((e) =>
					e.zustaendigkeiten
						.filter((z) =>
							matchesSearch(suche, [z.topic, z.groupName, ...z.keywords, z.kontakt?.name, e.name])
						)
						.map((z) => ({ ...z, einheit: e }))
				)
			: []
	);
</script>

<svelte:head><title>Abteilungen · Intranet</title></svelte:head>

<div class="stapel">
	<div class="titel">
		<h1>Abteilungen</h1>
		<form method="POST" action="?/favorit" use:enhance>
			<button
				class="stern"
				type="submit"
				aria-pressed={data.favorit}
				aria-label={data.favorit ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten hinzufügen'}
			>
				{data.favorit ? '★' : '☆'}
			</button>
		</form>
	</div>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	<p class="untertitel">
		Zentrale Einheiten und die Abteilungen von {data.ich.mandant}. Suchst du jemanden für ein Thema?
		Gib es einfach ein.
	</p>
	<div class="suche">
		<label class="sr-only" for="suche">Abteilung, Thema oder Person suchen</label>
		<input
			id="suche"
			type="search"
			bind:value={suche}
			placeholder="Abteilung, Thema oder Person suchen …"
			autocomplete="off"
			maxlength="100"
		/>
	</div>

	{#if aktiv}
		<section class="stapel" aria-labelledby="h-themen" aria-live="polite">
			<h2 id="h-themen">Zuständigkeiten</h2>
			{#if themenTreffer.length === 0}
				<p class="karte hinweis">Keine passende Zuständigkeit gefunden.</p>
			{:else}
				<ul class="karte liste">
					{#each themenTreffer as z (z.id)}
						<li>
							<span>
								<strong>{z.topic}</strong>
								{#if z.kontakt}
									· {z.kontakt.name}{z.kontakt.vertretung ? ' (Vertretung)' : ''}
								{/if}
							</span>
							<a href={resolve('/(app)/abteilungen/[slug]', { slug: z.einheit.slug })}>
								{z.einheit.name}
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
		<section class="stapel" aria-labelledby="h-treffer">
			<h2 id="h-treffer">Einheiten</h2>
			{#if einheitTreffer.length === 0}
				<p class="karte hinweis">Keine passende Einheit gefunden.</p>
			{:else}
				<div class="raster">
					{#each einheitTreffer as e (e.id)}{@render kachel(e)}{/each}
				</div>
			{/if}
		</section>
	{:else}
		{#each GRUPPEN as g (g.type)}
			{@const liste = data.einheiten.filter((e) => e.type === g.type)}
			{#if liste.length}
				<section class="stapel" aria-labelledby="h-{g.type}">
					<h2 id="h-{g.type}">{g.label}</h2>
					<div class="raster">
						{#each liste as e (e.id)}{@render kachel(e)}{/each}
					</div>
				</section>
			{/if}
		{/each}
		{#if data.einheiten.length === 0}
			<p class="karte hinweis">Noch keine Abteilungen angelegt.</p>
		{/if}
	{/if}
</div>

{#snippet kachel(e: (typeof data.einheiten)[number])}
	<a class="karte kachel" href={resolve('/(app)/abteilungen/[slug]', { slug: e.slug })}>
		<strong>{e.name}</strong>
		{#if e.title}<span class="titelzeile">{e.title}</span>{/if}
		{#if e.tagline}<span class="kurz">{e.tagline}</span>{/if}
		<span class="zahlen">
			{[
				e.personen ? (e.personen === 1 ? '1 Person' : `${e.personen} Personen`) : null,
				e.zustaendigkeiten.length
					? e.zustaendigkeiten.length === 1
						? '1 Zuständigkeit'
						: `${e.zustaendigkeiten.length} Zuständigkeiten`
					: null
			]
				.filter(Boolean)
				.join(' · ')}
		</span>
		<span class="schild" class:rand={!e.isCentral}>
			{e.isCentral ? 'Alle Mandanten' : e.tenantShort}
		</span>
	</a>
{/snippet}

<style>
	.titel {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--mu);
	}
	.untertitel {
		margin: -6px 0 0;
		color: var(--mu);
	}
	.suche {
		max-width: 560px;
	}
	.titelzeile {
		font-size: 13px;
		font-weight: 600;
		color: var(--ac);
	}
	.kurz {
		font-size: 13px;
		color: var(--mu);
	}
	.zahlen {
		font-size: 13px;
		color: var(--mu);
	}
	.kachel .schild {
		align-self: flex-start;
		margin-top: 4px;
	}
	.stern {
		width: 44px;
		height: 44px;
		border: 0;
		background: transparent;
		color: var(--ac);
		font-size: 24px;
		cursor: pointer;
	}
	.raster {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
		gap: 12px;
	}
	.kachel {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: var(--tx);
		text-decoration: none;
	}
	.kachel strong {
		font-size: 16px;
	}
	.kachel:hover {
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.08);
	}
	.liste {
		list-style: none;
		margin: 0;
		display: grid;
	}
	.liste li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 12px;
		padding: 8px 0;
		border-top: 1px solid var(--bd);
	}
	.liste li:first-child {
		border-top: 0;
	}
</style>
