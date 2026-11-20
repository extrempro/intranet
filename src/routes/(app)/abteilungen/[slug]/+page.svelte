<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { dayHeading, timeLabel } from '#lib/calendar.ts';
	import { berlinNow } from '#lib/canteen.ts';
	import { groupResponsibilities, matchesSearch } from '#lib/departments.ts';
	import { formatDay } from '#lib/news.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';

	let { data, form } = $props();
	const e = $derived(data.einheit);
	const heute = berlinNow().date;
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeZone: 'Europe/Berlin'
	});
	let suche = $state('');

	const gefiltert = $derived(
		e.zustaendigkeiten.filter((z) =>
			matchesSearch(suche, [z.topic, z.description, z.groupName, ...z.keywords, z.kontakt?.name])
		)
	);
	const gruppen = $derived(groupResponsibilities(gefiltert));
	const leitung = $derived(
		[
			e.leitung && { rolle: 'Leitung', p: e.leitung },
			e.zweiteLeitung && { rolle: 'Leitung', p: e.zweiteLeitung },
			e.stellvertretung && { rolle: 'Stellvertretung', p: e.stellvertretung }
		].filter(Boolean) as { rolle: string; p: { id: string; name: string; email: string } }[]
	);
	const extern = (url: string) => !url.startsWith('/');
	let teamOffen = $state(false);
	let kopiert = $state(false);
	async function linkKopieren() {
		try {
			await navigator.clipboard.writeText(location.href.split('#')[0]);
			kopiert = true;
			setTimeout(() => (kopiert = false), 2000);
		} catch {
			// ohne Zwischenablage: nichts tun
		}
	}
	const anker = $derived(
		[
			e.zustaendigkeiten.length && { id: 'wer', l: 'Wer hilft bei was?' },
			e.team.length && { id: 'team', l: 'Team' },
			e.about && { id: 'ueber', l: 'Über uns' },
			(e.termine.length || e.canEvents) && { id: 'termine', l: 'Termine' },
			(data.beitraege.length || e.canPost) && { id: 'beitraege', l: 'Beiträge' },
			(e.faqs.length || e.canFaqs) && { id: 'faqs', l: 'FAQs' }
		].filter(Boolean) as { id: string; l: string }[]
	);
	const monat = new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' });
	const tagUndMonat = (d: string) => {
		const x = new Date(`${d}T12:00:00Z`);
		return { tag: x.getUTCDate(), monat: monat.format(x).replace('.', '').toUpperCase() };
	};
	const teamNamen = $derived.by(() => {
		const n = e.team.map((m) => m.name);
		if (n.length <= 3) return n.join(', ');
		return `${n.slice(0, 3).join(', ')} und weitere`;
	});
	const GEBAEUDE = 'M3 21h18M5 21v-14l8 -4v18M19 21v-10l-6 -4M9 9v.01M9 12v.01M9 15v.01M9 18v.01';
	const STERN =
		'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z';
	const LINK =
		'M9 15l6 -6M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463';
	const PFEIL = 'M9 6l6 6l-6 6';
	const BRIEF =
		'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2zM3 7l9 6l9 -6';
	const TELEFON =
		'M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2';
	const UHR = 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M12 7v5l3 3';
	const ORT =
		'M12 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M17.66 16.66l-4.24 4.24a2 2 0 0 1 -2.83 0l-4.25 -4.24a8 8 0 1 1 11.31 0z';
	const LINKSYMBOL = 'M9 15l6 -6M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464';
</script>

<svelte:head><title>{e.name} · Abteilungen · Intranet</title></svelte:head>

