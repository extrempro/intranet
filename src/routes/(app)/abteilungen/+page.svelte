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

	<div class="karte stapel suche">
		<label for="suche"><strong>Wer hilft bei was?</strong></label>
		<input
			id="suche"
			type="search"
			bind:value={suche}
			placeholder="Thema, Stichwort, Person oder Abteilung"
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
		<span class="hinweis">
			{[e.type === 'abteilung' ? null : e.label, e.isCentral ? 'für alle Mandanten' : e.tenantShort]
				.filter(Boolean)
				.join(' · ')}
		</span>
		{#if e.zustaendigkeiten.length}
			<span class="hinweis">
				{e.zustaendigkeiten.length}
				{e.zustaendigkeiten.length === 1 ? 'Zuständigkeit' : 'Zuständigkeiten'}
			</span>
		{/if}
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
		font-size: 1.1rem;
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
	.suche input {
		width: 100%;
	}
	.raster {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 10px;
	}
	.kachel {
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: var(--tx);
		text-decoration: none;
	}
	.kachel:hover {
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.1);
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
