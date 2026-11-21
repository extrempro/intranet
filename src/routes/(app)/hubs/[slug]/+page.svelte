<script lang="ts">
	import { resolve } from '$app/paths';
	import Beitragskarte from '#lib/components/Beitragskarte.svelte';
	import HubGlocke from '#lib/components/HubGlocke.svelte';
	import { dayHeading, timeLabel } from '#lib/calendar.ts';
	import { berlinNow } from '#lib/canteen.ts';
	import type { HubSection } from '#lib/hubs.ts';

	let { data, form } = $props();
	const h = $derived(data.hub);
	const heute = berlinNow().date;
	const zeit = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' });
</script>

<svelte:head><title>{h.name} · Hubs · Intranet</title></svelte:head>

{#snippet abschnitt(key: HubSection)}
	{#if key === 'hinweis'}
		{#if h.notice}<p class="hinweisbox" role="note">{h.notice}</p>{/if}
	{:else if key === 'beitraege'}
		<section class="stapel" aria-labelledby="h-beitraege">
			<div class="zeilenkopf">
				<h2 id="h-beitraege">Beiträge</h2>
				{#if h.canPost && !h.resting}
					<a class="knopf klein" href="{resolve('/(app)/neuigkeiten/neu')}?absender={h.id}">
						Beitrag schreiben
					</a>
				{/if}
			</div>
			{#each data.beitraege as item (item.id)}
				<Beitragskarte {item} ebene={3} mitReaktionen={false} />
			{:else}
				<p class="karte hinweis">Noch keine Beiträge.</p>
			{/each}
		</section>
	{:else if key === 'termine'}
		<section class="karte" aria-labelledby="h-termine">
			<div class="zeilenkopf">
				<h2 id="h-termine">Termine</h2>
				{#if h.canPost}
					<a class="klein-link" href="{resolve('/(app)/kalender/neu')}?absender={h.id}">
						Termin anlegen
					</a>
				{/if}
			</div>
			{#if h.termine.length === 0}
				<p class="hinweis">Keine anstehenden Termine.</p>
			{:else}
				<ul class="liste">
					{#each h.termine as t (t.id)}
						<li>
							<a href={resolve('/(app)/kalender/[id]', { id: t.id })}>{t.title}</a>
							<span class="hinweis">
								{dayHeading(t.date, heute)} · {timeLabel(t)}{t.place ? ` · ${t.place}` : ''}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{:else if key === 'ansprechpersonen'}
		<section class="karte" aria-labelledby="h-team">
			<h2 id="h-team">Ansprechpersonen</h2>
			{#if h.team.length === 0}
				<p class="hinweis">Noch kein Hub-Team eingetragen.</p>
			{:else}
				<ul class="liste">
					{#each h.team as m (m.id)}
						<li>
							<strong>{m.name}</strong>
							<span class="hinweis">{[m.position, m.email].filter(Boolean).join(' · ')}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{:else if key === 'ueber'}
		{#if h.about}
			<section class="karte" aria-labelledby="h-ueber">
				<h2 id="h-ueber">Über uns</h2>
				<p class="text">{h.about}</p>
			</section>
		{/if}
	{/if}
{/snippet}

<div class="stapel">
	<a class="zurueck" href={resolve('/(app)/hubs')}>← Hubs</a>
	<div class="kopfzeile">
		<div>
			<div class="titel">
				<h1>{h.name}</h1>
				<HubGlocke
					hub={{ id: h.id, name: h.name, subscribed: h.subscribed, mandatory: h.mandatory }}
				/>
			</div>
			<p class="hinweis">
				{[
					'Hub',
					h.isCentral ? 'für alle Mandanten' : h.tenantName,
					h.mandatory ? 'Pflicht-Abo' : null
				]
					.filter(Boolean)
					.join(' · ')}
			</p>
		</div>
		{#if h.canManage || h.canAdminister}
			<a class="knopf zweit" href={resolve('/(app)/hubs/[slug]/bearbeiten', { slug: h.slug })}>
				Hub bearbeiten
			</a>
		{/if}
	</div>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}
	{#if h.resting}
		<p class="meldung" role="status">
			Dieser Hub ruht seit {zeit.format(h.resting)}. Es erscheinen keine neuen Beiträge.
		</p>
	{/if}

	<div class="spalten">
		<div class="stapel">
			{#each h.layout.main as key (key)}{@render abschnitt(key)}{/each}
		</div>
		<aside class="stapel">
			{#each h.layout.side as key (key)}{@render abschnitt(key)}{/each}
		</aside>
	</div>
</div>

<style>
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	.titel {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	h1 {
		margin: 0;
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.spalten {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(min(260px, 100%), 1fr);
		gap: 18px;
		align-items: start;
	}
	@media (max-width: 899px) {
		.spalten {
			grid-template-columns: 1fr;
		}
	}
	.zeilenkopf {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		margin-bottom: 6px;
	}
	.hinweisbox {
		margin: 0;
		padding: 12px 16px;
		border-radius: 14px;
		background: var(--tint);
		border: 1px solid var(--bd);
		white-space: pre-line;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 10px;
	}
	.liste li {
		display: flex;
		flex-direction: column;
	}
	.text {
		margin: 0;
		white-space: pre-line;
	}
	.klein {
		min-height: 38px;
		padding: 6px 12px;
		font-size: 14px;
	}
	.klein-link {
		font-size: 14px;
		font-weight: 600;
	}
</style>
