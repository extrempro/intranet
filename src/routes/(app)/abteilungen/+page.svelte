<script lang="ts">
	/**
	 * Abteilungen (Kap. 8.11) wie die Hubs-Übersicht: oben „Deine Abteilung“,
	 * darunter alle Einheiten als Karten mit Suche (auch nach Thema und Person),
	 * Filter nach Mandant und Sortierung nach Art oder A–Z.
	 */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { matchesSearch } from '#lib/departments.ts';
	import { mitZahl } from '#lib/lange-liste.ts';

	let { data, form } = $props();
	type Einheit = (typeof data.einheiten)[number];
	let suche = $state('');
	let fuer = $state('');
	let sortierung = $state<'art' | 'az'>('art');

	const GRUPPEN = [
		{ type: 'geschaeftsfuehrung', label: 'Geschäftsführung' },
		{ type: 'stabsstelle', label: 'Stabsstellen' },
		{ type: 'abteilung', label: 'Abteilungen' }
	] as const;

	const aktiv = $derived(suche.trim().length > 0);
	const mandanten = $derived(
		[...new Set(data.einheiten.filter((e) => !e.isCentral).map((e) => e.tenantShort))].sort()
	);
	const themenTreffer = $derived(
		aktiv
			? data.einheiten.flatMap((e) =>
					e.zustaendigkeiten
						.filter((z) =>
							matchesSearch(suche, [z.topic, z.groupName, ...z.keywords, z.kontakt?.name])
						)
						.map((z) => ({ ...z, einheit: e }))
				)
			: []
	);
	const passt = (e: Einheit) =>
		(!fuer || (fuer === 'alle' ? e.isCentral : !e.isCentral && e.tenantShort === fuer)) &&
		(!aktiv ||
			matchesSearch(suche, [e.name, e.label, e.tagline, e.leitung]) ||
			themenTreffer.some((t) => t.einheit.id === e.id));
	const treffer = $derived(
		data.einheiten.filter(passt).sort((a, b) => a.name.localeCompare(b.name, 'de'))
	);
	const gruppen = $derived(
		sortierung === 'az'
			? [{ type: 'alle', label: '', liste: treffer }]
			: GRUPPEN.map((g) => ({ ...g, liste: treffer.filter((e) => e.type === g.type) })).filter(
					(g) => g.liste.length
				)
	);
	const meine = $derived(
		data.einheiten
			.filter((e) => e.meine)
			.sort((a, b) => Number(b.meine === 'stamm') - Number(a.meine === 'stamm'))
	);
	const FARBEN = ['ton1', 'ton2', 'ton3', 'ton4', 'ton5', 'ton6'];
	const ton = (name: string) =>
		FARBEN[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % FARBEN.length];
	const kuerzel = (name: string) => (name.length <= 3 ? name : name.charAt(0));
	const href = (e: Einheit) => resolve('/(app)/abteilungen/[slug]', { slug: e.slug });
</script>

<svelte:head><title>Abteilungen · Intranet</title></svelte:head>

