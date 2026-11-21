<script lang="ts">
	import MitFrage from '#lib/components/MitFrage.svelte';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import Anhaenge from '#lib/components/Anhaenge.svelte';
	import BildZuschnitt from '#lib/components/BildZuschnitt.svelte';
	import Editor from '#lib/components/Editor.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import EinfuehrungAngebot from '#lib/components/EinfuehrungAngebot.svelte';
	import EinfuehrungKnopf from '#lib/components/EinfuehrungKnopf.svelte';
	import { ROLLEN } from '#lib/tours.ts';
	import {
		DEFAULT_HUB_LAYOUT,
		HUB_GRENZEN,
		HUB_SECTIONS,
		LINK_SYMBOLE,
		type HubLayout,
		type HubSection
	} from '#lib/hubs.ts';

	let { data, form } = $props();
	const h = $derived(data.hub);
	const pflege = $derived(data.pflege);

	const behalten: SubmitFunction =
		() =>
		async ({ update }) =>
			update({ reset: false });

	// Aufbau: zwei Listen (Hauptbereich, Seitenleiste), je Abschnitt an oder aus
	type Bereich = 'main' | 'side';
	interface Zeile {
		key: HubSection;
		bereich: Bereich;
		an: boolean;
	}
	function zeilen(l: HubLayout): Zeile[] {
		const list: Zeile[] = [
			...l.main.map((key) => ({ key, bereich: 'main' as const, an: true })),
			...l.side.map((key) => ({ key, bereich: 'side' as const, an: true }))
		];
		for (const s of HUB_SECTIONS)
			if (!list.some((z) => z.key === s.key))
				list.push({
					key: s.key,
					bereich: DEFAULT_HUB_LAYOUT.side.includes(s.key) ? 'side' : 'main',
					an: false
				});
		return list;
	}
	// Beim Öffnen aus den Daten; danach lokal bearbeitet und mit „Speichern“ übernommen
	let aufbau = $state<Zeile[]>(untrack(() => zeilen(data.hub.layout)));
	const json = $derived(
		JSON.stringify({
			main: aufbau.filter((z) => z.bereich === 'main' && z.an).map((z) => z.key),
			side: aufbau.filter((z) => z.bereich === 'side' && z.an).map((z) => z.key)
		})
	);
	const LABEL = Object.fromEntries(HUB_SECTIONS.map((s) => [s.key, s.label]));
	const BEREICHE = [
		['main', 'Hauptbereich'],
		['side', 'Seitenleiste']
	] as const;
	function schieben(z: Zeile, d: -1 | 1) {
		const gleich = aufbau.filter((x) => x.bereich === z.bereich);
		const i = gleich.indexOf(z);
		const nachbar = gleich[i + d];
		if (!nachbar) return;
		const a = aufbau.indexOf(z);
		const b = aufbau.indexOf(nachbar);
		[aufbau[a], aufbau[b]] = [aufbau[b], aufbau[a]];
	}
	function wechseln(z: Zeile) {
		z.bereich = z.bereich === 'main' ? 'side' : 'main';
	}
	let hinweisAn = $state(untrack(() => Boolean(data.hub.noticeRaw)));

	const meldung = (bereich: string) =>
		form && 'bereich' in form && form.bereich === bereich ? form : null;

	const ueberStart = untrack(
		() =>
			data.hub.aboutHtml ??
			(data.hub.about
				? `<p>${data.hub.about.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}</p>`
				: '')
	);

	const rechte = [
		['neuigkeiten', 'Beiträge', 'mayWriteNews'],
		['faqs', 'FAQs', 'mayWriteFaqs'],
		['termine', 'Termine', 'mayWriteEvents'],
		['dokumente', 'Dokumente', 'mayWriteDocuments']
	] as const;

	const symbole = Object.entries(LINK_SYMBOLE) as [string, { name: string; d: string }][];
	const ordnerName = (id: string | null) =>
		id ? (h.ordner.find((o) => o.id === id)?.name ?? '') : 'Ohne Ordner';
	const dokGruppen = $derived([
		...h.ordner.map((o) => ({ id: o.id as string | null, name: o.name })),
		{ id: null, name: 'Ohne Ordner' }
	]);
	let anhaengeSchluessel = $state(0);
	const dokumenteGespeichert: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') anhaengeSchluessel++;
		};
