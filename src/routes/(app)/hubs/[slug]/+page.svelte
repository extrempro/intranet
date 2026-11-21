<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Avatar from '#lib/components/Avatar.svelte';
	import HubGlocke from '#lib/components/HubGlocke.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { animierteBilder } from '#lib/animiert.ts';
	import { timeLabel } from '#lib/calendar.ts';
	import { formatSize } from '#lib/format.ts';
	import { formatDay } from '#lib/news.ts';
	import { LINK_SYMBOLE, type HubSection } from '#lib/hubs.ts';

	let { data, form } = $props();
	const h = $derived(data.hub);
	const zeit = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' });
	const kurzDatum = new Intl.DateTimeFormat('de-DE', {
		day: '2-digit',
		month: '2-digit',
		timeZone: 'Europe/Berlin'
	});
	const tagMonat = (iso: string) => {
		const d = new Date(`${iso}T12:00:00Z`);
		return {
			tag: d.getUTCDate(),
			monat: d.toLocaleDateString('de-DE', { month: 'short', timeZone: 'UTC' }).replace('.', '')
		};
	};
	const STERN =
		'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z';
	const LINK =
		'M9 15l6 -6M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463';
	const PFEIL = 'M9 6l6 6l-6 6';
	const INFO = 'M12 9h.01M11 12h1v4h1M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18';
	const BRIEF =
		'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2zM3 7l9 6l9 -6';
	const CHAT =
		'M8 9h8M8 13h6M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z';
	const EXTERN =
		'M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6M11 13l9 -9M15 4h5v5';
	const BILD =
		'M15 8h.01M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3zM3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3';
	const symbol = (k: string) =>
		(LINK_SYMBOLE as Record<string, { d: string }>)[k]?.d ?? LINK_SYMBOLE.link.d;
	const TYP: Record<string, string> = {
		pdf: 'PDF',
		jpeg: 'JPG',
		png: 'PNG',
		webp: 'WebP',
		docx: 'Word',
		xlsx: 'Excel',
		pptx: 'PowerPoint'
	};
	const dokGruppen = $derived(
		[
			...h.ordner.map((o) => ({ id: o.id as string | null, name: o.name })),
			{ id: null, name: h.ordner.length ? 'Weitere' : '' }
		]
			.map((g) => ({ ...g, liste: h.dokumente.filter((d) => d.folderId === g.id) }))
			.filter((g) => g.liste.length)
	);

	let kopiert = $state(false);
	async function linkKopieren() {
		try {
			await navigator.clipboard.writeText(location.href.split('#')[0].split('?')[0]);
			kopiert = true;
			setTimeout(() => (kopiert = false), 2000);
		} catch {
			// ohne Zwischenablage: nichts tun
		}
	}
</script>

<svelte:head><title>{h.name} · Hubs · Intranet</title></svelte:head>

