<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Beitragskarte from '#lib/components/Beitragskarte.svelte';

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

	<form method="GET" class="filter" data-sveltekit-keepfocus data-sveltekit-noscroll>
		<nav class="pillen" aria-label="Filter" data-tour="filter">
			{#each filter as f (f.k)}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- nur Suchparameter der aktuellen Seite -->
				<a href={href(f.k)} class="pille" aria-current={data.filter === f.k ? 'true' : undefined}>
					{f.l}
				</a>
			{/each}
		</nav>
		{#if data.filter !== 'alle'}<input type="hidden" name="filter" value={data.filter} />{/if}
		<label class="feld klein">
			<span class="sr-only">Von</span>
			<select name="von" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
				<option value="">Von: alle</option>
				{#each data.absender as a (a.id)}<option value={a.id} selected={data.von === a.id}>
						Von: {a.name}
					</option>{/each}
			</select>
		</label>
		<label class="feld suche">
			<span class="sr-only">In Neuigkeiten suchen</span>
			<input type="search" name="q" value={data.q} placeholder="In Neuigkeiten suchen" />
		</label>
		<button class="knopf zweit" type="submit">Suchen</button>
	</form>

	{#if data.items.length === 0}
		<p class="hinweis" role="status">Keine Beiträge gefunden.</p>
	{/if}

	{#if sichtbarAngeheftet.length}
		<section aria-label="Angeheftet" class="liste">
			{#each sichtbarAngeheftet as item (item.id)}<Beitragskarte {item} />{/each}
			{#if angeheftet.length > data.angeheftetSichtbar && !alleAngehefteten}
				<button type="button" class="linkknopf" onclick={() => (alleAngehefteten = true)}>
					{angeheftet.length - data.angeheftetSichtbar} weitere angeheftete anzeigen
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
	.filter {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.pillen {
		display: flex;
		gap: 6px;
	}
	.klein {
		width: auto;
	}
	.suche {
		flex: 1 1 220px;
	}
	.liste {
		display: grid;
		gap: 12px;
	}
</style>
