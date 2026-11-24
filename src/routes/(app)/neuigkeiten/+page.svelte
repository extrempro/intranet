<script lang="ts">
	import { livesuche } from '#lib/livesuche.ts';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Beitragskarte from '#lib/components/Beitragskarte.svelte';
	import AnsichtUmschalter from '#lib/components/AnsichtUmschalter.svelte';
	import MehrLaden from '#lib/components/MehrLaden.svelte';
	import { mitZahl, nachMonat } from '#lib/lange-liste.ts';
	import Icon from '#lib/components/Icon.svelte';
	const PIN = 'M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4M9 15l-4.5 4.5M14.5 4l5.5 5.5';

	let { data, form } = $props();

	let alleAngehefteten = $state(false);
	const angeheftet = $derived(data.angeheftet);
	const sichtbarAngeheftet = $derived(
		alleAngehefteten ? angeheftet : angeheftet.slice(0, data.angeheftetSichtbar)
	);
	const gruppen = $derived(nachMonat(data.items, (i) => i.publishAt, data.monate));
	let ansicht = $derived(data.ansicht);
	const mehrHref = $derived.by(() => {
		const u = new URL(page.url.href);
		u.searchParams.set('anzahl', String(data.anzahl + data.schritt));
		return u.search;
	});
	const leer = $derived(data.items.length === 0 && angeheftet.length === 0);
	const filter = $derived([
		{ k: 'alle', l: 'Alle' },
		{ k: 'meine', l: 'Meine' },
		...(data.darfGeplant ? [{ k: 'geplant', l: 'Geplant' }] : [])
	]);
	function href(f: string) {
		const teile = [
			f !== 'alle' ? `filter=${f}` : '',
			data.von ? `von=${encodeURIComponent(data.von)}` : '',
			data.q ? `q=${encodeURIComponent(data.q)}` : ''
		].filter(Boolean);
		return teile.length ? `?${teile.join('&')}` : '?';
	}
	import EinfuehrungAngebot from '#lib/components/EinfuehrungAngebot.svelte';
	import EinfuehrungKnopf from '#lib/components/EinfuehrungKnopf.svelte';
	import { SEITEN } from '#lib/tours.ts';
</script>

<svelte:head><title>Neuigkeiten · Intranet</title></svelte:head>

