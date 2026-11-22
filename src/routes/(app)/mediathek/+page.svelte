<script lang="ts">
	/** Mediathek (Kap. 8.15): Übersicht mit Suche und Filtern. */
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import VideoKarte from '#lib/components/VideoKarte.svelte';
	import { zeitText } from '#lib/mediathek.ts';

	let { data } = $props();
	let q = $state(untrack(() => data.filter.q));
</script>

<svelte:head><title>Mediathek · Intranet</title></svelte:head>

<div class="stapel seite">
	<div class="kopf">
		<div class="stapel eng">
			<h1>Mediathek</h1>
			<p class="hinweis">
				Videos aus den Abteilungen und Hubs, zum Beispiel Schulungen und Anleitungen.
			</p>
		</div>
		{#if data.darfHochladen}
			<a class="knopf" href={resolve('/(app)/mediathek/neu')}>Video hochladen</a>
		{/if}
	</div>

	{#if data.weiter.length}
		<section class="karte stapel eng" aria-labelledby="h-weiter">
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

	<form
		method="GET"
		action={resolve('/(app)/mediathek')}
		class="karte filter"
		role="search"
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
		{data.videos.length === 1 ? '1 Video' : `${data.videos.length} Videos`}
	</p>
	{#if data.videos.length}
		<ul class="raster">
			{#each data.videos as v (v.id)}<li><VideoKarte {v} /></li>{/each}
		</ul>
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
	.leer {
		text-align: center;
		color: var(--mu);
	}
</style>
