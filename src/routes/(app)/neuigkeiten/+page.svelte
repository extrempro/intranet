<script lang="ts">
	import { livesuche } from '#lib/livesuche.ts';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Beitragskarte from '#lib/components/Beitragskarte.svelte';
	import Icon from '#lib/components/Icon.svelte';
	const PIN = 'M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4M9 15l-4.5 4.5M14.5 4l5.5 5.5';

	let { data, form } = $props();

	let alleAngehefteten = $state(false);
	const angeheftet = $derived(data.items.filter((i) => i.pinned && !i.planned));
	const sichtbarAngeheftet = $derived(
		alleAngehefteten ? angeheftet : angeheftet.slice(0, data.angeheftetSichtbar)
	);
	const rest = $derived(data.items.filter((i) => !(i.pinned && !i.planned)));
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
			<a class="knopf" href={resolve('/(app)/neuigkeiten/neu')} data-tour="schreiben">
				Beitrag erstellen
			</a>
		{/if}
	</div>
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

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
	</form>

	{#if data.items.length === 0}
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
		<section aria-labelledby="angeheftet-h" class="angeheftet">
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

	<section aria-label="Beiträge" class="liste" data-tour="beitraege">
		{#each rest as item (item.id)}<Beitragskarte {item} />{/each}
	</section>
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
	.suche {
		max-width: 560px;
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
	select.pille {
		width: auto;
		min-height: 44px;
		padding: 8px 36px 8px 16px;
		border-color: var(--bd);
		border-radius: 999px;
		background: var(--sf)
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23525c57' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6l6 -6'/%3E%3C/svg%3E")
			no-repeat right 14px center / 14px;
		appearance: none;
		font-weight: 500;
	}
	select.pille.an {
		background-color: var(--fill);
		border-color: var(--fill);
		color: #fff;
		font-weight: 600;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6l6 -6'/%3E%3C/svg%3E");
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
	.liste {
		display: grid;
		gap: 16px;
	}
</style>