</script>

<svelte:head><title>{h.name} bearbeiten · Hubs · Intranet</title></svelte:head>

{#snippet hinweis(bereich: string)}
	{@const m = meldung(bereich)}
	{#if m && 'fehler' in m}<p class="meldung fehler" role="alert">{m.fehler}</p>{/if}
	{#if m && 'ok' in m && m.ok}<p class="meldung" role="status">{m.ok}</p>{/if}
{/snippet}

{#snippet pfeile(aktion: string, id: string, erster: boolean, letzter: boolean, name: string)}
	<form method="POST" action="?/{aktion}" class="pfeile" use:enhance={behalten}>
		<input type="hidden" name="id" value={id} />
		<button
			class="knopf zweit klein"
			name="richtung"
			value="hoch"
			disabled={erster}
			aria-label="{name} nach oben"
		>
			↑
		</button>
		<button
			class="knopf zweit klein"
			name="richtung"
			value="runter"
			disabled={letzter}
			aria-label="{name} nach unten"
		>
			↓
		</button>
	</form>
{/snippet}

<div class="stapel schmal">
	{#if h.canManage}
		<EinfuehrungAngebot
			tour={ROLLEN.hub_team}
			text="Du bist im Hub-Team. Eine kurze Einführung zeigt dir, wie du den Hub gestaltest."
		/>
	{/if}
	<a class="zurueck" href={resolve('/(app)/hubs/[slug]', { slug: h.slug })}>← {h.name}</a>
	<h1 class="mit-hilfe">
		Hub bearbeiten
		{#if h.canManage}<EinfuehrungKnopf tour={ROLLEN.hub_team} />{/if}
	</h1>

	{#if h.canManage}
		<form method="POST" action="?/speichern" class="stapel" use:enhance={behalten}>
			{@render hinweis('seite')}
			<section class="karte felder" aria-labelledby="he-k" data-tour="hinweis">
				<h2 id="he-k">Kurzinfo</h2>
				<label class="feld">
					<span>Aufgaben in einer Zeile</span>
					<input
						name="kurz"
						maxlength={HUB_GRENZEN.kurz}
						value={h.about ?? ''}
						placeholder="z. B. Proben und Auftritte des Betriebschors"
					/>
					<span class="hinweis">
						Steht oben auf der Hub-Seite und auf der Karte in der Hub-Liste.
					</span>
				</label>
				<label class="feld">
					<span>Koordination <span class="optional">(optional)</span></span>
					<select name="koordination" value={h.coordinatorId ?? ''}>
						<option value="">Keine</option>
						{#each pflege?.team.filter((m) => m.verwaltet) ?? [] as m (m.personId)}
							<option value={m.personId}>{m.name}</option>
						{/each}
					</select>
					<span class="hinweis">
						Eine Person aus dem Hub-Team. Sie steht im Hub-Team oben, mit „Koordination“.
					</span>
				</label>
			</section>

			<section class="karte felder" aria-labelledby="he-v">
				<h2 id="he-v">Vorstellung</h2>
				<p class="hinweis">Erscheint als „Über uns“, gern mit Links, Bildern, Tabellen.</p>
				<Editor name="ueber" value={ueberStart} label="Vorstellung" />
			</section>

			<section class="karte felder" aria-labelledby="he-b">
				<div class="schalterzeile">
					<div>
						<h2 id="he-b">Hinweis oben</h2>
						<span class="hinweis">
							Kurzer Hinweis über allen Inhalten, z. B. eine Störung oder Frist
						</span>
					</div>
					<label class="schalter">
						<input type="checkbox" name="hinweis_an" role="switch" bind:checked={hinweisAn} />
						<span class="sr-only">Hinweis oben anzeigen</span>
					</label>
				</div>
				{#if hinweisAn}
					<label class="feld">
						<span>
							Text <span class="optional">(höchstens {HUB_GRENZEN.hinweis} Zeichen)</span>
						</span>
						<textarea
							name="hinweis"
							rows="2"
							maxlength={HUB_GRENZEN.hinweis}
							placeholder="z. B. Am Freitag ist die App ab 18 Uhr nicht erreichbar."
							>{h.noticeRaw ?? ''}</textarea
						>
					</label>
					<label class="feld schmalfeld">
						<span>Anzeigen bis <span class="optional">(optional)</span></span>
						<input type="date" name="hinweis_bis" value={h.noticeUntil ?? ''} />
					</label>
				{/if}
			</section>

			<section class="karte stapel" aria-labelledby="he-l" data-tour="aufbau">
				<h2 id="he-l">Aufbau der Seite</h2>
				<p class="hinweis">
					Abschnitte ein- und ausblenden und sortieren. Am Handy steht der Hauptbereich vor der
					Seitenleiste. Ausgeblendete Abschnitte behalten ihre Inhalte; leere sehen Lesende nicht.
				</p>
				<input type="hidden" name="aufbau" value={json} />
				<div class="bereiche">
					{#each BEREICHE as [bereich, titel] (bereich)}
						{@const liste = aufbau.filter((z) => z.bereich === bereich)}
						<div class="bereich" role="group" aria-label={titel}>
							<h3>{titel}</h3>
							<ul class="aufbauliste">
								{#each liste as z, i (z.key)}
									<li class:aus={!z.an}>
										<span class="name" id="ab-{z.key}">{LABEL[z.key]}</span>
										<button
											type="button"
											class="knopf zweit mini"
											disabled={i === 0}
											aria-label="{LABEL[z.key]} nach oben"
											onclick={() => schieben(z, -1)}
										>
											↑
										</button>
										<button
											type="button"
											class="knopf zweit mini"
											disabled={i === liste.length - 1}
											aria-label="{LABEL[z.key]} nach unten"
											onclick={() => schieben(z, 1)}
										>
											↓
										</button>
										<button
											type="button"
											class="knopf zweit mini"
											aria-label="{LABEL[z.key]} in {bereich === 'main'
												? 'die Seitenleiste'
												: 'den Hauptbereich'}"
											title={bereich === 'main' ? 'In die Seitenleiste' : 'In den Hauptbereich'}
											onclick={() => wechseln(z)}
										>
											⇄
										</button>
										<label class="schalter">
											<input
												type="checkbox"
												role="switch"
												bind:checked={z.an}
												aria-labelledby="ab-{z.key}"
											/>
										</label>
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				</div>
			</section>
			<div class="speichern"><button class="knopf" type="submit">Speichern</button></div>
		</form>

		<details class="karte" id="bilder">
			<summary><h2>Titelbild und Symbol</h2></summary>
			{@render hinweis('bilder')}
			<div class="stapel">
				<section class="stapel" aria-labelledby="h-titelbild">
					<h3 id="h-titelbild">Titelbild</h3>
					<p class="hinweis">Breites Bild oben auf der Hub-Seite (Format 4:1).</p>
					{#if h.coverUrl}
						<img class="titelbild" src={h.coverUrl} alt="" />
						<MitFrage
							action="?/bildLoeschen"
							knopf="Titelbild entfernen"
							frage={{ titel: 'Titelbild entfernen?', ja: 'Entfernen', gefahr: true }}
						>
							{#snippet felder()}<input type="hidden" name="art" value="titelbild" />{/snippet}
						</MitFrage>
					{/if}
					<BildZuschnitt
						aktion="?/bild"
						art="titelbild"
						verhaeltnis={4}
						minBreite={800}
						maxBreite={2000}
						beschriftung="Titelbild"
					/>
				</section>
				<section class="stapel" aria-labelledby="h-symbol">
					<h3 id="h-symbol">Symbol</h3>
					<p class="hinweis">
						Quadratisches Bild, z. B. ein Logo. Erscheint neben dem Namen und in der Hub-Liste.
					</p>
					{#if h.iconUrl}
						<img class="symbolbild" src={h.iconUrl} alt="" />
						<MitFrage
							action="?/bildLoeschen"
							knopf="Symbol entfernen"
							frage={{ titel: 'Symbol entfernen?', ja: 'Entfernen', gefahr: true }}
						>
							{#snippet felder()}<input type="hidden" name="art" value="symbol" />{/snippet}
						</MitFrage>
					{/if}
					<BildZuschnitt
						aktion="?/bild"
						art="symbol"
						minBreite={128}
						maxBreite={512}
						beschriftung="Symbol"
					/>
				</section>
			</div>
		</details>
	{/if}

	{#if pflege}
		{#snippet rechteZeile(m: (typeof pflege.team)[number])}
			<form method="POST" action="?/rechte" class="stapel eng" use:enhance={behalten}>
				<input type="hidden" name="person" value={m.personId} />
				<fieldset class="rechte">
					<legend class="sr-only">Rechte von {m.name}</legend>
					<label class="option">
						<input type="checkbox" name="hubteam" checked={m.verwaltet} disabled={m.ausEntra} />
						Hub-Team{#if m.ausEntra}&nbsp;(aus Entra){/if}
					</label>
					{#if m.ausEntra}<input type="hidden" name="hubteam" value="on" />{/if}
					{#each rechte as [name, text, key] (name)}
						<label class="option">
							<input
								type="checkbox"
								{name}
								checked={m.verwaltet || m[key]}
								disabled={m.verwaltet}
							/>
							{text}
						</label>
					{/each}
				</fieldset>
				<div class="aktionen">
					<button class="knopf zweit klein" type="submit">Rechte speichern</button>
					<MitFrage
						action="?/entfernen"
						imFormular
						knopf="Entfernen"
						frage={{
							titel: `${m.name} aus dem Hub entfernen?`,
							text: 'Die Person verliert ihre Rechte in diesem Hub sofort.',
							ja: 'Entfernen',
							gefahr: true
						}}
					/>
				</div>
			</form>
		{/snippet}

		<details class="karte" data-tour="team" open>
			<summary><h2>Hub-Team ({pflege.team.filter((m) => m.verwaltet).length})</h2></summary>
			{@render hinweis('team')}
			<div class="stapel">
				<p class="hinweis">
					Wer im Hub-Team ist, pflegt den Hub und darf alles. Mindestens eine Person bleibt im
					Hub-Team. Die Abteilung kommt aus dem Profil der Person.
					{#if h.isCentral}Der Hub ist für alle Mandanten, deshalb können Personen aller Mandanten
						mitmachen.{/if}
				</p>
				<ul class="liste">
					{#each pflege.team.filter((m) => m.verwaltet) as m (m.personId)}
						<li>
							<div>
								<strong>{m.name}</strong>
								{#if h.coordinatorId === m.personId}<span class="schild">Koordination</span>{/if}
								{#if m.disabled}<span class="schild warnung">inaktiv</span>{/if}
								<br /><span class="hinweis">
									{m.email}{#if h.isCentral && m.mandant}&nbsp;· {m.mandant}{/if}
								</span>
							</div>
							<form method="POST" action="?/aufgabe" class="hinzu" use:enhance={behalten}>
								<input type="hidden" name="person" value={m.personId} />
								<label class="feld">
									<span>Aufgabe im Hub <span class="optional">(optional)</span></span>
									<input
										name="aufgabe"
										maxlength={HUB_GRENZEN.aufgabe}
										value={m.hubTask ?? ''}
										placeholder="z. B. Technik und Aufbau"
									/>
								</label>
								<button class="knopf zweit klein" type="submit">Speichern</button>
							</form>
							{@render rechteZeile(m)}
						</li>
					{/each}
				</ul>
			</div>
		</details>

		<details class="karte" open>
			<summary>
				<h2>Wer darf schreiben? ({pflege.team.filter((m) => !m.verwaltet).length})</h2>
			</summary>
			<div class="stapel">
				<p class="hinweis">
					Weitere Personen mit einzelnen Rechten, höchstens {pflege.maxSchreibende} (das Hub-Team zählt
					nicht mit). Mit „Hub-Team“ holst du eine Person ins Hub-Team.
				</p>
				<form method="POST" action="?/hinzufuegen" class="hinzu" use:enhance>
					<label class="feld">
						<span>Person hinzufügen (E-Mail-Adresse)</span>
						<input name="email" type="email" required autocomplete="off" />
					</label>
					<button class="knopf zweit" type="submit">Hinzufügen</button>
				</form>
				<ul class="liste">
					{#each pflege.team.filter((m) => !m.verwaltet) as m (m.personId)}
						<li>
							<div>
								<strong>{m.name}</strong>
								{#if m.disabled}<span class="schild warnung">inaktiv</span>{/if}
								<br /><span class="hinweis">
									{m.email}{#if h.isCentral && m.mandant}&nbsp;· {m.mandant}{/if}
								</span>
							</div>
							{@render rechteZeile(m)}
						</li>
					{/each}
				</ul>
			</div>
		</details>

		<details class="karte">
			<summary><h2>Ansprechpersonen ({h.kontakte.length})</h2></summary>
			{@render hinweis('kontakte')}
			<div class="stapel">
				<p class="hinweis">
					Für Personen außerhalb des Hub-Teams, z. B. aus einer Fachabteilung, je mit einer kurzen
					Aufgabe. Sie bekommen dadurch keine Rechte im Hub.
				</p>
				<form method="POST" action="?/kontaktNeu" class="hinzu" use:enhance>
					<label class="feld">
						<span>E-Mail-Adresse</span>
						<input name="email" type="email" required autocomplete="off" />
					</label>
					<label class="feld">
						<span>Wofür zuständig <span class="optional">(optional)</span></span>
						<input
							name="aufgabe"
							maxlength={HUB_GRENZEN.aufgabe}
							placeholder="z. B. Anmeldung Sommerfest"
						/>
					</label>
					<button class="knopf zweit" type="submit">Hinzufügen</button>
				</form>
				<ul class="liste">
					{#each h.kontakte as k, i (k.id)}
						<li class="eintrag">
							<form method="POST" action="?/kontaktAendern" class="hinzu" use:enhance={behalten}>
								<input type="hidden" name="id" value={k.id} />
								<div class="wer">
									<strong>{k.name}</strong><br /><span class="hinweis">{k.email}</span>
								</div>
								<label class="feld">
									<span>Aufgabe</span>
									<input name="aufgabe" maxlength={HUB_GRENZEN.aufgabe} value={k.task} />
								</label>
								<button class="knopf zweit klein" type="submit">Speichern</button>
							</form>
							<div class="aktionen">
								{@render pfeile(
									'kontaktVerschieben',
									k.id,
									i === 0,
									i === h.kontakte.length - 1,
									k.name
								)}
								<MitFrage
									action="?/kontaktEntfernen"
									knopf="Entfernen"
									frage={{ titel: `${k.name} als Ansprechperson entfernen?`, ja: 'Entfernen' }}
								>
									{#snippet felder()}<input type="hidden" name="id" value={k.id} />{/snippet}
								</MitFrage>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		</details>

		<details class="karte">
			<summary><h2>Schnellzugriff ({h.links.length})</h2></summary>
			{@render hinweis('links')}
			<div class="stapel">
				<p class="hinweis">
					Bis zu {HUB_GRENZEN.links} Links als Kacheln, z. B. Formulare, ein Teams-Kanal oder eine Seite
					im Intranet (Pfad wie <code>/faqs</code>).
				</p>
				{#snippet linkFelder(
					l: { label: string; description: string | null; url: string; icon: string } | null
				)}
					<label class="feld">
						<span>Titel</span>
						<input name="titel" required maxlength={HUB_GRENZEN.linkTitel} value={l?.label ?? ''} />
					</label>
					<label class="feld">
						<span>Kurzbeschreibung <span class="optional">(optional)</span></span>
						<input
							name="beschreibung"
							maxlength={HUB_GRENZEN.linkBeschreibung}
							value={l?.description ?? ''}
							placeholder="z. B. Termine und Anmeldung"
						/>
					</label>
					<label class="feld breit">
						<span>Adresse</span>
						<input
							name="adresse"
							required
							inputmode="url"
							placeholder="https://… oder /pfad"
							value={l?.url ?? ''}
						/>
					</label>
					<label class="feld">
						<span>Symbol</span>
						<select name="symbol" value={l?.icon ?? 'link'}>
							{#each symbole as [key, s] (key)}
								<option value={key}>{s.name}</option>
							{/each}
						</select>
					</label>
				{/snippet}
				<form method="POST" action="?/linkNeu" class="hinzu" use:enhance>
					{@render linkFelder(null)}
					<button class="knopf zweit" type="submit" disabled={h.links.length >= HUB_GRENZEN.links}>
						Hinzufügen
					</button>
				</form>
				<ul class="liste">
					{#each h.links as l, i (l.id)}
						<li class="eintrag">
							<form method="POST" action="?/linkAendern" class="hinzu" use:enhance={behalten}>
								<input type="hidden" name="id" value={l.id} />
								<span class="symbol" aria-hidden="true">
									<Icon
										d={LINK_SYMBOLE[l.icon as keyof typeof LINK_SYMBOLE]?.d ?? LINK_SYMBOLE.link.d}
									/>
								</span>
								{@render linkFelder(l)}
								<button class="knopf zweit klein" type="submit">Speichern</button>
							</form>
							<div class="aktionen">
								{@render pfeile(
									'linkVerschieben',
									l.id,
									i === 0,
									i === h.links.length - 1,
									l.label
								)}
								<MitFrage
									action="?/linkEntfernen"
									knopf="Entfernen"
									frage={{ titel: `Link „${l.label}“ entfernen?`, ja: 'Entfernen' }}
								>
									{#snippet felder()}<input type="hidden" name="id" value={l.id} />{/snippet}
								</MitFrage>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		</details>
	{/if}

	{#if h.canDocs}
		<details class="karte" id="dokumente" open={!h.canManage || undefined}>
			<summary><h2>Dokumente und Anleitungen ({h.dokumente.length})</h2></summary>
			{@render hinweis('dokumente')}
			<div class="stapel">
				<section class="stapel" aria-labelledby="h-ordner">
					<h3 id="h-ordner">Ordner</h3>
					<form method="POST" action="?/ordnerNeu" class="hinzu" use:enhance>
						<label class="feld">
							<span>Neuer Ordner</span>
							<input name="name" required maxlength={HUB_GRENZEN.ordnerName} />
						</label>
						<button class="knopf zweit" type="submit">Anlegen</button>
					</form>
					<ul class="liste">
						{#each h.ordner as o, i (o.id)}
							<li class="eintrag">
								<form method="POST" action="?/ordnerAendern" class="hinzu" use:enhance={behalten}>
									<input type="hidden" name="id" value={o.id} />
									<label class="feld">
										<span class="sr-only">Name des Ordners</span>
										<input name="name" required maxlength={HUB_GRENZEN.ordnerName} value={o.name} />
									</label>
									<button class="knopf zweit klein" type="submit">Umbenennen</button>
								</form>
								<div class="aktionen">
									{@render pfeile(
										'ordnerVerschieben',
										o.id,
										i === 0,
										i === h.ordner.length - 1,
										o.name
									)}
									<MitFrage
										action="?/ordnerLoeschen"
										knopf="Löschen"
										frage={{
											titel: `Ordner „${o.name}“ löschen?`,
											text: 'Die Dokumente darin bleiben erhalten und stehen danach ohne Ordner.',
											ja: 'Löschen',
											gefahr: true
										}}
									>
										{#snippet felder()}<input type="hidden" name="id" value={o.id} />{/snippet}
									</MitFrage>
								</div>
							</li>
						{/each}
					</ul>
				</section>

				<section class="stapel" aria-labelledby="h-hochladen">
					<h3 id="h-hochladen">Dokumente hinzufügen</h3>
					<form
						method="POST"
						action="?/dokumenteNeu"
						class="stapel"
						use:enhance={dokumenteGespeichert}
					>
						{#key anhaengeSchluessel}
							<Anhaenge start={[]} max={20} legende="Dateien (PDF, Bilder, Office ohne Makros)" />
						{/key}
						<div class="hinzu">
							<label class="feld">
								<span>In Ordner</span>
								<select name="ordner">
									<option value="">Ohne Ordner</option>
									{#each h.ordner as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
								</select>
							</label>
							<button class="knopf" type="submit">Hinzufügen</button>
						</div>
					</form>
				</section>

				{#each dokGruppen as g (g.id ?? 'ohne')}
					{@const liste = h.dokumente.filter((d) => d.folderId === g.id)}
					{#if liste.length}
						<section class="stapel" aria-label="Dokumente in {g.name}">
							<h3>{g.name}</h3>
							<ul class="liste">
								{#each liste as d, i (d.id)}
									<li class="eintrag">
										<form
											method="POST"
											action="?/dokumentAendern"
											class="felder"
											use:enhance={behalten}
										>
											<input type="hidden" name="id" value={d.id} />
											<a
												href="{resolve('/(app)/dateien/[id]', { id: d.fileId })}?download"
												class="hinweis"
											>
												{d.name}
											</a>
											<label class="feld">
												<span>Titel</span>
												<input
													name="titel"
													required
													maxlength={HUB_GRENZEN.dokumentTitel}
													value={d.title}
												/>
											</label>
											<label class="feld">
												<span>Beschreibung <span class="optional">(optional)</span></span>
												<input
													name="beschreibung"
													maxlength={HUB_GRENZEN.dokumentBeschreibung}
													value={d.description ?? ''}
												/>
											</label>
											<label class="feld">
												<span>Ordner</span>
												<select name="ordner" value={d.folderId ?? ''}>
													<option value="">Ohne Ordner</option>
													{#each h.ordner as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
												</select>
											</label>
											<div><button class="knopf zweit klein" type="submit">Speichern</button></div>
										</form>
										<div class="aktionen">
											{@render pfeile(
												'dokumentVerschieben',
												d.id,
												i === 0,
												i === liste.length - 1,
												d.title
											)}
											<MitFrage
												action="?/dokumentLoeschen"
												knopf="Löschen"
												frage={{
													titel: `„${d.title}“ löschen?`,
													text: `Die Datei wird endgültig gelöscht (${ordnerName(d.folderId)}).`,
													ja: 'Löschen',
													gefahr: true
												}}
											>
												{#snippet felder()}<input type="hidden" name="id" value={d.id} />{/snippet}
											</MitFrage>
										</div>
									</li>
								{/each}
							</ul>
						</section>
					{/if}
				{/each}
			</div>
		</details>
	{/if}

	{#if h.canManage}
		<form method="POST" action="?/ruhen" class="karte stapel" data-tour="ruhen" use:enhance>
			<h2>Ruhen lassen</h2>
			{@render hinweis('ruhen')}
			<p class="hinweis">
				Ein ruhender Hub bleibt sichtbar, aber es erscheinen keine neuen Beiträge. Abos bleiben
				bestehen.
			</p>
			<div>
				{#if h.resting}
					<button class="knopf zweit" name="ruhen" value="nein">Hub wieder aktivieren</button>
				{:else}
					<button class="knopf zweit" name="ruhen" value="ja">Hub ruhen lassen</button>
				{/if}
			</div>
		</form>
	{/if}

	{#if h.canAdminister}
		<section class="karte stapel">
			<h2>Archivieren</h2>
			{@render hinweis('archiv')}
			<p class="hinweis">
				Nur für die Verwaltung. Ein archivierter Hub ist nirgends mehr sichtbar und wird nach zwei
				Jahren gelöscht.
			</p>
			<div>
				<MitFrage
					action="?/archivieren"
					frage={{
						titel: `„${h.name}“ archivieren?`,
						text: 'Der Hub ist danach nirgends mehr sichtbar und wird nach zwei Jahren gelöscht.',
						ja: 'Archivieren',
						gefahr: true
					}}
				>
					{#snippet ausloeser(klick: () => void)}
						<button class="knopf zweit" type="button" onclick={klick}>Hub archivieren</button>
					{/snippet}
				</MitFrage>
			</div>
		</section>
	{/if}
</div>

<style>
	.schmal {
		max-width: 820px;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h1,
	h2,
	h3 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	summary h2 {
		display: inline;
	}
	.schalterzeile > div {
		display: grid;
		gap: 2px;
	}
	h3 {
		font-size: 1rem;
	}
	summary {
		cursor: pointer;
		min-height: 32px;
	}
	details[open] > summary {
		margin-bottom: 12px;
	}
	.optional {
		font-weight: 400;
		color: var(--mu);
	}
	.klein {
		min-height: 40px;
		padding: 6px 12px;
	}
	.hinzu {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 10px 12px;
	}
	.hinzu .feld {
		flex: 1 1 200px;
		min-width: 0;
	}
	.hinzu .feld.breit {
		flex: 2 1 260px;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0;
	}
	.liste > li {
		padding: 12px 0;
		border-top: 1px solid var(--bd);
		display: grid;
		gap: 8px;
		min-width: 0;
	}
	.eng {
		gap: 8px;
	}
	.wer {
		flex: 1 1 200px;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.rechte {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
	}
	.pfeile {
		display: inline-flex;
		gap: 6px;
	}
	.symbol {
		display: inline-grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 10px;
		background: var(--tint);
		color: var(--ac);
	}
	.titelbild {
		width: 100%;
		aspect-ratio: 4 / 1;
		object-fit: cover;
		border-radius: 12px;
		border: 1px solid var(--bd);
	}
	.schalterzeile {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	.schalter input {
		width: 44px;
		height: 26px;
		appearance: none;
		border-radius: 999px;
		background: var(--bd);
		position: relative;
		cursor: pointer;
		margin: 0;
		flex: none;
	}
	.schalter input::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 20px;
		height: 20px;
		border-radius: 999px;
		background: #fff;
		transition: left 0.15s;
	}
	.schalter input:checked {
		background: var(--fill);
	}
	.schalter input:checked::after {
		left: 21px;
	}
	.schalter input:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.schmalfeld {
		max-width: 240px;
	}
	.bereiche {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
		gap: 16px;
	}
	.aufbauliste {
		list-style: none;
		margin: 6px 0 0;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	.aufbauliste li {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		border: 1px solid var(--bd);
		border-radius: 10px;
		background: var(--sf);
	}
	.aufbauliste li.aus .name {
		color: var(--mu);
		text-decoration: line-through;
	}
	.aufbauliste .name {
		flex: 1;
		min-width: 0;
		font-weight: 600;
	}
	.mini {
		min-height: 36px;
		min-width: 36px;
		padding: 0 8px;
	}
	.speichern {
		position: sticky;
		bottom: 12px;
		z-index: 1;
	}
	.speichern .knopf {
		box-shadow: var(--shadow);
	}
	.symbolbild {
		width: 72px;
		height: 72px;
		border-radius: 14px;
		border: 1px solid var(--bd);
	}
</style>
