<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { actionUrl } from '#lib/action-url.ts';
	import { page } from '$app/state';
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
	const monatHref = (monat: string, tag?: string) =>
		`?ansicht=monat&monat=${monat}${tag ? `&tag=${tag}` : ''}`;
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
			<a class="knopf" href="{resolve('/(app)/kalender/neu')}{data.tag ? `?tag=${data.tag}` : ''}">
				Termin anlegen
			</a>
		{/if}
	</div>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	<form method="GET" class="suche" role="search">
		{#if data.monatsansicht}<input type="hidden" name="ansicht" value="monat" />{/if}
		<label class="feld">
			<span class="sr-only">Im Kalender suchen</span>
			<input
				type="search"
				name="q"
				value={data.q}
				maxlength="100"
				placeholder="Im Kalender suchen …"
			/>
		</label>
		<button class="knopf zweit" type="submit">Suchen</button>
	</form>

	<div class="filter" role="group" aria-label="Kalender filtern" data-tour="ansicht">
		<a class="pille" href="?" aria-current={!data.monatsansicht ? 'true' : undefined}>Liste</a>
		<a
			class="pille"
			href={monatHref(data.monat)}
			aria-current={data.monatsansicht ? 'true' : undefined}
		>
			Monat
		</a>
		<details class="aus" data-tour="mandanten">
			<summary class="pille">{ausLabel} ▾</summary>
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
								<span class="balken" class:fremd={!t.own} aria-hidden="true"></span>
								<span class="was">
									<strong>{t.title}</strong>
									<span class="hinweis">{[t.unitName, t.place].filter(Boolean).join(' · ')}</span>
								</span>
								{#if t.subscribed}<span class="schild" title="Du hast diesen Hub abonniert">
										Abo
									</span>{/if}
								{#if !t.own}<span class="schild rand">{t.tenantShort}</span>{/if}
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
