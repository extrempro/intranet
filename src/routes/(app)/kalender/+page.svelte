<script lang="ts">
	import { livesuche } from '#lib/livesuche.ts';
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { actionUrl } from '#lib/action-url.ts';
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import { dayHeading, monthCells, monthLabel, shiftMonth, timeLabel } from '#lib/calendar.ts';

	let { data, form } = $props();
	type Termin = (typeof data.termine)[number];

	const nachTag = $derived.by(() => {
		// Neu berechnet bei jeder Änderung der Daten, daher keine reaktive Map nötig
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const m = new Map<string, Termin[]>();
		for (const t of data.termine) m.set(t.date, [...(m.get(t.date) ?? []), t]);
		return m;
	});
	const tage = $derived(
		data.monatsansicht
			? data.tag
				? [[data.tag, nachTag.get(data.tag) ?? []] as const]
				: []
			: [...nachTag.entries()]
	);
	const weitere = $derived(data.mandanten.filter((m) => m.an && !m.eigener));
	const ausLabel = $derived(
		weitere.length
			? `Aus: dein Mandant + ${weitere.map((m) => m.short).join(', ')}`
			: 'Aus: dein Mandant'
	);
	const QUELLEN = [
		{ k: 'einheit', l: 'Abteilungen und Stabsstellen' },
		{ k: 'hub', l: 'Hubs' }
	];
	const gefiltert = $derived(data.quellen.length < QUELLEN.length);
	const quelleQs = $derived(gefiltert ? data.quellen.map((q) => `&quelle=${q}`).join('') : '');
	const quelleLabel = $derived(
		gefiltert
			? `Quelle: ${QUELLEN.filter((q) => data.quellen.includes(q.k))
					.map((q) => (q.k === 'hub' ? 'Hubs' : 'Abteilungen'))
					.join(', ')}`
			: 'Quelle: alle'
	);
	const anzahl = (k: string) =>
		data.termine.filter((t) => (t.isHub ? 'hub' : 'einheit') === k).length;
	const monatHref = (monat: string, tag?: string) =>
		`?ansicht=monat&monat=${monat}${tag ? `&tag=${tag}` : ''}${quelleQs}`;
	const GLOCKE =
		'M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6M9 17v1a3 3 0 0 0 6 0v-1';
	const wochentage = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
	import EinfuehrungAngebot from '#lib/components/EinfuehrungAngebot.svelte';
	import EinfuehrungKnopf from '#lib/components/EinfuehrungKnopf.svelte';
	import { SEITEN } from '#lib/tours.ts';
</script>

<svelte:head><title>Kalender · Intranet</title></svelte:head>

