<script lang="ts">
	/** Mediathek (Kap. 8.15): Übersicht mit Suche und Filtern. */
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import EinfuehrungAngebot from '#lib/components/EinfuehrungAngebot.svelte';
	import EinfuehrungKnopf from '#lib/components/EinfuehrungKnopf.svelte';
	import VideoKarte from '#lib/components/VideoKarte.svelte';
	import { SEITEN } from '#lib/tours.ts';
	import MehrLaden from '#lib/components/MehrLaden.svelte';
	import { mitZahl } from '#lib/lange-liste.ts';
	import { STATUS_TEXT, zeitText } from '#lib/mediathek.ts';

	let { data } = $props();
	let q = $state(untrack(() => data.filter.q));
	/** Für Bearbeiter getrennt: was noch nicht veröffentlicht ist */
	const inArbeit = $derived(data.inArbeit);
	const veroeffentlicht = $derived(data.videos);
	const mehrHref = $derived.by(() => {
		const u = new URL(page.url.href);
		u.searchParams.set('anzahl', String(data.anzahl + data.schritt));
		return u.search;
	});
</script>

<svelte:head><title>Mediathek · Intranet</title></svelte:head>

<div class="stapel seite">
	<EinfuehrungAngebot tour={SEITEN.mediathek} />
	<div class="kopf">
		<div class="stapel eng">
			<h1 class="mit-hilfe">Mediathek <EinfuehrungKnopf tour={SEITEN.mediathek} /></h1>
			<p class="hinweis">
				Videos aus den Abteilungen und Hubs, zum Beispiel Schulungen und Anleitungen.
			</p>
		</div>
		{#if data.darfHochladen}
			<a class="knopf" href={resolve('/(app)/mediathek/neu')} data-tour="hochladen">
				Video hochladen
			</a>
		{/if}
	</div>

	{#if data.weiter.length}
		<section class="karte stapel eng" aria-labelledby="h-weiter" data-tour="weiter">
			<h2 id="h-weiter">Weiter ansehen</h2>
			<ul class="weiter">
				{#each data.weiter as w (w.id)}
					<li>
						<a href={resolve('/(app)/mediathek/[id]', { id: w.id })}>{w.title}</a>
						<span class="hinweis">
							{w.unitName} · bei {zeitText(w.positionSec)} von {zeitText(w.durationSec)}
						</span>
						<progress max={w.durationSec} value={w.positionSec} aria-hidden="true"></progress>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if inArbeit.length}
		<section class="karte stapel eng arbeit" aria-labelledby="h-arbeit">
			<h2 id="h-arbeit">In Arbeit und Entwürfe</h2>
			<p class="hinweis">
				Noch nicht veröffentlicht: Diese Videos sehen nur Personen mit dem Recht „Mediathek“ in der
				jeweiligen Abteilung oder dem Hub, alle anderen noch nicht.
			</p>
			<ul class="arbeitsliste">
				{#each inArbeit as v (v.id)}
					<li>
						<a href={resolve('/(app)/mediathek/[id]/bearbeiten', { id: v.id })}>{v.title}</a>
						<span class="hinweis">{v.unitName}</span>
						<span class="stand s-{v.status}">
							{STATUS_TEXT[v.status] ?? v.status}{v.status === 'umwandeln'
								? ` · ${v.progress} %`
								: ''}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<form
		method="GET"
		action={resolve('/(app)/mediathek')}
		class="karte filter"
		role="search"
		data-tour="mediathek-suche"
		data-sveltekit-keepfocus
		data-sveltekit-noscroll
	>
		<label class="feld breit">
			<span>Suchen</span>
			<input name="q" type="search" bind:value={q} placeholder="Titel, Beschreibung, Untertitel" />
		</label>
		<label class="feld">
			<span>Von</span>
			<select
				name="einheit"
				value={data.filter.einheit}
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
			>
				<option value="">Alle Abteilungen und Hubs</option>
				{#each data.einheiten as u (u.id)}<option value={u.id}>{u.name}</option>{/each}
			</select>
		</label>
		<label class="feld">
			<span>Thema</span>
			<select
				name="thema"
				value={data.filter.thema}
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
			>
				<option value="">Alle Themen</option>
				{#each data.themen as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
				<option value="ohne">Ohne Thema</option>
			</select>
		</label>
		<button class="knopf zweit" type="submit">Suchen</button>
	</form>

	<p class="hinweis" role="status">
		{veroeffentlicht.length < data.gesamt
			? `${veroeffentlicht.length} von ${mitZahl(data.gesamt, 'Video', 'Videos')}`
			: mitZahl(data.gesamt, 'Video', 'Videos')}
	</p>
	{#if veroeffentlicht.length}
		<ul class="raster" id="videoraster">
			{#each veroeffentlicht as v, i (v.id)}<li
					data-eintrag
					data-tour={i === 0 ? 'video' : undefined}
				>
					<VideoKarte {v} />
				</li>{/each}
		</ul>
		<MehrLaden
			geladen={veroeffentlicht.length}
			gesamt={data.gesamt}
			schritt={data.schritt}
			href={mehrHref}
			einheit={['Video', 'Videos']}
			verb="weitere anzeigen"
			bereich="videoraster"
		/>
	{:else}
		<p class="karte leer">Keine Videos gefunden.</p>
	{/if}
</div>

<style>
	.seite {
		max-width: 72rem;
	}
	h1 {
		margin: 0;
	}
	p {
		margin: 0;
	}
	.eng {
		gap: 4px;
	}
	.kopf {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 12px;
	}
	.filter {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
	}
	.filter .feld {
		flex: 1 1 180px;
	}
	.filter .breit {
		flex: 2 1 260px;
	}
	.raster {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
		gap: 16px;
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.weiter {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr));
		gap: 12px 20px;
	}
	.weiter li {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.weiter a {
		font-weight: 600;
	}
	.weiter progress {
		width: 100%;
		height: 6px;
	}
	.arbeitsliste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.arbeitsliste li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 12px;
		padding: 8px 0;
		border-top: 1px solid var(--bd);
	}
	.arbeitsliste a {
		font-weight: 600;
	}
	.stand {
		margin-left: auto;
		font-size: 12px;
		font-weight: 700;
		border-radius: 999px;
		padding: 2px 10px;
		background: var(--warn-bg);
		color: var(--warn-tx);
		border: 1px solid var(--warn-bd);
	}
	.stand.s-fehler {
		background: var(--err-bg);
		color: var(--err-tx);
		border-color: var(--err-bd);
	}
	.leer {
		text-align: center;
		color: var(--mu);
	}
</style>