{#snippet symbol(e: Einheit, gross: boolean)}
	<span class="symbol {ton(e.name)}" class:gross class:lang={e.name.length > 1} aria-hidden="true">
		{kuerzel(e.name)}
	</span>
{/snippet}

<div class="stapel">
	<div class="kopftext">
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
		<p class="hinweis">
			Geschäftsführung, Stabsstellen und die Abteilungen von {data.ich.mandant}. Suchst du jemanden
			für ein Thema? Gib es einfach ein.
		</p>
	</div>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	{#if meine.length}
		<section class="abschnitt" aria-labelledby="h-meine">
			<h2 id="h-meine">
				{meine.length === 1 ? 'Deine Abteilung' : 'Deine Abteilungen'}
				<span class="anzahl">{meine.length}</span>
			</h2>
			<ul class="meine">
				{#each meine as e (e.id)}
					<li>
						<a class="karte zeile" href={href(e)}>
							{@render symbol(e, false)}
							<span class="text">
								<strong>{e.name}</strong>
								<span class="unter">
									{e.meine === 'stamm' ? 'Deine Stammabteilung' : 'Du bist im Team'} · {e.label}
								</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section class="abschnitt" aria-labelledby="h-alle">
		<h2 id="h-alle">Alle Abteilungen</h2>
		<div class="werkzeuge">
			<label class="feld suche">
				<span class="sr-only">Abteilung, Thema oder Person suchen</span>
				<input
					type="search"
					bind:value={suche}
					placeholder="Abteilung, Thema oder Person"
					autocomplete="off"
					maxlength="100"
				/>
			</label>
			<div class="segment" role="group" aria-label="Sortieren">
				{#each [['art', 'Nach Art'], ['az', 'A–Z']] as const as [wert, text] (wert)}
					<button
						type="button"
						aria-pressed={sortierung === wert}
						onclick={() => (sortierung = wert)}
					>
						{text}
					</button>
				{/each}
			</div>
		</div>
		<div class="filterzeile">
			{#if mandanten.length}
				<div class="pillen" role="group" aria-label="Für wen">
					{#each [['', 'Alle'], ['alle', 'Für alle Mandanten'], ...mandanten.map( (m) => [m, m] )] as [wert, text] (wert)}
						<button
							type="button"
							class="pille"
							aria-pressed={fuer === wert}
							onclick={() => (fuer = wert)}
						>
							{text}
						</button>
					{/each}
				</div>
			{/if}
			<p class="zaehler" role="status">{mitZahl(treffer.length, 'Einheit', 'Einheiten')}</p>
		</div>

		{#if themenTreffer.length}
			<div class="karte themen" aria-live="polite">
				<h3>Zuständig für „{suche.trim()}“</h3>
				<ul>
					{#each themenTreffer.slice(0, 8) as z (z.id)}
						<li>
							<span>
								<strong>{z.topic}</strong>
								{#if z.kontakt}
									&nbsp;· {z.kontakt.name}{z.kontakt.vertretung ? ' (Vertretung)' : ''}
								{/if}
							</span>
							<a href={href(z.einheit)}>{z.einheit.name}</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#each gruppen as g (g.type)}
			{#if g.label}<h3 class="gruppe">{g.label}</h3>{/if}
			<ul class="raster">
				{#each g.liste as e (e.id)}
					<li class="karte einheit">
						<div class="kopf">
							{@render symbol(e, true)}
							<span class="text">
								<a class="name dehnen" href={href(e)}>{e.name}</a>
								<span class="unter">
									{e.label}{e.personen ? ` · ${mitZahl(e.personen, 'Person', 'Personen')}` : ''}{e
										.zustaendigkeiten.length
										? ` · ${mitZahl(e.zustaendigkeiten.length, 'Zuständigkeit', 'Zuständigkeiten')}`
										: ''}
								</span>
							</span>
						</div>
						{#if e.tagline || e.title}<p class="about">{e.tagline || e.title}</p>{/if}
						<div class="fuss">
							<span class="schild">{e.isCentral ? 'Alle Mandanten' : e.tenantShort}</span>
							{#if e.leitung}<span class="unter">Leitung: {e.leitung}</span>{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/each}

		{#if data.einheiten.length === 0}
			<p class="karte hinweis">Noch keine Abteilungen angelegt.</p>
		{:else if treffer.length === 0 && themenTreffer.length === 0}
			<p class="leer">
				Keine Abteilung gefunden. Versuch es mit einem Thema, z. B. „Urlaub“ oder „Drucker“.
			</p>
		{/if}
	</section>
</div>

<style>
	.kopftext {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.kopftext .hinweis {
		margin: 0;
	}
	.titel {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	h1 {
		margin: 0;
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
	.abschnitt {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.abschnitt h2 {
		margin: 6px 0 0;
		font-size: 18px;
	}
	.anzahl {
		font-weight: 500;
		color: var(--mu);
	}
	.gruppe {
		margin: 6px 0 0;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--mu);
	}
	.leer {
		margin: 0;
		padding: 16px;
		border: 1px dashed var(--bd);
		border-radius: 14px;
		color: var(--mu);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.meine,
	.raster {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}
	.raster {
		gap: 14px;
	}
	.zeile {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		color: var(--tx);
		text-decoration: none;
		min-height: 44px;
	}
	.karte.zeile:hover {
		background: color-mix(in srgb, var(--tint) 50%, var(--sf));
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.text strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
	}
	.symbol {
		width: 40px;
		height: 40px;
		flex: none;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 18px;
	}
	.symbol.lang {
		font-size: 14px;
	}
	.symbol.gross {
		width: 48px;
		height: 48px;
		border-radius: 14px;
	}
	.ton1 {
		background: #e6f3ee;
		color: #0b5e49;
	}
	.ton2 {
		background: #e3edf7;
		color: #1f4f7a;
	}
	.ton3 {
		background: #fbe6d8;
		color: #8a4316;
	}
	.ton4 {
		background: #e8e4f6;
		color: #4a3d8f;
	}
	.ton5 {
		background: #f6e3ea;
		color: #7f2846;
	}
	.ton6 {
		background: #eef0e0;
		color: #4d5a14;
	}
	.werkzeuge,
	.filterzeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	.pillen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.suche {
		flex: 1 1 280px;
		max-width: 460px;
	}
	.segment {
		display: flex;
		gap: 2px;
		padding: 3px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--mu) 14%, transparent);
		margin-left: auto;
	}
	.segment button {
		height: 38px;
		padding: 0 14px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--mu);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}
	.segment button[aria-pressed='true'] {
		background: var(--sf);
		color: var(--ac);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.12);
	}
	.pille[aria-pressed='true'] {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
	}
	.zaehler {
		margin: 0 0 0 auto;
		font-size: 14px;
		color: var(--mu);
	}
	.themen h3 {
		margin: 0 0 4px;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--mu);
	}
	.themen li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 4px 12px;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.einheit {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px;
		transition: box-shadow 0.15s ease;
	}
	.einheit:hover {
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.08);
	}
	.einheit:has(.dehnen:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.kopf {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.name {
		color: var(--tx);
		font-weight: 700;
		font-size: 17px;
		text-decoration: none;
	}
	.dehnen::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.about {
		margin: 0;
		font-size: 14px;
		color: var(--mu);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	.fuss {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 10px;
		margin-top: auto;
	}
	@media (max-width: 1023px) {
		.meine,
		.raster {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 599px) {
		.meine,
		.raster {
			grid-template-columns: minmax(0, 1fr);
		}
		.suche {
			flex: 1 1 100%;
			max-width: none;
		}
		.segment {
			flex: 1 1 100%;
			margin-left: 0;
		}
		.segment button {
			flex: 1;
		}
		.zaehler {
			flex: 1 1 100%;
			margin: 0;
		}
	}
</style>