<div class="stapel">
	<EinfuehrungAngebot tour={SEITEN.kalender} />
	<div class="kopfzeile">
		<div class="titel">
			<h1>Kalender</h1>
			<EinfuehrungKnopf tour={SEITEN.kalender} />
			<form method="POST" action={actionUrl(page.url.search, 'favorit')} use:enhance>
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
		{#if data.darfAnlegen}
			<a
				class="knopf hauptaktion"
				href="{resolve('/(app)/kalender/neu')}{data.tag ? `?tag=${data.tag}` : ''}"
			>
				Termin anlegen
			</a>
		{/if}
	</div>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	<form
		method="GET"
		class="suche"
		role="search"
		data-sveltekit-reset="false"
		data-sveltekit-replacestate
	>
		{#if data.monatsansicht}<input type="hidden" name="ansicht" value="monat" />{/if}
		{#if gefiltert}{#each data.quellen as q (q)}<input
					type="hidden"
					name="quelle"
					value={q}
				/>{/each}{/if}
		<label class="feld">
			<span class="sr-only">Im Kalender suchen</span>
			<input
				use:livesuche
				type="search"
				name="q"
				value={data.q}
				maxlength="100"
				placeholder="Im Kalender suchen …"
			/>
		</label>
	</form>

	<div class="filter" role="group" aria-label="Kalender filtern" data-tour="ansicht">
		<a
			class="pille"
			href="?{quelleQs.slice(1)}"
			aria-current={!data.monatsansicht ? 'true' : undefined}
		>
			Liste
		</a>
		<a
			class="pille"
			href={monatHref(data.monat)}
			aria-current={data.monatsansicht ? 'true' : undefined}
		>
			Monat
		</a>
		<details class="aus">
			<summary class="pille" class:an={gefiltert}>{quelleLabel}</summary>
			<form method="GET" class="ausliste" data-sveltekit-reset="false">
				{#if data.monatsansicht}
					<input type="hidden" name="ansicht" value="monat" />
					<input type="hidden" name="monat" value={data.monat} />
				{/if}
				{#if data.tag}<input type="hidden" name="tag" value={data.tag} />{/if}
				{#if data.q}<input type="hidden" name="q" value={data.q} />{/if}
				{#each QUELLEN as q (q.k)}
					<label>
						<input type="checkbox" name="quelle" value={q.k} checked={data.quellen.includes(q.k)} />
						<i class="punkt" class:quelle-einheit={q.k === 'einheit'} aria-hidden="true"></i>
						<span>{q.l}</span>
						{#if data.quellen.includes(q.k)}<span class="hinweis">{anzahl(q.k)}</span>{/if}
					</label>
				{/each}
				<p class="hinweis klein-text">Ohne Auswahl werden alle Quellen gezeigt.</p>
				<button class="knopf klein" type="submit">Übernehmen</button>
			</form>
		</details>
		<details class="aus" data-tour="mandanten">
			<summary class="pille">{ausLabel}</summary>
			<form method="POST" action={actionUrl(page.url.search, 'aus')} class="ausliste">
				<input type="hidden" name="zurueck" value={page.url.search} />
				{#each data.mandanten as m (m.id)}
					<label>
						<input type="checkbox" name="aus" value={m.id} checked={m.an} disabled={m.eigener} />
						<span>{m.name}</span>
						{#if m.eigener}<span class="hinweis">immer dabei</span>{/if}
					</label>
				{/each}
				<button class="knopf klein" type="submit">Übernehmen</button>
			</form>
		</details>
		<a class="abo aktionslink" href={resolve('/(app)/kalender/abo')} data-tour="abo">
			Kalender abonnieren
		</a>
	</div>

	{#if data.monatsansicht}
		<section class="karte monat" aria-label={monthLabel(data.monat)}>
			<div class="monatskopf">
				<a class="rund" href={monatHref(shiftMonth(data.monat, -1))} aria-label="Vorheriger Monat">
					‹
				</a>
				<h2>{monthLabel(data.monat)}</h2>
				<a class="rund" href={monatHref(shiftMonth(data.monat, 1))} aria-label="Nächster Monat">
					›
				</a>
			</div>
			<div class="raster">
				{#each wochentage as w (w)}<div class="wt" aria-hidden="true">{w}</div>{/each}
				{#each monthCells(data.monat) as tag, i (tag ?? `leer-${i}`)}
					{#if tag}
						{@const n = nachTag.get(tag)?.length ?? 0}
						<a
							class="zelle"
							class:heute={tag === data.heute}
							href={monatHref(data.monat, tag)}
							aria-current={tag === data.tag ? 'date' : undefined}
							aria-label="{dayHeading(tag, data.heute)}{n
								? `, ${n} ${n === 1 ? 'Termin' : 'Termine'}`
								: ''}"
						>
							<span class="nr">{Number(tag.slice(8))}</span>
							{#if n}<span class="punkte" aria-hidden="true">
									{'•'.repeat(Math.min(n, 3))}{n > 3 ? '+' : ''}
								</span>{/if}
						</a>
					{:else}
						<span class="zelle leer"></span>
					{/if}
				{/each}
			</div>
		</section>
	{/if}

	{#each tage as [tag, liste] (tag)}
		<section class="karte tag" aria-labelledby="t-{tag}">
			<h2 id="t-{tag}">{dayHeading(tag, data.heute)}</h2>
			{#if liste.length === 0}
				<p class="hinweis">Keine Termine an diesem Tag.</p>
			{/if}
			<ul class="termine">
				{#each liste as t (t.id)}
					<li>
						<details>
							<summary>
								<span class="zeit">{timeLabel(t)}</span>
								<span
									class="balken"
									class:quelle-einheit={!t.isHub}
									class:fremd={!t.own}
									aria-hidden="true"
								></span>
								<span class="was">
									<strong>{t.title}</strong>
									<span class="hinweis">{[t.unitName, t.place].filter(Boolean).join(' · ')}</span>
								</span>
								{#if !t.own}<span class="schild rand">{t.tenantShort}</span>{/if}
								<span class="schild" class:quelle-einheit={!t.isHub}>{t.art}</span>
								{#if t.subscribed}<span class="glocke" title="Du hast diesen Hub abonniert">
										<Icon d={GLOCKE} size={16} stroke={2} />
										<span class="sr-only">abonniert</span>
									</span>{/if}
							</summary>
							<div class="mehr">
								{#if t.description}<p class="beschreibung">{t.description}</p>{/if}
								<div class="aktionen">
									<a
										class="knopf zweit klein"
										href={resolve('/(app)/kalender/[id]/ics', { id: t.id })}
										download
									>
										In Kalender
									</a>
									<a class="knopf zweit klein" href={resolve('/(app)/kalender/[id]', { id: t.id })}>
										Öffnen
									</a>
									{#if t.canEdit}
										<a
											class="knopf zweit klein"
											href={resolve('/(app)/kalender/[id]/bearbeiten', { id: t.id })}
										>
											Bearbeiten
										</a>
									{/if}
								</div>
							</div>
						</details>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		{#if !data.monatsansicht}
			<p class="karte hinweis" role="status">
				{data.q ? `Keine Termine zu „${data.q}“ gefunden.` : 'Keine Termine für diese Auswahl.'}
			</p>
		{/if}
	{/each}
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
	h1 {
		margin: 0;
	}
	h2 {
		margin: 0;
		font-size: 1.05rem;
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
	.suche {
		display: flex;
		gap: 10px;
		max-width: 640px;
	}
	.suche .feld {
		flex: 1;
	}
	.filter {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.aus {
		position: relative;
	}
	.ausliste {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 30;
		min-width: 260px;
		display: grid;
		gap: 2px;
		padding: 8px;
		background: var(--sf);
		border: 1px solid var(--bd);
		border-radius: 14px;
		box-shadow: 0 10px 30px rgb(0 0 0 / 0.18);
	}
	.ausliste label {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 0 8px;
	}
	.ausliste input {
		width: 18px;
		height: 18px;
		accent-color: var(--fill);
	}
	.ausliste label span:first-of-type {
		flex: 1;
	}
	.abo {
		margin-left: auto;
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		font-weight: 600;
	}
	.klein {
		min-height: 40px;
		padding: 6px 12px;
		font-size: 14px;
	}
	.monat {
		display: grid;
		gap: 10px;
	}
	.monatskopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.rund {
		width: 44px;
		height: 44px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		color: var(--tx);
		font-size: 20px;
	}
	.raster {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 4px;
	}
	.wt {
		text-align: center;
		font-size: 12px;
		font-weight: 700;
		color: var(--mu);
		padding: 4px 0;
	}
	.zelle {
		min-height: 52px;
		border-radius: 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		color: var(--tx);
		text-decoration: none;
		border: 1px solid transparent;
	}
	a.zelle:hover {
		background: var(--bg);
	}
	.zelle.heute .nr {
		font-weight: 800;
		color: var(--ac);
	}
	.zelle[aria-current='date'] {
		border-color: var(--fill);
		background: var(--tint);
	}
	.punkte {
		color: var(--ac);
		font-size: 12px;
		line-height: 1;
	}
	.tag {
		padding-top: 10px;
		padding-bottom: 6px;
	}
	.termine {
		list-style: none;
		margin: 6px 0 0;
		padding: 0;
	}
	.termine > li {
		border-top: 1px solid var(--bd);
	}
	.termine summary {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		cursor: pointer;
		list-style: none;
	}
	.termine summary::-webkit-details-marker {
		display: none;
	}
	.zeit {
		flex: none;
		width: 92px;
		font-size: 14px;
		font-weight: 700;
	}
	.balken {
		flex: none;
		width: 4px;
		align-self: stretch;
		border-radius: 4px;
		background: var(--fill);
	}
	.glocke {
		display: inline-flex;
		color: var(--ac);
	}
	.punkt {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: 999px;
		background: var(--fill);
	}
	.punkt.quelle-einheit {
		background: var(--blau);
	}
	.klein-text {
		margin: 4px 8px;
		font-size: 12px;
	}
	.balken.fremd {
		background: var(--mu);
	}
	.was {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.mehr {
		display: grid;
		gap: 8px;
		padding: 0 0 12px 108px;
	}
	.beschreibung {
		margin: 0;
		white-space: pre-line;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	@media (max-width: 599px) {
		.zeit {
			width: 64px;
		}
		.mehr {
			padding-left: 0;
		}
		.abo {
			margin-left: 0;
		}
	}
</style>