<div class="stapel">
	<EinfuehrungAngebot tour={SEITEN.neuigkeiten} />
	<div class="kopfzeile">
		<div class="titel">
			<h1>Neuigkeiten</h1>
			<EinfuehrungKnopf tour={SEITEN.neuigkeiten} />
			<form method="POST" action="?/favorit" use:enhance>
				<button
					class="stern"
					type="submit"
					aria-pressed={data.favorit}
					aria-label={data.favorit ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten hinzufügen'}
					title={data.favorit ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten'}
				>
					{data.favorit ? '★' : '☆'}
				</button>
			</form>
		</div>
		{#if data.darfSchreiben}
			<a class="knopf hauptaktion" href={resolve('/(app)/neuigkeiten/neu')} data-tour="schreiben">
				Beitrag erstellen
			</a>
		{/if}
	</div>
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	<div class="suchzeile">
		<form
			method="GET"
			class="suche"
			role="search"
			data-sveltekit-reset="false"
			data-sveltekit-replacestate
		>
			{#if data.filter !== 'alle'}<input type="hidden" name="filter" value={data.filter} />{/if}
			{#if data.von}<input type="hidden" name="von" value={data.von} />{/if}
			<label class="feld">
				<span class="sr-only">In Neuigkeiten suchen</span>
				<input
					use:livesuche
					type="search"
					name="q"
					value={data.q}
					maxlength="100"
					placeholder="In Neuigkeiten suchen …"
				/>
			</label>
		</form>
		<AnsichtUmschalter bind:ansicht />
	</div>

	<form method="GET" class="filter" data-tour="filter" data-sveltekit-reset="false">
		<nav class="pillen" aria-label="Filter">
			{#each filter as f (f.k)}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- nur Suchparameter der aktuellen Seite -->
				<a href={href(f.k)} class="pille" aria-current={data.filter === f.k ? 'true' : undefined}>
					{f.l}
				</a>
			{/each}
		</nav>
		{#if data.filter !== 'alle'}<input type="hidden" name="filter" value={data.filter} />{/if}
		{#if data.q}<input type="hidden" name="q" value={data.q} />{/if}
		<label class="von">
			<span class="sr-only">Von</span>
			<select
				name="von"
				class="pille"
				class:an={!!data.von}
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
			>
				<option value="">Von: alle</option>
				{#each data.absender as a (a.id)}<option value={a.id} selected={data.von === a.id}>
						Von: {a.name}
					</option>{/each}
			</select>
		</label>
		<noscript><button class="knopf zweit" type="submit">Anwenden</button></noscript>
		{#if data.gesamt}<p class="zaehler">
				{data.items.length} von {mitZahl(data.gesamt, 'Beitrag', 'Beiträgen')}
			</p>{/if}
	</form>

	{#if leer}
		<p class="karte leer" role="status">
			{data.q ? `Keine Beiträge zu „${data.q}“ gefunden.` : 'Keine Beiträge gefunden.'}
			{#if data.q}
				<a class="knopf zweit" href="{resolve('/(app)/suche')}?q={encodeURIComponent(data.q)}">
					In allen Bereichen suchen
				</a>
			{/if}
		</p>
	{/if}

	{#if sichtbarAngeheftet.length}
		<section aria-labelledby="angeheftet-h" class="angeheftet" data-tour="angeheftet">
			<h2 id="angeheftet-h">
				<Icon d={PIN} size={14} stroke={2.2} />Angeheftet · {angeheftet.length}
			</h2>
			<ul>
				{#each sichtbarAngeheftet as item (item.id)}
					<li>
						<a href={resolve('/(app)/neuigkeiten/[id]', { id: item.id })}>
							<span class="pin-text">
								<span class="titellink">{item.title}</span>
								<span class="pin-meta">
									<strong>{item.sender.name}</strong> · {item.sender.label}
								</span>
							</span>
							<Icon d="M9 6l6 6l-6 6" size={18} stroke={2} />
						</a>
					</li>
				{/each}
			</ul>
			{#if angeheftet.length > data.angeheftetSichtbar}
				<button
					type="button"
					class="linkknopf"
					aria-expanded={alleAngehefteten}
					onclick={() => (alleAngehefteten = !alleAngehefteten)}
				>
					{alleAngehefteten
						? 'Weniger anzeigen'
						: `${angeheftet.length - data.angeheftetSichtbar} weitere angeheftete anzeigen`}
				</button>
			{/if}
		</section>
	{/if}

	<div class="liste">
		{#each gruppen as g, gi (g.monat)}
			<section class="monat" aria-labelledby="monat-{g.monat}">
				<h2 id="monat-{g.monat}">
					{g.titel}<span class="anzahl">{mitZahl(g.anzahl, 'Beitrag', 'Beiträge')}</span>
				</h2>
				{#each g.eintraege as item, i (item.id)}
					<Beitragskarte
						{item}
						ebene={3}
						kompakt={ansicht === 'kompakt'}
						tour={gi === 0 && i === 0 ? 'beitraege' : undefined}
					/>
				{/each}
			</section>
		{/each}
	</div>
	<MehrLaden
		geladen={data.items.length}
		gesamt={data.gesamt}
		schritt={data.schritt}
		href={mehrHref}
		einheit={['Beitrag', 'Beiträge']}
	/>
</div>

<style>
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.titel {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.stern {
		width: 44px;
		height: 44px;
		border: 0;
		background: transparent;
		color: var(--ac);
		font-size: 24px;
		cursor: pointer;
		border-radius: 10px;
	}
	.suchzeile {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.suche {
		flex: 0 1 560px;
		min-width: 0;
	}
	.suchzeile :global(.ansicht) {
		margin-left: auto;
	}
	.zaehler {
		margin: 0 0 0 auto;
		font-size: 14px;
		color: var(--mu);
	}
	@media (max-width: 599px) {
		.suche {
			flex: 1 1 0;
		}
		.zaehler {
			flex: 1 1 100%;
			margin: 0;
		}
	}
	.filter {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.pillen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.leer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		text-align: center;
		color: var(--mu);
		margin: 0;
	}
	.angeheftet {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 14px 16px;
		border-radius: 20px;
		background: var(--tint);
	}
	.angeheftet h2 {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 0 0 4px;
		font-size: 14px;
		font-weight: 700;
		color: var(--ac);
	}
	.angeheftet ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.angeheftet li {
		border-top: 1px solid var(--bd);
	}
	.angeheftet li a {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 6px;
		margin: 0 -6px;
		border-radius: 10px;
		color: var(--tx);
		text-decoration: none;
	}
	.angeheftet li a:hover {
		background: color-mix(in srgb, var(--sf) 50%, transparent);
	}
	.angeheftet li a :global(svg) {
		flex: none;
		color: var(--ac);
	}
	.pin-text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.pin-text .titellink {
		font-size: 16px;
	}
	.pin-meta {
		font-size: 13px;
		color: var(--mu);
	}
	.pin-meta strong {
		color: var(--tx);
	}
	.angeheftet .linkknopf {
		align-self: flex-start;
		min-height: 36px;
		padding: 0;
	}
	.liste,
	.monat {
		display: grid;
		gap: 16px;
	}
	.liste {
		gap: 20px;
	}
	.monat h2 {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 4px 0 -4px;
		font-size: 15px;
		color: var(--mu2, var(--tx));
	}
	.monat h2::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--bd);
	}
	.anzahl {
		font-weight: 500;
		color: var(--mu);
	}
</style>
