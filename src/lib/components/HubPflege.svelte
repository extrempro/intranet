<script lang="ts">
	/**
	 * „Hub bearbeiten“ als eine Seite mit einem „Speichern“ (Design-Entwurf):
	 * Kurzinfo, Vorstellung, Wer darf schreiben?, Hinweis oben, Aufbau,
	 * Schnellzugriff, Dokumente, Termine, Ansprechpersonen, Hub-Team, Ruhen.
	 * Alles bleibt im Browser, bis „Speichern“ es in einem Schritt übernimmt.
	 */
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import Anhaenge from './Anhaenge.svelte';
	import Avatar from './Avatar.svelte';
	import Editor from './Editor.svelte';
	import Icon from './Icon.svelte';
	import Info from './Info.svelte';
	import PersonSuche, { type Treffer } from './PersonSuche.svelte';
	import ZielWaehlen, { type Ziel } from './ZielWaehlen.svelte';
	import { HUB_BLOECKE, HUB_GRENZEN, HUB_REITER, LINK_SYMBOLE, type HubLayout } from '#lib/hubs.ts';
	import { navAreas } from '#lib/nav.ts';

	interface Hub {
		id: string;
		slug: string;
		name: string;
		about: string | null;
		aboutHtml: string | null;
		noticeRaw: string | null;
		noticeUntil: string | null;
		coordinatorId: string | null;
		isCentral: boolean;
		resting: Date | null;
		layout: HubLayout;
		canManage: boolean;
		canAdminister: boolean;
		kontakte: { personId: string; name: string; email: string; task: string }[];
		links: { label: string; description: string | null; url: string; icon: string }[];
		ordner: { id: string; name: string }[];
		dokumente: {
			id: string;
			fileId: string;
			folderId: string | null;
			title: string;
			name: string;
			kind: string;
			size: number;
		}[];
	}
	interface Pflege {
		maxSchreibende: number;
		umfragenFrei?: boolean;
		darfTermine: boolean;
		team: {
			personId: string;
			name: string;
			email: string;
			mandant: string;
			abteilung: string | null;
			foto: string | null;
			verwaltet: boolean;
			ausEntra: boolean;
			hubTask: string | null;
			mayWriteNews: boolean;
			mayWriteFaqs: boolean;
			mayWriteEvents: boolean;
			mayWriteDocuments: boolean;
			mayWriteMedia: boolean;
			mayWriteSurveys: boolean;
		}[];
		termine: {
			id: string;
			date: string;
			title: string;
			allDay: boolean;
			startTime: string | null;
			place: string | null;
		}[];
	}

	let {
		hub,
		pflege,
		meldung,
		ongespeichert
	}: {
		hub: Hub;
		pflege: Pflege | null;
		meldung: { fehler?: string; ok?: string } | null;
		ongespeichert: () => void;
	} = $props();

	// --- Zustand aus den Daten (beim Öffnen und nach dem Speichern neu) ---
	const h = untrack(() => hub);
	const pf = untrack(() => pflege);
	let kurz = $state(h.about ?? '');
	let koordination = $state(h.coordinatorId ?? '');
	let hinweis = $state({
		an: Boolean(h.noticeRaw),
		text: h.noticeRaw ?? '',
		bis: h.noticeUntil ?? ''
	});
	let ruhen = $state(Boolean(h.resting));
	type Mitglied = {
		personId: string;
		name: string;
		email: string;
		mandant: string;
		abteilung: string | null;
		foto: string | null;
		ausEntra: boolean;
		hubteam: boolean;
		aufgabe: string;
		news: boolean;
		faqs: boolean;
		termine: boolean;
		dokumente: boolean;
		mediathek: boolean;
		umfragen: boolean;
	};
	let team = $state<Mitglied[]>(
		(pf?.team ?? []).map((m) => ({
			personId: m.personId,
			name: m.name,
			email: m.email,
			mandant: m.mandant,
			abteilung: m.abteilung,
			foto: m.foto,
			ausEntra: m.ausEntra,
			hubteam: m.verwaltet,
			aufgabe: m.hubTask ?? '',
			news: m.mayWriteNews,
			faqs: m.mayWriteFaqs,
			termine: m.mayWriteEvents,
			dokumente: m.mayWriteDocuments,
			mediathek: m.mayWriteMedia,
			umfragen: m.mayWriteSurveys
		}))
	);
	let kontakte = $state(
		h.kontakte.map((k) => ({ personId: k.personId, name: k.name, aufgabe: k.task }))
	);
	let links = $state(
		h.links.map((l) => ({
			label: l.label,
			description: l.description ?? '',
			url: l.url,
			icon: l.icon
		}))
	);
	let dokumente = $state(
		h.dokumente.map((d) => ({
			id: d.id,
			title: d.title,
			name: d.name,
			ordner: h.ordner.find((o) => o.id === d.folderId)?.name ?? ''
		}))
	);
	let termine = $state(
		(pf?.termine ?? []).map((t) => ({
			id: t.id as string | null,
			date: t.date,
			title: t.title,
			startTime: t.allDay ? '' : (t.startTime ?? ''),
			place: t.place ?? ''
		}))
	);

	// --- Aufbau: Reihenfolge der Reiter, Blöcke im Überblick an oder aus ---
	type Bereich = 'reiter' | 'block';
	interface Zeile {
		key: string;
		bereich: Bereich;
		an: boolean;
	}
	const aufbauStart: Zeile[] = [
		...h.layout.reiter.map((key) => ({ key, bereich: 'reiter' as const, an: true })),
		...h.layout.ueberblick.map((key) => ({ key, bereich: 'block' as const, an: true })),
		...HUB_BLOECKE.filter((b) => !h.layout.ueberblick.includes(b.key)).map((b) => ({
			key: b.key,
			bereich: 'block' as const,
			an: false
		}))
	];
	let aufbau = $state<Zeile[]>(aufbauStart);
	const LABEL: Record<Bereich, Record<string, string>> = {
		reiter: Object.fromEntries(HUB_REITER.map((r) => [r.key, r.label])),
		block: Object.fromEntries(HUB_BLOECKE.map((b) => [b.key, b.label]))
	};
	function schieben(z: Zeile, d: -1 | 1) {
		const gleich = aufbau.filter((x) => x.bereich === z.bereich);
		const nachbar = gleich[gleich.indexOf(z) + d];
		if (!nachbar) return;
		const a = aufbau.indexOf(z);
		const b = aufbau.indexOf(nachbar);
		[aufbau[a], aufbau[b]] = [aufbau[b], aufbau[a]];
	}

	// --- Abgeleitet ---
	const hubTeam = $derived(team.filter((m) => m.hubteam));
	const schreibende = $derived(team.filter((m) => !m.hubteam));
	const mitRecht = $derived(
		schreibende.filter(
			(m) => m.news || m.faqs || m.termine || m.dokumente || m.mediathek || m.umfragen
		).length
	);
	const voll = $derived(pf ? mitRecht >= pf.maxSchreibende : false);
	const RECHTE = $derived(
		(
			[
				['news', 'Neuigkeiten'],
				['faqs', 'FAQs'],
				['termine', 'Termine'],
				['dokumente', 'Dokumente'],
				['mediathek', 'Mediathek'],
				['umfragen', 'Umfragen']
			] as const
		).filter(([k]) => k !== 'umfragen' || pf?.umfragenFrei)
	);
	const ordnerNamen = $derived(
		[...new Set(dokumente.map((d) => d.ordner.trim()).filter(Boolean))].sort()
	);

	const daten = $derived(
		JSON.stringify({
			kurz,
			koordination: hubTeam.some((m) => m.personId === koordination) ? koordination : null,
			hinweis,
			aufbau: {
				reiter: aufbau.filter((z) => z.bereich === 'reiter').map((z) => z.key),
				ueberblick: aufbau.filter((z) => z.bereich === 'block' && z.an).map((z) => z.key)
			},
			ruhen,
			team: team.map((m) => ({
				personId: m.personId,
				hubteam: m.hubteam,
				aufgabe: m.aufgabe,
				news: m.news,
				faqs: m.faqs,
				termine: m.termine,
				dokumente: m.dokumente,
				mediathek: m.mediathek,
				umfragen: m.umfragen
			})),
			kontakte,
			links,
			dokumente: dokumente.map((d) => ({ id: d.id, title: d.title, ordner: d.ordner })),
			termine
		})
	);

	// --- Personen hinzufügen ---
	const quelle = $derived(resolve('/(app)/einheiten/[id]/personen', { id: hub.id }));
	function insTeam(t: Treffer, hubteam: boolean) {
		const da = team.find((m) => m.personId === t.id);
		if (da) {
			if (hubteam) da.hubteam = true;
			return;
		}
		team.push({
			personId: t.id,
			name: t.name,
			email: t.email,
			mandant: t.mandant,
			abteilung: t.abteilung,
			foto: t.foto,
			ausEntra: false,
			hubteam,
			aufgabe: '',
			news: !hubteam,
			faqs: false,
			termine: false,
			dokumente: false,
			mediathek: false,
			umfragen: false
		});
	}
	function entfernen(m: Mitglied) {
		team = team.filter((x) => x !== m);
		if (koordination === m.personId) koordination = '';
	}

	// --- Schnellzugriff: Ziel wählen ---
	const ziele: Ziel[] = $derived([
		...navAreas().flatMap((a) =>
			a.pages.map((pg) => ({ gruppe: `Im Intranet: ${a.label}`, label: pg.label, url: pg.href }))
		),
		{
			gruppe: 'Dieser Hub',
			label: 'Häufige Fragen dieses Hubs',
			url: `/faqs?einheit=${hub.id}`
		},
		{
			gruppe: 'Dieser Hub',
			label: 'Termine anlegen',
			url: `/kalender/neu?absender=${hub.id}`
		},
		...hub.dokumente.map((d) => ({
			gruppe: 'Dokumente dieses Hubs',
			label: d.title,
			url: `/dateien/${d.fileId}`
		}))
	]);
	let zielFenster: ReturnType<typeof ZielWaehlen> | undefined = $state();
	let zielFuer = $state(-1);
	function zielWaehlen(i: number) {
		zielFuer = i;
		void zielFenster?.oeffnen({ url: links[i].url, icon: links[i].icon });
	}
	const zielText = (url: string) =>
		ziele.find((z) => z.url === url)?.label ?? url.replace(/^https?:\/\//, '');

	let schluessel = $state(0);
	const absenden: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') ongespeichert();
		};
	const datum = new Intl.DateTimeFormat('de-DE', {
		day: '2-digit',
		month: 'short',
		timeZone: 'UTC'
	});
	const kurzDatum = (iso: string) =>
		ISO.test(iso)
			? datum
					.format(new Date(`${iso}T12:00:00Z`))
					.replace('.', '')
					.toUpperCase()
			: '';
	const ISO = /^\d{4}-\d{2}-\d{2}$/;
	const heute = new Date().toISOString().slice(0, 10);