{#snippet abschnitt(key: HubSection)}
	{#if key === 'schnellzugriff'}
		{#if h.links.length}
			<section class="stapel eng" aria-labelledby="h-q">
				<h2 id="h-q">Schnellzugriff</h2>
				<ul class="kacheln">
					{#each h.links as l (l.id)}
						<li>
							<a
								class="karte kachel"
								href={l.url}
								target={l.extern ? '_blank' : undefined}
								rel={l.extern ? 'noopener noreferrer' : undefined}
							>
								<span class="kachelsymbol" aria-hidden="true"><Icon d={symbol(l.icon)} /></span>
								<strong class="kacheltitel">
									{l.label}
									{#if l.extern}<span class="extern">
											<Icon d={EXTERN} size={14} stroke={2} /><span class="sr-only">
												(öffnet in neuem Fenster)
											</span>
										</span>{/if}
								</strong>
								{#if l.description}<span class="unter">{l.description}</span>{/if}
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{:else if key === 'beitraege'}
		<section class="stapel eng" aria-labelledby="h-n">
			<div class="zeilenkopf">
				<h2 id="h-n">Neues zum Thema</h2>
				<div class="knoepfe">
					{#if h.canPost && !h.resting}
						<a class="knopf zweit klein" href="{resolve('/(app)/neuigkeiten/neu')}?absender={h.id}">
							Beitrag schreiben
						</a>
					{/if}
					{#if data.weitere}
						<a
							class="linkknopf"
							href="{resolve('/(app)/hubs/[slug]', { slug: h.slug })}?alle#h-n"
							data-sveltekit-noscroll
						>
							Alle anzeigen
						</a>
					{/if}
				</div>
			</div>
			{#if data.beitraege.length === 0}
				<p class="karte hinweis">Noch keine Beiträge.</p>
			{:else}
				<ul class="beitraege">
					{#each data.beitraege as b (b.id)}
						<li>
							<a class="karte beitrag" href={resolve('/(app)/neuigkeiten/[id]', { id: b.id })}>
								{#if b.bild}
									<img class="vorschau" src={b.bild} alt="" loading="lazy" />
								{:else}
									<span class="vorschau leer" aria-hidden="true"><Icon d={BILD} size={28} /></span>
								{/if}
								<span class="beitragtext">
									<strong>{b.title}</strong>
									<span class="unter">{formatDay(b.publishAt)}</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{:else if key === 'termine'}
		<section class="karte" aria-labelledby="h-t">
			<div class="zeilenkopf">
				<h2 id="h-t">Termine</h2>
				{#if h.canPost}
					<a class="klein-link" href="{resolve('/(app)/kalender/neu')}?absender={h.id}">
						Termin anlegen
					</a>
				{/if}
			</div>
			{#if h.termine.length === 0}
				<p class="hinweis">Keine anstehenden Termine.</p>
			{:else}
				<ul class="zeilen">
					{#each h.termine as t (t.id)}
						{@const d = tagMonat(t.date)}
						<li class="termin">
							<span class="datum" aria-hidden="true"><strong>{d.tag}</strong>{d.monat}</span>
							<span class="spalte">
								<a href={resolve('/(app)/kalender/[id]', { id: t.id })}>{t.title}</a>
								<span class="unter">
									<span class="sr-only">
										{zeit.format(new Date(`${t.date}T12:00:00Z`))},
									</span>{timeLabel(t)}{t.place ? ` · ${t.place}` : ''}
								</span>
							</span>
							<a
								class="knopf zweit klein"
								href={resolve('/(app)/kalender/[id]/ics', { id: t.id })}
								download
								aria-label="{t.title} in den Kalender übernehmen"
							>
								In Kalender
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{:else if key === 'dokumente'}
		{#if h.dokumente.length || h.canDocs}
			<section class="karte" aria-labelledby="h-d">
				<div class="zeilenkopf">
					<h2 id="h-d">Dokumente und Anleitungen</h2>
					{#if h.canDocs}
						<a
							class="klein-link"
							href="{resolve('/(app)/hubs/[slug]/bearbeiten', { slug: h.slug })}#dokumente"
						>
							Dokumente pflegen
						</a>
					{/if}
				</div>
				{#if h.dokumente.length === 0}
					<p class="hinweis">Noch keine Dokumente.</p>
				{/if}
				{#each dokGruppen as g (g.id ?? 'ohne')}
					{#if g.name}
						<details class="ordner" open={dokGruppen.length <= 3}>
							<summary><h3>{g.name} <span class="anzahl">({g.liste.length})</span></h3></summary>
							{@render dokListe(g.liste)}
						</details>
					{:else}
						{@render dokListe(g.liste)}
					{/if}
				{/each}
			</section>
		{/if}
	{:else if key === 'hubteam'}
		{#if h.team.length}
			<section class="karte" aria-labelledby="h-c">
				<h2 id="h-c">Hub-Team</h2>
				<p class="unter">
					Personen aus verschiedenen Abteilungen, die diesen Hub gemeinsam pflegen.
				</p>
				<ul class="zeilen">
					{#each h.team as m (m.id)}
						<li class="person">
							<Avatar name={m.name} foto={m.foto} groesse={44} />
							<span class="spalte">
								<span>
									<a class="name" href={resolve('/(app)/personen/[id]', { id: m.id })}>
										{m.name}
									</a>{#if m.koordination}&nbsp;<span class="schild">Koordination</span>{/if}
								</span>
								{#if m.task}<span class="unter">{m.task}</span>{/if}
								{#if m.abteilung}
									{#if m.abteilungSlug}
										<a
											class="unter"
											href={resolve('/(app)/abteilungen/[slug]', { slug: m.abteilungSlug })}
										>
											{m.abteilung}
										</a>
									{:else}<span class="unter">{m.abteilung}</span>{/if}
								{/if}
							</span>
							<a
								class="rund"
								href="https://teams.microsoft.com/l/chat/0/0?users={encodeURIComponent(m.email)}"
								target="_blank"
								rel="noopener noreferrer"
								aria-label="Teams-Chat mit {m.name}"
								title="Teams-Chat mit {m.name}"
							>
								<Icon d={CHAT} size={18} stroke={1.8} />
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{:else if key === 'ansprechpersonen'}
		{#if h.kontakte.length}
			<section class="karte" aria-labelledby="h-a">
				<h2 id="h-a">Ansprechpersonen</h2>
				<ul class="zeilen">
					{#each h.kontakte as k (k.id)}
						<li class="person">
							<span class="spalte">
								<a class="name" href={resolve('/(app)/personen/[id]', { id: k.personId })}>
									{k.name}
								</a>
								{#if k.task}<span class="unter">{k.task}</span>{/if}
							</span>
							<a
								class="rund"
								href="mailto:{k.email}"
								aria-label="E-Mail an {k.name}"
								title="E-Mail an {k.name}"
							>
								<Icon d={BRIEF} size={18} stroke={1.8} />
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{:else if key === 'faqs'}
		{#if h.faqs.length || h.canFaqs}
			<section class="karte" aria-labelledby="h-f">
				<div class="zeilenkopf">
					<h2 id="h-f">Häufige Fragen</h2>
					{#if h.canFaqs}
						<a class="klein-link" href="{resolve('/(app)/faqs/neu')}?einheit={h.id}">FAQ anlegen</a>
					{/if}
				</div>
				{#if h.faqs.length === 0}
					<p class="hinweis">Noch keine FAQs.</p>
				{:else}
					<ul class="zeilen">
						{#each h.faqs.slice(0, 6) as f (f.id)}
							<li>
								<a class="frage" href="{resolve('/(app)/faqs')}?einheit={h.id}#faq-{f.id}">
									<span>{f.question}</span>
									<Icon d={PFEIL} size={16} stroke={2} />
								</a>
							</li>
						{/each}
					</ul>
					<a class="knopf zweit klein" href="{resolve('/(app)/faqs')}?einheit={h.id}">
						Alle FAQs ({h.faqs.length})
					</a>
				{/if}
			</section>
		{/if}
	{:else if key === 'ueber'}
		{#if h.aboutHtml}
			<section class="karte" aria-labelledby="h-ueber">
				<h2 id="h-ueber">Über uns</h2>
				<!-- Vom Server bereinigt (nur erlaubte Elemente und eigene Bilder) -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="text" use:animierteBilder>{@html h.aboutHtml}</div>
			</section>
		{/if}
	{/if}
{/snippet}

{#snippet dokListe(
	liste: {
		id: string;
		fileId: string;
		title: string;
		description: string | null;
		size: number;
		kind: string;
		updatedAt: Date;
	}[]
)}
	<ul class="zeilen">
		{#each liste as d (d.id)}
			<li class="dokument">
				<span class="typ" aria-hidden="true">{TYP[d.kind] ?? d.kind.toUpperCase()}</span>
				<span class="spalte">
					<a href={resolve('/(app)/dateien/[id]', { id: d.fileId })} target="_blank" rel="noopener">
						{d.title}
					</a>
					{#if d.description}<span class="unter">{d.description}</span>{/if}
					<span class="unter">
						{TYP[d.kind] ?? d.kind.toUpperCase()}&nbsp;· {formatSize(d.size)}&nbsp;· aktualisiert am {kurzDatum.format(
							new Date(d.updatedAt)
						)}
					</span>
				</span>
				<a
					class="knopf zweit klein"
					href="{resolve('/(app)/dateien/[id]', { id: d.fileId })}?download"
					aria-label="{d.title} herunterladen"
				>
					Herunterladen
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

<div class="stapel">
	<section
		class="kopf"
		class:mitbild={Boolean(h.coverUrl)}
		style:--titelbild={h.coverUrl ? `url("${h.coverUrl}")` : undefined}
		aria-labelledby="h-h"
	>
		{#if !h.coverUrl}
			<span class="kreis eins" aria-hidden="true"></span>
			<span class="kreis zwei" aria-hidden="true"></span>
		{/if}
		<div class="kopfzeile">
			{#if h.iconUrl}<img class="hubsymbol" src={h.iconUrl} alt="" />{/if}
			<span class="chip">
				Hub&nbsp;· {h.isCentral ? 'Thema für alle Mandanten' : h.tenantName}{#if h.mandatory}&nbsp;·
					Pflicht-Abo{/if}
			</span>
		</div>
		<h1 id="h-h">{h.name}</h1>
		{#if h.about}<p class="intro">{h.about}</p>{/if}
		<div class="aktionen">
			<HubGlocke
				aufFarbe
				hub={{ id: h.id, name: h.name, subscribed: h.subscribed, mandatory: h.mandatory }}
			/>
			<form method="POST" action="?/favorit" use:enhance>
				<button
					class="rund hell"
					class:an={data.favorit}
					type="submit"
					aria-pressed={data.favorit}
					aria-label={data.favorit ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten hinzufügen'}
					title={data.favorit ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten'}
				>
					<Icon d={STERN} size={20} stroke={1.8} />
				</button>
			</form>
			<button
				type="button"
				class="rund hell"
				onclick={linkKopieren}
				aria-label={kopiert ? 'Link kopiert' : 'Link kopieren'}
				title={kopiert ? 'Link kopiert' : 'Link kopieren'}
			>
				<Icon d={LINK} size={18} stroke={2} />
			</button>
			{#if h.canManage || h.canDocs}
				<a class="knopf weiss" href={resolve('/(app)/hubs/[slug]/bearbeiten', { slug: h.slug })}>
					{h.canManage ? 'Bearbeiten' : 'Dokumente pflegen'}
				</a>
			{/if}
			{#if h.team.length}
				<span class="gesichter">
					<span class="stapelbild" aria-hidden="true">
						{#each h.team.slice(0, 4) as m (m.id)}<Avatar
								name={m.name}
								foto={m.foto}
								groesse={32}
							/>{/each}
					</span>
					<span>
						Hub-Team{#if h.teamAbteilungen}&nbsp;aus {h.teamAbteilungen === 1
								? '1 Abteilung'
								: `${h.teamAbteilungen} Abteilungen`}{/if}{#if h.abonnierende !== null}&nbsp;·
							{h.abonnierende}
							{h.abonnierende === 1 ? 'Abo' : 'Abos'}{/if}
					</span>
				</span>
			{/if}
		</div>
	</section>

	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}
	{#if h.resting}
		<p class="status" role="status">
			<strong>Ruht</strong><span>
				Dieser Hub ruht seit {zeit.format(h.resting)}. Es erscheinen keine neuen Beiträge, alles
				bleibt lesbar.
			</span>
		</p>
	{/if}
	{#if h.notice}
		<div class="banner" role="note">
			<Icon d={INFO} size={20} stroke={2} />
			<span class="bannertext">{h.notice}</span>
			{#if h.noticeUntil}<span class="bis">
					bis {zeit.format(new Date(`${h.noticeUntil}T12:00:00Z`))}
				</span>{/if}
		</div>
	{/if}

	<div class="spalten">
		<div class="stapel">
			{#each h.layout.main as key (key)}{@render abschnitt(key)}{/each}
		</div>
		<aside class="stapel" aria-label="Mehr zum Hub">
			{#each h.layout.side as key (key)}{@render abschnitt(key)}{/each}
		</aside>
	</div>
</div>

<style>
	/* Kopf: Akzentfarbe mit Kreisen, oder das Titelbild abgedunkelt */
	.kopf {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 28px;
		border-radius: 28px;
		background: var(--fill);
		color: #fff;
	}
	.kopf.mitbild {
		background:
			linear-gradient(90deg, rgb(0 0 0 / 0.72), rgb(0 0 0 / 0.35)),
			var(--titelbild) center / cover;
		min-height: 220px;
	}
	.kopf > * {
		position: relative;
	}
	.kreis {
		position: absolute;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.08);
	}
	.kreis.eins {
		right: -60px;
		top: -60px;
		width: 240px;
		height: 240px;
	}
	.kreis.zwei {
		right: 60px;
		bottom: -90px;
		width: 180px;
		height: 180px;
		background: rgb(255 255 255 / 0.06);
	}
	.kopf > .kreis {
		position: absolute;
	}
	.kopfzeile {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.hubsymbol {
		width: 56px;
		height: 56px;
		border-radius: 14px;
		border: 2px solid rgb(255 255 255 / 0.85);
		background: #fff;
	}
	.chip {
		font-size: 13px;
		font-weight: 600;
		padding: 4px 12px;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.18);
	}
	h1 {
		margin: 0;
		font-size: 34px;
		line-height: 1.15;
		overflow-wrap: anywhere;
	}
	.intro {
		margin: 0;
		max-width: 620px;
		font-size: 1.08em;
		color: rgb(255 255 255 / 0.92);
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.rund {
		width: 44px;
		height: 44px;
		flex: none;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.rund.hell {
		background: transparent;
		border-color: rgb(255 255 255 / 0.6);
		color: #fff;
	}
	.rund.hell.an {
		background: #fff;
		color: var(--fill);
	}
	.rund.hell.an :global(svg) {
		fill: currentColor;
	}
	.knopf.weiss {
		background: #fff;
		color: var(--fill);
		border-color: #fff;
	}
	.gesichter {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		margin-left: 6px;
		font-size: 13px;
		color: rgb(255 255 255 / 0.9);
	}
	.stapelbild {
		display: inline-flex;
	}
	.stapelbild :global(.avatar) {
		margin-left: -8px;
		border: 2px solid var(--fill);
	}
	.stapelbild :global(.avatar:first-child) {
		margin-left: 0;
	}
	@media (max-width: 599px) {
		.kopf {
			padding: 22px 18px;
			border-radius: 22px;
		}
		h1 {
			font-size: 28px;
		}
		.gesichter {
			margin-left: 0;
			flex-basis: 100%;
		}
	}

	.status {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		margin: 0;
		padding: 12px 16px;
		border-radius: 14px;
		background: var(--bg);
		border: 1px dashed var(--bd);
	}
	.status span {
		color: var(--mu);
	}
	.banner {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 12px 16px;
		border-radius: 14px;
		background: var(--warn-bg);
		border: 1px solid var(--warn-bd);
		color: var(--warn-tx);
	}
	.bannertext {
		flex: 1;
		white-space: pre-line;
	}
	.bis {
		font-size: 13px;
		opacity: 0.85;
	}

	.spalten {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(min(280px, 100%), 1fr);
		gap: 20px;
		align-items: start;
	}
	@media (max-width: 899px) {
		.spalten {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	.eng {
		gap: 12px;
	}
	h2 {
		margin: 0;
		font-size: 20px;
	}
	.karte h2 {
		margin-bottom: 6px;
	}
	h3 {
		display: inline;
		margin: 0;
		font-size: 1rem;
	}
	.anzahl {
		font-weight: 400;
		color: var(--mu);
	}
	.zeilenkopf {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 6px 10px;
	}
	.zeilenkopf h2 {
		margin-bottom: 0;
	}
	.karte .zeilenkopf {
		margin-bottom: 6px;
	}
	.knoepfe {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 14px;
	}
	.klein {
		min-height: 40px;
		padding: 6px 14px;
		font-size: 14px;
	}
	.klein-link {
		font-size: 14px;
		font-weight: 600;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
	}
	a.unter {
		color: var(--ac);
	}
	.spalte {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
		overflow-wrap: anywhere;
	}

	/* Schnellzugriff */
	.kacheln {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(190px, 100%), 1fr));
		gap: 12px;
	}
	.kachel {
		display: flex;
		flex-direction: column;
		gap: 8px;
		height: 100%;
		box-sizing: border-box;
		border-radius: 20px;
		color: var(--tx);
		text-decoration: none;
	}
	.kachel:hover {
		border-color: var(--ac);
	}
	.kachelsymbol {
		display: inline-grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--tint);
		color: var(--ac);
	}
	.kacheltitel {
		overflow-wrap: anywhere;
	}
	.extern {
		display: inline-flex;
		vertical-align: -2px;
		margin-left: 4px;
		color: var(--mu);
	}

	/* Neues zum Thema */
	.beitraege {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(230px, 100%), 1fr));
		gap: 12px;
	}
	.beitrag {
		display: flex;
		flex-direction: column;
		height: 100%;
		box-sizing: border-box;
		padding: 0;
		overflow: hidden;
		border-radius: 20px;
		color: var(--tx);
		text-decoration: none;
	}
	.beitrag:hover {
		border-color: var(--ac);
	}
	.vorschau {
		width: 100%;
		height: 120px;
		object-fit: cover;
	}
	.vorschau.leer {
		display: grid;
		place-items: center;
		background: var(--tint);
		color: var(--ac);
	}
	.beitragtext {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 14px;
		overflow-wrap: anywhere;
	}

	/* Listen in Karten */
	.zeilen {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.zeilen > li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.zeilen > li:first-child {
		border-top: 0;
	}
	.datum {
		flex: none;
		width: 52px;
		padding: 6px 0;
		border-radius: 12px;
		background: var(--tint);
		color: var(--ac);
		display: flex;
		flex-direction: column;
		align-items: center;
		font-size: 12px;
		line-height: 1.2;
	}
	.datum strong {
		font-size: 18px;
	}
	.termin,
	.dokument {
		flex-wrap: wrap;
	}
	.typ {
		flex: none;
		min-width: 44px;
		padding: 6px 4px;
		border-radius: 10px;
		background: var(--tint);
		color: var(--ac);
		font-size: 11px;
		font-weight: 700;
		text-align: center;
	}
	.person .name {
		font-weight: 600;
	}
	.frage {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 36px;
		text-decoration: none;
	}
	.karte > .knopf {
		margin-top: 8px;
	}
	.ordner {
		border-top: 1px solid var(--bd);
		padding-top: 8px;
		margin-top: 4px;
	}
	.ordner summary {
		cursor: pointer;
		min-height: 40px;
		display: flex;
		align-items: center;
	}
</style>