<div class="seite">
	<section class="kopfblock" aria-labelledby="u-h">
		<div class="kopfzeile">
			<div class="identitaet">
				<span class="symbol" aria-hidden="true"><Icon d={GEBAEUDE} size={30} stroke={1.6} /></span>
				<div class="namen">
					<span class="art">{e.label} · {e.isCentral ? 'für alle Mandanten' : e.tenantName}</span>
					<h1 id="u-h">{e.name}</h1>
					{#if e.tagline}<span class="kurz">{e.tagline}</span>{/if}
					{#if leitung.length}
						<span class="leitung">
							{#each leitung as l, i (l.p.id)}
								{#if i}<span aria-hidden="true"> · </span>{/if}
								{l.rolle}:
								<a href={resolve('/(app)/personen/[id]', { id: l.p.id })}>{l.p.name}</a>
							{/each}
						</span>
					{/if}
				</div>
			</div>
			<div class="werkzeuge">
				<form method="POST" action="?/favorit" use:enhance>
					<button
						class="rund"
						class:an={data.favorit}
						type="submit"
						aria-pressed={data.favorit}
						aria-label={data.favorit
							? 'Aus den Favoriten entfernen'
							: 'Zu den Favoriten hinzufügen'}
						title={data.favorit ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten'}
					>
						<Icon d={STERN} size={20} stroke={1.8} />
					</button>
				</form>
				<button
					type="button"
					class="rund"
					onclick={linkKopieren}
					aria-label={kopiert ? 'Link kopiert' : 'Link kopieren'}
					title={kopiert ? 'Link kopiert' : 'Link kopieren'}
				>
					<Icon d={LINK} size={18} stroke={2} />
				</button>
				{#if e.canManage || e.canAdminister}
					<a class="knopf" href={resolve('/(app)/abteilungen/[slug]/bearbeiten', { slug: e.slug })}>
						Bearbeiten
					</a>
				{/if}
			</div>
		</div>
		{#if e.kontakt.email || e.kontakt.telefon || e.kontakt.sprechzeiten || e.kontakt.raum}
			<ul class="chips" aria-label="Kontakt">
				{#if e.kontakt.email}<li>
						<a class="chip" href="mailto:{e.kontakt.email}">
							<Icon d={BRIEF} size={16} stroke={1.8} />{e.kontakt.email}
						</a>
					</li>{/if}
				{#if e.kontakt.telefon}<li>
						<a class="chip" href="tel:{e.kontakt.telefon.replace(/[^0-9+]/g, '')}">
							<Icon d={TELEFON} size={16} stroke={1.8} />{e.kontakt.telefon}
						</a>
					</li>{/if}
				{#if e.kontakt.sprechzeiten}<li>
						<span class="chip">
							<Icon d={UHR} size={16} stroke={1.8} />Sprechzeiten {e.kontakt.sprechzeiten}
						</span>
					</li>{/if}
				{#if e.kontakt.raum}<li>
						<span class="chip"><Icon d={ORT} size={16} stroke={1.8} />{e.kontakt.raum}</span>
					</li>{/if}
			</ul>
		{/if}
	</section>

	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}

	{#if (e.canManage || e.canAdminister) && e.pruefung.ueberfaellig}
		<div class="meldung pruefen" role="status">
			<span>
				Die Zuständigkeiten wurden zuletzt am {datum.format(e.pruefung.geprueftAm!)} geprüft. Passt noch
				alles?
			</span>
			<form method="POST" action="?/geprueft" use:enhance>
				<button class="knopf klein" type="submit">Alles geprüft</button>
			</form>
		</div>
	{/if}

	{#if anker.length > 1}
		<nav class="anker" aria-label="Auf dieser Seite">
			{#each anker as a (a.id)}<a href="#u-{a.id}">{a.l}</a>{/each}
		</nav>
	{/if}

	<div class="spalten">
		<div class="haupt">
			{#if e.zustaendigkeiten.length}
				<section id="u-wer" class="karte block" aria-labelledby="h-wer">
					<div class="blockkopf">
						<div>
							<h2 id="h-wer">Wer hilft bei was?</h2>
							{#if e.pruefung.geprueftAm}
								<span class="unter">Zuletzt geprüft am {datum.format(e.pruefung.geprueftAm)}</span>
							{/if}
						</div>
						{#if e.zustaendigkeiten.length > 5}
							<label class="sr-only" for="zsuche">Thema suchen</label>
							<input
								id="zsuche"
								class="zsuche"
								type="search"
								bind:value={suche}
								placeholder="Thema suchen, z. B. Krankmeldung"
								autocomplete="off"
								maxlength="100"
							/>
						{/if}
					</div>
					{#if gefiltert.length === 0}
						<p class="hinweis">
							Kein Thema gefunden. Versuch ein anderes Wort oder die Suche oben.
						</p>
					{/if}
					{#each gruppen as g (g.group)}
						<div class="gruppe">
							{#if g.group}<h3>{g.group}</h3>{/if}
							<ul class="zliste">
								{#each g.items as z (z.id)}
									<li>
										<div class="thema">
											<strong>{z.topic}</strong>
											{#if z.description}<span class="unter">{z.description}</span>{/if}
											{#if z.keywords.length}
												<span class="stichworte">
													{#each z.keywords as k (k)}<span class="stichwort">{k}</span>{/each}
												</span>
											{/if}
											{#each z.links as l (l.url)}
												<a
													class="verweis"
													href={l.url}
													target={extern(l.url) ? '_blank' : undefined}
													rel={extern(l.url) ? 'noopener noreferrer' : undefined}
												>
													<Icon d={LINKSYMBOL} size={14} stroke={2} />{l.label}
												</a>
											{/each}
										</div>
										{#if z.kontakt}
											<div class="kontakt">
												<Avatar name={z.kontakt.name} groesse={40} />
												<span class="kontakttext">
													<a href={resolve('/(app)/personen/[id]', { id: z.kontakt.id })}>
														{z.kontakt.name}
													</a>
													<span class="unter">
														{#if z.kontakt.vertretung}Vertretung{/if}
														{#if z.kontakt.vertretung && z.kontakt.phone}
															·
														{/if}
														{#if z.kontakt.phone}
															<a class="tel" href="tel:{z.kontakt.phone}">{z.kontakt.phone}</a>
														{/if}
													</span>
												</span>
											</div>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</section>
			{/if}

			{#if e.team.length}
				<section id="u-team" class="karte block" aria-labelledby="h-team">
					<div class="blockkopf">
						<h2 id="h-team">Team <span class="anzahl">({e.team.length})</span></h2>
						{#if e.team.length > 1}
							<button
								type="button"
								class="knopf zweit rundknopf"
								aria-expanded={teamOffen}
								aria-controls="u-team-liste"
								onclick={() => (teamOffen = !teamOffen)}
							>
								{teamOffen ? 'Weniger anzeigen' : 'Alle anzeigen'}
							</button>
						{/if}
					</div>
					{#if !teamOffen && e.team.length > 1}
						<div class="stapelbild">
							<span class="gesichter" aria-hidden="true">
								{#each e.team.slice(0, 4) as m (m.id)}
									<Avatar name={m.name} foto={m.foto} groesse={36} />
								{/each}
							</span>
							<span class="unter">{teamNamen}</span>
						</div>
					{:else}
						<ul id="u-team-liste" class="team">
							{#each e.team as m (m.id)}
								<li>
									<Avatar name={m.name} foto={m.foto} groesse={44} />
									<div class="person">
										<a class="name" href={resolve('/(app)/personen/[id]', { id: m.id })}>
											{m.name}
										</a>
										{#if m.position}<span class="unter">{m.position}</span>{/if}
										<span class="unter">
											<a href="mailto:{m.email}">{m.email}</a>
											{#if m.phone}· <a href="tel:{m.phone}">{m.phone}</a>{/if}
											{#if m.mobile}· <a href="tel:{m.mobile}">{m.mobile}</a>{/if}
											{#if m.room}· Raum {m.room}{/if}
										</span>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}

			{#if e.about}
				<section id="u-ueber" class="karte block" aria-labelledby="h-ueber">
					<h2 id="h-ueber">Über uns</h2>
					<p class="text">{e.about}</p>
				</section>
			{/if}

			{#if !e.zustaendigkeiten.length && !e.team.length && !e.about}
				<p class="karte hinweis">Für diese Seite ist noch nichts eingetragen.</p>
			{/if}
		</div>

		<aside class="seitenspalte">
			{#if e.termine.length || e.canEvents}
				<section id="u-termine" class="karte block" aria-labelledby="h-termine">
					<h2 id="h-termine">Nächste Termine</h2>
					{#if e.termine.length === 0}
						<p class="hinweis">Keine anstehenden Termine.</p>
					{/if}
					<ul class="liste">
						{#each e.termine as t (t.id)}
							{@const d = tagUndMonat(t.date)}
							<li class="termin">
								<span class="datum" aria-hidden="true">
									<strong>{d.tag}</strong><span>{d.monat}</span>
								</span>
								<span class="text-spalte">
									<a class="titellink" href={resolve('/(app)/kalender/[id]', { id: t.id })}>
										{t.title}
									</a>
									<span class="unter">
										{dayHeading(t.date, heute)} · {timeLabel(t)}{t.place ? ` · ${t.place}` : ''}
									</span>
								</span>
							</li>
						{/each}
					</ul>
					<div class="knoepfe">
						<a class="knopf zweit" href={resolve('/(app)/kalender')}>Im Kalender</a>
						{#if e.canEvents}
							<a class="knopf zweit" href="{resolve('/(app)/kalender/neu')}?absender={e.id}">
								Termin anlegen
							</a>
						{/if}
					</div>
				</section>
			{/if}

			{#if data.beitraege.length || e.canPost}
				<section id="u-beitraege" class="karte block" aria-labelledby="h-beitraege">
					<h2 id="h-beitraege">Neueste Beiträge</h2>
					{#if data.beitraege.length === 0}
						<p class="hinweis">Noch keine Beiträge.</p>
					{/if}
					<ul class="liste">
						{#each data.beitraege as b (b.id)}
							<li class="beitrag">
								<a class="titellink" href={resolve('/(app)/neuigkeiten/[id]', { id: b.id })}>
									{b.title}
								</a>
								<span class="unter">{formatDay(b.publishAt)}</span>
							</li>
						{/each}
					</ul>
					<div class="knoepfe">
						{#if data.beitraege.length}
							<a class="knopf zweit" href="{resolve('/(app)/neuigkeiten')}?von={e.id}">
								Alle Beiträge
							</a>
						{/if}
						{#if e.canPost}
							<a class="knopf zweit" href="{resolve('/(app)/neuigkeiten/neu')}?absender={e.id}">
								Beitrag schreiben
							</a>
						{/if}
					</div>
				</section>
			{/if}

			{#if e.faqs.length || e.canFaqs}
				<section id="u-faqs" class="karte block" aria-labelledby="h-faqs">
					<h2 id="h-faqs">Häufige Fragen</h2>
					{#if e.faqs.length === 0}
						<p class="hinweis">Noch keine FAQs.</p>
					{/if}
					<ul class="liste">
						{#each e.faqs as f (f.id)}
							<li>
								<a class="frage" href="{resolve('/(app)/faqs')}?einheit={e.id}#faq-{f.id}">
									<span>{f.question}</span>
									<Icon d={PFEIL} size={16} stroke={2} />
								</a>
							</li>
						{/each}
					</ul>
					<div class="knoepfe">
						{#if e.faqs.length}
							<a class="knopf zweit" href="{resolve('/(app)/faqs')}?einheit={e.id}">
								Alle FAQs ({e.faqs.length})
							</a>
						{/if}
						{#if e.canFaqs}
							<a class="knopf zweit" href="{resolve('/(app)/faqs/neu')}?einheit={e.id}">
								FAQ anlegen
							</a>
						{/if}
					</div>
				</section>
			{/if}
		</aside>
	</div>
</div>

<style>
	.seite {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	h1,
	h2,
	h3 {
		margin: 0;
	}
	h2 {
		font-size: 20px;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
	}
	.kopfblock {
		border-radius: 24px;
		background: var(--tint);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.kurz {
		color: var(--mu);
	}
	.chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 8px 14px;
		box-sizing: border-box;
		border-radius: 999px;
		background: var(--sf);
		color: var(--tx);
		font-size: 14px;
		font-weight: 500;
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	a.chip:hover {
		text-decoration: underline;
	}
	.chip :global(svg) {
		flex: none;
		color: var(--mu);
	}
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}
	.identitaet {
		display: flex;
		align-items: center;
		gap: 16px;
		min-width: 0;
	}
	.symbol {
		flex: none;
		width: 64px;
		height: 64px;
		border-radius: 20px;
		background: var(--fill);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.namen {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.art {
		font-size: 13px;
		font-weight: 600;
		color: var(--ac);
	}
	h1 {
		font-size: 30px;
		line-height: 1.2;
	}
	.leitung {
		font-size: 14px;
		margin-top: 2px;
	}
	.leitung a {
		color: var(--tx);
		font-weight: 600;
	}
	.werkzeuge {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.rund {
		width: 44px;
		height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--bd);
		border-radius: 999px;
		background: var(--sf);
		color: var(--tx);
		cursor: pointer;
	}
	.rund.an {
		color: var(--ac);
	}
	.rund.an :global(svg) {
		fill: currentColor;
	}
	.pruefen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	.klein {
		min-height: 38px;
		padding: 6px 14px;
		font-size: 14px;
	}
	.anker {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding: 2px 0;
	}
	.anker a {
		display: inline-flex;
		align-items: center;
		white-space: nowrap;
		padding: 8px 16px;
		min-height: 40px;
		box-sizing: border-box;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		font-weight: 600;
		font-size: 14px;
		text-decoration: none;
	}
	.anker a:hover {
		border-color: var(--mu);
	}
	.spalten {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		align-items: flex-start;
	}
	.haupt {
		flex: 2 1 520px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.seitenspalte {
		flex: 1 1 260px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: 12px;
		scroll-margin-top: 90px;
	}
	.blockkopf {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.blockkopf > div {
		display: flex;
		flex-direction: column;
	}
	.zsuche {
		width: auto;
		min-width: 220px;
		min-height: 40px;
		background-color: var(--bg);
	}
	.gruppe h3 {
		margin: 8px 0 4px;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--mu);
	}
	.zliste,
	.team,
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.zliste li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 16px;
		padding: 12px 0;
		border-top: 1px solid var(--bd);
	}
	.thema {
		flex: 1 1 220px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}
	.stichworte {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.stichwort {
		font-size: 12px;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--bg);
		color: var(--mu);
	}
	.verweis {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 32px;
		padding: 2px 10px;
		box-sizing: border-box;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--bg);
		color: var(--ac);
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
	}
	.kontakt {
		flex: 1 1 260px;
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.kontakttext {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.kontakttext > a {
		font-weight: 600;
		color: var(--ac);
		overflow-wrap: anywhere;
	}
	.tel {
		color: var(--mu);
	}
	.anzahl {
		font-weight: 400;
		color: var(--mu);
	}
	.rundknopf {
		border-radius: 999px;
	}
	.stapelbild {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 14px;
	}
	.gesichter {
		display: flex;
		padding-left: 10px;
	}
	.gesichter :global(.avatar) {
		margin-left: -10px;
		border: 2px solid var(--sf);
	}
	.team li {
		display: flex;
		gap: 12px;
		align-items: center;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.person {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.name {
		font-weight: 600;
	}
	.text {
		margin: 0;
		white-space: pre-line;
	}
	.termin {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 0;
	}
	.datum {
		flex: none;
		width: 44px;
		height: 48px;
		border-radius: 10px;
		background: var(--tint);
		color: var(--ac);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		line-height: 1.1;
	}
	.datum strong {
		font-size: 17px;
	}
	.datum span {
		font-size: 10px;
		font-weight: 700;
	}
	.text-spalte {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.titellink {
		font-weight: 600;
	}
	.beitrag {
		display: flex;
		flex-direction: column;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.beitrag:first-child {
		border-top: 0;
		padding-top: 0;
	}
	.frage {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-height: 44px;
		padding: 8px 0;
		border-top: 1px solid var(--bd);
		color: var(--tx);
		text-decoration: none;
	}
	.frage :global(svg) {
		flex: none;
		color: var(--ac);
	}
	.frage:hover span {
		text-decoration: underline;
	}
	.knoepfe {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.hinweis {
		margin: 0;
	}
</style>