</script>

<form
	method="POST"
	action={hub.canManage ? '?/speichern' : '?/dokumente'}
	class="stapel"
	use:enhance={absenden}
>
	<input type="hidden" name="daten" value={daten} />
	{#if meldung?.fehler}<p class="meldung fehler" role="alert">{meldung.fehler}</p>{/if}
	{#if meldung?.ok}<p class="meldung" role="status">{meldung.ok}</p>{/if}

	{#if hub.canManage}
		<section class="karte felder" aria-labelledby="he-k" data-tour="hinweis">
			<h2 id="he-k">Kurzinfo</h2>
			<label class="feld">
				<span class="mit-info">
					Aufgaben in einer Zeile <span class="optional">(optional)</span><Info
						thema="Aufgaben in einer Zeile"
						text="Steht oben auf der Hub-Seite und auf der Karte in der Hub-Liste."
					/>
				</span>
				<input bind:value={kurz} maxlength={HUB_GRENZEN.kurz} />
			</label>
			<label class="feld">
				<span class="mit-info">
					Koordination <span class="optional">(optional)</span><Info
						thema="Koordination"
						text="Eine Person aus dem Hub-Team kann die Koordination übernehmen. Sie wird auf der Hub-Seite als Ansprechperson genannt. Das Hub-Team legt sie selbst fest."
					/>
				</span>
				<select bind:value={koordination}>
					<option value="">Keine</option>
					{#each hubTeam as m (m.personId)}<option value={m.personId}>{m.name}</option>{/each}
				</select>
			</label>
		</section>

		<section class="karte felder" aria-labelledby="he-v">
			<h2 id="he-v">Vorstellung</h2>
			<Editor
				name="ueber"
				value={h.aboutHtml ??
					(h.about ? `<p>${h.about.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}</p>` : '')}
				label="Vorstellungstext"
			/>
		</section>

		<section class="karte stapel eng" aria-labelledby="he-w">
			<div class="kopf">
				<h2 id="he-w" class="mit-info">
					Wer darf schreiben?<Info
						thema="Wer darf schreiben"
						text="Neuigkeiten, FAQs, Termine und Dokumente vergibst du je Person. Wer im Hub-Team ist, darf immer alles."
					/>
				</h2>
				<span class="unter">{mitRecht} von {pf?.maxSchreibende} Schreibenden</span>
			</div>
			<p class="notiz">Das Hub-Team darf immer alles schreiben und zählt nicht mit.</p>
			<ul class="zeilen">
				{#each schreibende as m (m.personId)}
					<li>
						<div class="schreibrecht" role="group" aria-label="Schreibrechte von {m.name}">
							<span class="wer">
								<strong>{m.name}</strong>{#if hub.isCentral}<span class="unter">
										{m.mandant}
									</span>{/if}
							</span>
							<span class="chips">
								{#each RECHTE as [k, text] (k)}
									<button
										type="button"
										class="chip"
										aria-pressed={m[k]}
										aria-label="{text} für {m.name}"
										disabled={!m[k] &&
											voll &&
											!(m.news || m.faqs || m.termine || m.dokumente || m.mediathek || m.umfragen)}
										onclick={() => (m[k] = !m[k])}
									>
										{#if m[k]}<Icon d="M5 12l5 5l10 -10" size={14} stroke={2.4} />{/if}{text}
									</button>
								{/each}
							</span>
							<button
								type="button"
								class="knopf zweit klein"
								aria-label="{m.name} entfernen"
								onclick={() => entfernen(m)}
							>
								Entfernen
							</button>
						</div>
					</li>
				{/each}
			</ul>
			<PersonSuche
				{quelle}
				ausschliessen={team.map((m) => m.personId)}
				deaktiviert={voll}
				mandantZeigen={hub.isCentral}
				onwahl={(t) => insTeam(t, false)}
			/>
			{#if voll}<span class="unter">
					Die Höchstzahl ist erreicht. Sie legt die Verwaltung fest.
				</span>{/if}
		</section>

		<section class="karte stapel eng" aria-labelledby="he-b">
			<div class="kopf">
				<div class="spalte">
					<h2 id="he-b">Hinweis oben</h2>
					<span class="unter">
						Kurzer Hinweis über allen Inhalten, z. B. eine Störung oder Frist
					</span>
				</div>
				<input
					type="checkbox"
					class="schalter"
					role="switch"
					aria-labelledby="he-b"
					bind:checked={hinweis.an}
				/>
			</div>
			{#if hinweis.an}
				<label class="feld">
					<span>Text <span class="optional">(höchstens {HUB_GRENZEN.hinweis} Zeichen)</span></span>
					<textarea
						rows="2"
						maxlength={HUB_GRENZEN.hinweis}
						bind:value={hinweis.text}
						placeholder="z. B. Am Freitag ist die App ab 18 Uhr nicht erreichbar."></textarea>
				</label>
				<label class="feld schmalfeld">
					<span>Anzeigen bis <span class="optional">(optional)</span></span>
					<input type="date" bind:value={hinweis.bis} min={heute} />
				</label>
			{/if}
		</section>

		<section class="karte stapel eng" aria-labelledby="he-l" data-tour="aufbau">
			<h2 id="he-l" class="mit-info">
				Aufbau der Seite<Info
					thema="Aufbau der Seite"
					text="Die Hub-Seite hat Reiter: den Überblick und Unterseiten wie Termine oder Fragen. Leg fest, in welcher Reihenfolge die Reiter stehen und welche Blöcke der Überblick zeigt. Leere Reiter und Blöcke sehen Leser nicht, Ausgeblendetes behält seine Inhalte."
				/>
			</h2>
			<div class="bereiche">
				{#each [['reiter', 'Reihenfolge der Reiter'], ['block', 'Blöcke im Überblick']] as const as [bereich, titel] (bereich)}
					{@const liste = aufbau.filter((z) => z.bereich === bereich)}
					<div role="list" aria-label={titel}>
						<span class="bereichstitel">{titel}</span>
						{#if bereich === 'reiter'}
							<div class="aufbauzeile fest" role="listitem">
								<span>Überblick (immer vorne)</span>
							</div>
						{/if}
						{#each liste as z, i (z.key)}
							{@const name = LABEL[bereich][z.key]}
							<div class="aufbauzeile" role="listitem">
								<span id="ab-{bereich}-{z.key}" class:aus={!z.an}>{name}</span>
								<button
									type="button"
									class="knopf zweit mini"
									disabled={i === 0}
									aria-label="{name} nach oben"
									onclick={() => schieben(z, -1)}
								>
									↑
								</button>
								<button
									type="button"
									class="knopf zweit mini"
									disabled={i === liste.length - 1}
									aria-label="{name} nach unten"
									onclick={() => schieben(z, 1)}
								>
									↓
								</button>
								{#if bereich === 'block'}
									<input
										type="checkbox"
										class="schalter"
										role="switch"
										aria-labelledby="ab-{bereich}-{z.key}"
										bind:checked={z.an}
									/>
								{/if}
							</div>
						{/each}
						{#if bereich === 'block'}
							<p class="hinweis aufbauhinweis">
								Daneben stehen immer die Ansprechpersonen (sonst das Hub-Team) und die Videos.
							</p>
						{/if}
					</div>
				{/each}
			</div>
		</section>

		<section class="karte stapel eng" aria-labelledby="he-q">
			<div class="kopf">
				<h2 id="he-q">Schnellzugriff</h2>
				<button
					type="button"
					class="knopf zweit klein"
					disabled={links.length >= HUB_GRENZEN.links}
					onclick={() => {
						links.push({ label: '', description: '', url: '', icon: 'link' });
						zielWaehlen(links.length - 1);
					}}
				>
					Schnellzugriff hinzufügen
				</button>
			</div>
			<ul class="zeilen">
				{#each links as l, i (i)}
					<li class="linkzeile">
						<span class="symbol" aria-hidden="true">
							<Icon
								d={(LINK_SYMBOLE as Record<string, { d: string }>)[l.icon]?.d ??
									LINK_SYMBOLE.link.d}
								size={20}
							/>
						</span>
						<input
							aria-label="Bezeichnung"
							placeholder="Bezeichnung"
							maxlength={HUB_GRENZEN.linkTitel}
							bind:value={l.label}
						/>
						<input
							aria-label="Kurzbeschreibung"
							placeholder="Kurzbeschreibung"
							maxlength={HUB_GRENZEN.linkBeschreibung}
							bind:value={l.description}
						/>
						<button
							type="button"
							class="knopf zweit klein ziel"
							title={l.url || 'Noch kein Ziel'}
							onclick={() => zielWaehlen(i)}
						>
							{l.url ? zielText(l.url) : 'Ziel wählen'}<span class="sr-only">, ändern</span>
						</button>
						<span class="knoepfe">
							<button
								type="button"
								class="knopf zweit mini"
								disabled={i === 0}
								aria-label="{l.label || 'Link'} nach oben"
								onclick={() => ([links[i - 1], links[i]] = [links[i], links[i - 1]])}
							>
								↑
							</button>
							<button
								type="button"
								class="knopf zweit klein"
								onclick={() => links.splice(i, 1)}
								aria-label="{l.label || 'Link'} entfernen"
							>
								Entfernen
							</button>
						</span>
					</li>
				{:else}
					<li class="leer">Noch kein Schnellzugriff.</li>
				{/each}
			</ul>
			<ZielWaehlen
				bind:this={zielFenster}
				{ziele}
				onwahl={(w) => {
					if (links[zielFuer]) {
						links[zielFuer].url = w.url;
						links[zielFuer].icon = w.icon;
						if (!links[zielFuer].label)
							links[zielFuer].label = ziele.find((z) => z.url === w.url)?.label ?? '';
					}
				}}
			/>
		</section>
	{/if}

	<section class="karte stapel eng" id="dokumente" aria-labelledby="he-d">
		<h2 id="he-d">Dokumente und Anleitungen</h2>
		<ul class="zeilen">
			{#each dokumente as d, i (d.id)}
				<li class="dokzeile">
					<input
						aria-label="Titel von {d.name}"
						maxlength={HUB_GRENZEN.dokumentTitel}
						bind:value={d.title}
					/>
					<input
						aria-label="Ordner für {d.title}"
						placeholder="Ordner (optional)"
						list="hub-ordner"
						maxlength={HUB_GRENZEN.ordnerName}
						bind:value={d.ordner}
					/>
					<span class="knoepfe">
						<button
							type="button"
							class="knopf zweit mini"
							disabled={i === 0}
							aria-label="{d.title} nach oben"
							onclick={() => ([dokumente[i - 1], dokumente[i]] = [dokumente[i], dokumente[i - 1]])}
						>
							↑
						</button>
						<button
							type="button"
							class="knopf zweit klein"
							aria-label="{d.title} entfernen"
							onclick={() => dokumente.splice(i, 1)}
						>
							Entfernen
						</button>
					</span>
				</li>
			{/each}
		</ul>
		<datalist id="hub-ordner">
			{#each ordnerNamen as o (o)}<option value={o}></option>{/each}
		</datalist>
		{#key schluessel}
			<Anhaenge start={[]} max={20} legende="Datei hinzufügen" />
		{/key}
		<p class="unter">
			PDF, Bilder und Office-Dateien ohne Makros. Herunterladen geht nur nach Anmeldung. Entfernte
			Dateien werden beim Speichern gelöscht.
		</p>
	</section>

	{#if hub.canManage && pf?.darfTermine}
		<section class="karte stapel eng" aria-labelledby="he-t">
			<div class="kopf">
				<h2 id="he-t">Termine</h2>
				<button
					type="button"
					class="knopf zweit klein"
					onclick={() => termine.push({ id: null, date: '', title: '', startTime: '', place: '' })}
				>
					Termin hinzufügen
				</button>
			</div>
			<ul class="zeilen">
				{#each termine as t, i (t.id ?? `neu-${i}`)}
					<li class="terminzeile">
						<span class="tag" aria-hidden="true">{kurzDatum(t.date)}</span>
						<input type="date" aria-label="Datum" bind:value={t.date} min={heute} />
						<input
							aria-label="Titel des Termins"
							placeholder="Titel"
							maxlength="90"
							bind:value={t.title}
						/>
						<input type="time" aria-label="Beginn (leer: ganztägig)" bind:value={t.startTime} />
						<input aria-label="Ort" placeholder="Ort" maxlength="120" bind:value={t.place} />
						<button
							type="button"
							class="knopf zweit klein"
							aria-label="{t.title || 'Termin'} entfernen"
							onclick={() => termine.splice(i, 1)}
						>
							Entfernen
						</button>
					</li>
				{:else}
					<li class="leer">Keine anstehenden Termine.</li>
				{/each}
			</ul>
			<p class="unter">
				Vergangene Termine verschwinden am Tag danach von selbst. Jeder Termin lässt sich als
				Kalenderdatei herunterladen und steht auch im Kalender.
			</p>
		</section>
	{/if}

	{#if hub.canManage}
		<section class="karte stapel eng" aria-labelledby="he-a">
			<h2 id="he-a">Ansprechpersonen</h2>
			<p class="unter">
				Für Personen außerhalb des Hub-Teams, z. B. aus einer Fachabteilung. Sie bekommen dadurch
				keine Rechte im Hub.
			</p>
			<ul class="zeilen">
				{#each kontakte as k, i (k.personId)}
					<li class="kontaktzeile">
						<strong>{k.name}</strong>
						<input
							aria-label="Wofür zuständig: {k.name}"
							placeholder="Wofür zuständig"
							maxlength={HUB_GRENZEN.aufgabe}
							bind:value={k.aufgabe}
						/>
						<button
							type="button"
							class="knopf zweit klein"
							aria-label="{k.name} entfernen"
							onclick={() => kontakte.splice(i, 1)}
						>
							Entfernen
						</button>
					</li>
				{/each}
			</ul>
			{#if kontakte.length < HUB_GRENZEN.ansprechpersonen}
				<PersonSuche
					{quelle}
					knopf="Person hinzufügen"
					ausschliessen={kontakte.map((k) => k.personId)}
					mandantZeigen={hub.isCentral}
					mitEntra={false}
					onwahl={(t) => kontakte.push({ personId: t.id, name: t.name, aufgabe: '' })}
				/>
			{/if}
		</section>

		<section class="karte stapel eng" aria-labelledby="he-c" data-tour="team">
			<h2 id="he-c" class="mit-info">
				Hub-Team<Info
					thema="Hub-Team"
					text="Eine Person aus dem Hub-Team kann die Koordination übernehmen. Sie wird auf der Hub-Seite als Ansprechperson genannt. Mindestens eine Person bleibt im Hub-Team."
				/>
			</h2>
			<p class="unter">
				Wer im Hub-Team ist, bekommt automatisch die Rolle Hub-Verwaltung für diesen Hub. Die
				Abteilung kommt aus dem Profil der Person.
			</p>
			<ul class="zeilen">
				{#each hubTeam as m (m.personId)}
					<li class="teamzeile">
						<Avatar name={m.name} foto={m.foto} groesse={40} />
						<span class="wer">
							<strong>{m.name}</strong><span class="unter">
								{[m.abteilung, hub.isCentral ? m.mandant : null].filter(Boolean).join(' · ')}
							</span>
						</span>
						<input
							aria-label="Aufgabe im Hub: {m.name}"
							placeholder="Aufgabe im Hub"
							maxlength={HUB_GRENZEN.aufgabe}
							bind:value={m.aufgabe}
						/>
						<span class="knoepfe">
							<button
								type="button"
								class="chip"
								aria-pressed={koordination === m.personId}
								onclick={() => (koordination = koordination === m.personId ? '' : m.personId)}
							>
								Koordination
							</button>
							<button
								type="button"
								class="knopf zweit klein"
								disabled={hubTeam.length <= 1 || m.ausEntra}
								title={m.ausEntra
									? 'Kommt aus einer Gruppe in Entra'
									: hubTeam.length <= 1
										? 'Mindestens eine Person bleibt im Hub-Team'
										: undefined}
								aria-label="{m.name} entfernen"
								onclick={() => entfernen(m)}
							>
								Entfernen
							</button>
						</span>
					</li>
				{/each}
			</ul>
			<PersonSuche
				{quelle}
				knopf="Person hinzufügen"
				ausschliessen={hubTeam.map((m) => m.personId)}
				mandantZeigen={hub.isCentral}
				onwahl={(t) => insTeam(t, true)}
			/>
		</section>

		<section class="karte stapel eng" aria-labelledby="he-r">
			<div class="kopf">
				<div class="spalte">
					<h2 id="he-r">Hub ruhen lassen</h2>
					<span class="unter">
						Keine neuen Beiträge, alles bleibt lesbar. Jederzeit wieder einschaltbar.
					</span>
				</div>
				<input
					type="checkbox"
					class="schalter"
					role="switch"
					aria-labelledby="he-r"
					bind:checked={ruhen}
				/>
			</div>
			{#if !hub.canAdminister}
				<p class="unter">
					Archivieren kann nur die Verwaltung. Schreib dazu über die Rückmeldung oder an die
					Verwaltung.
				</p>
			{/if}
		</section>
	{/if}

	<div class="fuss">
		<a class="knopf zweit" href={resolve('/(app)/hubs/[slug]', { slug: hub.slug })}>Abbrechen</a>
		<button class="knopf" type="submit">Speichern</button>
	</div>
</form>

<style>
	h2 {
		margin: 0;
		font-size: 18px;
	}
	.eng {
		gap: 10px;
	}
	.mit-info {
		display: inline-flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}
	.optional,
	.unter {
		font-weight: 400;
		color: var(--mu);
	}
	.unter {
		font-size: 13px;
		margin: 0;
	}
	.kopf {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 8px 12px;
	}
	.spalte {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
	}
	.notiz {
		margin: 0;
		padding: 8px 12px;
		border-radius: 10px;
		background: var(--bg);
		font-size: 14px;
	}
	.zeilen {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.zeilen > li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 10px;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.zeilen > li.leer {
		color: var(--mu);
		font-size: 14px;
	}
	.zeilen input {
		flex: 1 1 160px;
		min-width: 0;
		width: auto;
	}
	.wer {
		display: flex;
		flex-direction: column;
		flex: 1 1 160px;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.schreibrecht {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 10px;
		width: 100%;
	}
	.schreibrecht .wer {
		flex: 1 1 140px;
	}
	.chips,
	.knoepfe {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 36px;
		padding: 4px 12px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}
	.chip[aria-pressed='true'] {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
	}
	.chip:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.klein {
		min-height: 40px;
		padding: 6px 12px;
		font-size: 14px;
	}
	.mini {
		min-height: 36px;
		min-width: 36px;
		padding: 0 8px;
	}
	.schmalfeld {
		max-width: 240px;
	}
	.bereiche {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
		gap: 16px;
	}
	.bereichstitel {
		display: block;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--mu);
		padding-bottom: 6px;
		border-bottom: 1px solid var(--bd);
	}
	.aufbauzeile {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 0;
		border-bottom: 1px solid var(--bd);
	}
	.aufbauzeile span {
		flex: 1;
		min-width: 0;
	}
	.aufbauhinweis {
		margin: 8px 0 0;
		font-size: 13px;
	}
	.aufbauzeile.fest span {
		color: var(--mu);
		min-height: 36px;
		display: flex;
		align-items: center;
	}
	.aufbauzeile span.aus {
		color: var(--mu);
	}
	.symbol {
		display: inline-grid;
		place-items: center;
		width: 40px;
		height: 40px;
		flex: none;
		border-radius: 10px;
		background: var(--tint);
		color: var(--ac);
	}
	.ziel {
		/* hält auch den Text für Screenreader im Kasten */
		position: relative;
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: inline-block;
	}
	.tag {
		flex: none;
		width: 64px;
		font-weight: 700;
		font-size: 14px;
	}
	.terminzeile input[type='date'],
	.terminzeile input[type='time'] {
		flex: 0 1 150px;
	}
	.kontaktzeile strong {
		flex: 1 1 160px;
	}
	.fuss {
		position: sticky;
		bottom: 12px;
		z-index: 2;
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}
	.fuss .knopf {
		box-shadow: var(--shadow);
	}
</style>
