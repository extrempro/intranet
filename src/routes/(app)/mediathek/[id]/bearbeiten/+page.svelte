<script lang="ts">
	/**
	 * Video bearbeiten (Kap. 8.15): links Video und „Was fehlt noch“ (bleibt beim
	 * Scrollen stehen), rechts die Schritte 1 Angaben, 2 Untertitel, 3 Kapitel,
	 * 4 Textfassung und Anhänge, 5 Veröffentlichen; darunter weitere Aktionen.
	 */
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Anhaenge from '#lib/components/Anhaenge.svelte';
	import Editor from '#lib/components/Editor.svelte';
	import MitFrage from '#lib/components/MitFrage.svelte';
	import { fortsetzenAb, anfragen, teileSenden } from '#lib/hochladen.ts';
	import ThemaVorschlag from '#lib/components/ThemaVorschlag.svelte';
	import VideoPlayer from '#lib/components/VideoPlayer.svelte';
	import {
		kapitelAusText,
		kapitelFehler,
		MAX_BESCHREIBUNG,
		MAX_KAPITEL,
		MAX_TITEL,
		MAX_VIDEO_BYTES,
		OHNE_UNTERTITEL,
		STATUS_TEXT,
		zeitLesen,
		zeitText
	} from '#lib/mediathek.ts';

	let { data, form } = $props();
	const v = $derived(data.v);
	const fertig = $derived(v.status === 'entwurf' || v.status === 'veroeffentlicht');
	const inArbeit = $derived(['hochladen', 'warten', 'umwandeln'].includes(v.status));
	const ersatz = $derived(data.ersatz);
	const ersatzLaeuft = $derived(Boolean(ersatz && ['warten', 'umwandeln'].includes(ersatz.status)));

	// Stand der Umwandlung regelmäßig neu laden (nicht beim Hochladen)
	$effect(() => {
		const vorschlagLaeuft = v.suggestionStatus === 'warten';
		if (!(['warten', 'umwandeln'].includes(v.status) || ersatzLaeuft || vorschlagLaeuft) || laeuft)
			return;
		const t = setInterval(() => void invalidateAll(), 4000);
		return () => clearInterval(t);
	});

	let player = $state<VideoPlayer>();
	let zeit = $state(0);

	// Kapitel-Editor: Zeiten als Text, damit Tippfehler sichtbar bleiben
	type Zeile = { zeit: string; t: string };
	const ausDaten = () =>
		(data.v.chapters as { s: number; t: string }[]).map((k) => ({ zeit: zeitText(k.s), t: k.t }));
	let zeilen = $state<Zeile[]>(untrack(ausDaten));
	// Gespeicherte Kapitel geändert (z. B. Vorschlag übernommen): Editor neu füllen
	let kapitelStand = untrack(() => JSON.stringify(data.v.chapters));
	$effect(() => {
		const neu = JSON.stringify(data.v.chapters);
		if (neu === kapitelStand) return;
		kapitelStand = neu;
		zeilen = untrack(ausDaten);
	});
	let einfuegen = $state(false);
	let textEin = $state('');
	const beispielKapitel = ['0:00 Einleitung', '1:30 Anmelden', '4:05 Fragen'].join('\n');
	const liste = $derived(zeilen.map((z) => ({ s: zeitLesen(z.zeit), t: z.t })));
	const fehler = $derived(kapitelFehler(liste, v.durationSec));
	const kapitelOk = $derived(fehler.every((f) => !f));

	function hierBeginnen() {
		const s = Math.floor(zeit);
		const neu = [...zeilen, { zeit: zeitText(s), t: '' }];
		neu.sort((a, b) => (zeitLesen(a.zeit) || 0) - (zeitLesen(b.zeit) || 0));
		zeilen = neu;
	}
	function uebernehmen() {
		zeilen = kapitelAusText(textEin).map((k) => ({
			zeit: Number.isFinite(k.s) ? zeitText(k.s) : '',
			t: k.t
		}));
		einfuegen = false;
		textEin = '';
	}

	const ansehen = $derived(resolve('/(app)/mediathek/[id]', { id: v.id }));

	// Hochladen fortsetzen und neue Fassung: gemeinsamer Ablauf in Teilen
	let laeuft = $state(false);
	let gesendet = $state(0);
	let groesse = $state(0);
	let hochFehler = $state('');
	const prozent = $derived(groesse ? Math.floor((gesendet / groesse) * 100) : 0);
	const mb = (b: number) => (b / 1024 ** 2).toLocaleString('de-DE', { maximumFractionDigits: 0 });
	function dateiAus(e: SubmitEvent): File | null {
		const f = (e.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>(
			'input[type=file]'
		)?.files?.[0];
		return f ?? null;
	}
	async function hochladen(e: SubmitEvent, art: 'fortsetzen' | 'ersatz' | 'ersatzFortsetzen') {
		e.preventDefault();
		const datei = dateiAus(e);
		if (!datei || laeuft) return;
		hochFehler = '';
		if (datei.size > MAX_VIDEO_BYTES) {
			hochFehler = 'Die Datei ist größer als 4 GB.';
			return;
		}
		laeuft = true;
		groesse = datei.size;
		try {
			let id: string;
			let ab = 0;
			if (art === 'ersatz') {
				id = (await anfragen<{ id: string }>(`/mediathek/${v.id}/ersetzen`, { size: datei.size }))
					.id;
			} else {
				id = art === 'fortsetzen' ? v.id : (ersatz?.id as string);
				ab = await fortsetzenAb(id, datei);
			}
			await teileSenden(id, datei, ab, (n) => (gesendet = n));
			await invalidateAll();
		} catch (err) {
			hochFehler = err instanceof Error ? err.message : 'Das Hochladen hat nicht geklappt.';
			await invalidateAll();
		} finally {
			laeuft = false;
		}
	}

	// Untertitel korrigieren: nur der Text, die Zeiten bleiben
	let utOffen = $state(false);
	let utTexte = $state<string[]>(untrack(() => data.cues.map((c) => c.t)));
	$effect(() => {
		// Nach dem Speichern oder neuen Untertiteln den Stand übernehmen
		const neu = data.cues.map((c) => c.t);
		untrack(() => (utTexte = neu));
	});
	const sekAus = (t: string) => {
		const m = /^(?:(\d+):)?(\d+):(\d+)(?:\.(\d+))?$/.exec(t);
		return m ? Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
	};

	// Textfassung: aus den Untertiteln vorschlagen (Absätze zu je etwa 6 Zeilen)
	let textStart = $state(untrack(() => data.v.transcriptHtml));
	let textVersion = $state(0);
	const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	function ausUntertiteln() {
		const zeilen = data.cues.map((c) => c.t.replace(/\s+/g, ' ').trim()).filter(Boolean);
		const absaetze: string[] = [];
		for (let i = 0; i < zeilen.length; i += 6) absaetze.push(zeilen.slice(i, i + 6).join(' '));
		textStart = absaetze.map((a) => `<p>${esc(a)}</p>`).join('');
		textVersion++;
	}

	// Überblick: Sichtbarkeit und was zum Veröffentlichen noch fehlt
	const sichtbarText = $derived(
		v.status === 'veroeffentlicht'
			? `Veröffentlicht: Alle mit Zugriff auf ${v.unit.name} sehen das Video${
					v.tenantIds?.length ? ' (nur ausgewählte Mandanten)' : ''
				}.`
			: `Nicht veröffentlicht: Nur Personen mit dem Recht „Mediathek“ in ${v.unit.name} sehen dieses Video.`
	);
	type Punkt = { text: string; stand: 'ok' | 'offen' | 'optional'; ziel?: string };
	const punkte = $derived<Punkt[]>([
		{
			text: fertig ? 'Video umgewandelt' : 'Video wird noch umgewandelt',
			stand: fertig ? 'ok' : 'offen'
		},
		{
			text: v.noCaptionsReason
				? `Ohne Untertitel: ${OHNE_UNTERTITEL[v.noCaptionsReason as keyof typeof OHNE_UNTERTITEL]}`
				: !v.hatUntertitel
					? 'Untertitel fehlen'
					: v.captionsSource === 'automatisch' && !v.captionsCheckedAt
						? 'Automatische Untertitel noch prüfen'
						: 'Untertitel vorhanden',
			stand: v.bereit ? 'ok' : 'offen',
			ziel: 'schritt-2'
		},
		{
			text: v.chapters.length ? `${v.chapters.length} Kapitel` : 'Kapitel (freiwillig)',
			stand: v.chapters.length ? 'ok' : 'optional',
			ziel: 'schritt-3'
		},
		{
			text:
				v.transcriptHtml || data.anhaenge.length
					? 'Textfassung oder Anhänge vorhanden'
					: 'Textfassung und Anhänge (freiwillig)',
			stand: v.transcriptHtml || data.anhaenge.length ? 'ok' : 'optional',
			ziel: 'schritt-4'
		}
	]);
	const bereitZumVeroeffentlichen = $derived(fertig && v.bereit && v.status === 'entwurf');
	let grund = $state<string>(untrack(() => data.v.noCaptionsReason ?? 'keine_sprache'));
</script>

<svelte:head><title>{v.title} bearbeiten · Mediathek · Intranet</title></svelte:head>

<div class="stapel seite">
	{#if fertig}
		<a class="zurueck" href={ansehen}>← Zum Video</a>
	{:else}
		<a class="zurueck" href={resolve('/(app)/mediathek')}>← Mediathek</a>
	{/if}
	<div class="titelzeile">
		<h1>{v.title} bearbeiten</h1>
		<span class="status s-{v.status}">{STATUS_TEXT[v.status]}</span>
	</div>
	{#if form && 'ergebnis' in form}<p class="meldung" role="status">{form.ergebnis}</p>{/if}
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	<div class="aufbau">
		<!-- Links: Video und Überblick, bleibt beim Scrollen stehen -->
		<div class="seitenleiste">
			{#if fertig}
				<VideoPlayer
					bind:this={player}
					bind:zeit
					titel={v.title}
					quelle="/mediathek/{v.id}/medien/master.m3u8"
					vorschau="/mediathek/{v.id}/medien/vorschau.jpg"
					untertitel={v.hatUntertitel ? `/mediathek/${v.id}/untertitel.vtt` : null}
				/>
			{:else if inArbeit}
				<section class="karte stapel" aria-labelledby="h-stand">
					<h2 id="h-stand">Stand</h2>
					{#if v.status === 'hochladen'}
						<p>
							Das Hochladen wurde nicht abgeschlossen ({mb(v.uploadReceived)} von {mb(v.uploadSize)} MB).
							Ohne Fortschritt wird es nach 24 Stunden gelöscht.
						</p>
						{#if v.eigenerUpload}
							<form class="stapel" onsubmit={(e) => hochladen(e, 'fortsetzen')}>
								<label class="feld">
									<span>Dieselbe Datei noch einmal wählen</span>
									<input
										type="file"
										accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
										required
										disabled={laeuft}
									/>
								</label>
								<div>
									<button class="knopf" type="submit" disabled={laeuft}>
										Hochladen fortsetzen
									</button>
								</div>
							</form>
						{:else}
							<p class="hinweis">Fortsetzen kann nur die Person, die das Hochladen begonnen hat.</p>
						{/if}
					{:else}
						<p>
							{v.status === 'warten'
								? 'Das Video wartet auf die Umwandlung.'
								: 'Das Video wird umgewandelt, danach werden Untertitel erzeugt.'} Du kannst die Seite
							schließen; du bekommst eine Benachrichtigung, wenn es fertig ist.
						</p>
						<progress
							max="100"
							value={v.status === 'umwandeln' ? v.progress : undefined}
							aria-label="Fortschritt der Umwandlung"
						>
							{v.progress} %
						</progress>
					{/if}
				</section>
			{:else if v.status === 'fehler'}
				<p class="meldung fehler" role="alert">
					Die Umwandlung ist fehlgeschlagen: {v.errorMessage || 'unbekannter Fehler'}. Lösche das
					Video und lade es bitte neu hoch.
				</p>
			{/if}

			<section class="karte stapel ueberblick" aria-labelledby="h-ueberblick">
				<h2 id="h-ueberblick">Überblick</h2>
				<p class="sichtbar" class:offen={v.status !== 'veroeffentlicht'}>{sichtbarText}</p>
				<ul class="punkte">
					{#each punkte as pt (pt.text)}
						<li class={pt.stand}>
							<span class="zeichen" aria-hidden="true">
								{pt.stand === 'ok' ? '✓' : pt.stand === 'offen' ? '!' : '○'}
							</span>
							{#if pt.ziel && fertig}<a href="#{pt.ziel}">{pt.text}</a>{:else}{pt.text}{/if}
							<span class="sr-only">
								{pt.stand === 'ok'
									? '(erledigt)'
									: pt.stand === 'offen'
										? '(fehlt)'
										: '(freiwillig)'}
							</span>
						</li>
					{/each}
				</ul>
				{#if bereitZumVeroeffentlichen}
					<a class="knopf" href="#schritt-5">Zum Veröffentlichen</a>
				{/if}
			</section>
		</div>

		<!-- Rechts: Schritte -->
		<div class="schritte">
			<section id="schritt-1" class="karte stapel" aria-labelledby="h-meta">
				<h2 id="h-meta"><span class="nr" aria-hidden="true">1</span>Angaben</h2>
				<form
					method="POST"
					action="?/meta"
					class="stapel"
					use:enhance={() =>
						async ({ update }) =>
							update({ reset: false })}
				>
					<label class="feld">
						<span>Titel</span>
						<input name="title" required maxlength={MAX_TITEL} value={v.title} />
					</label>
					<label class="feld">
						<span>Beschreibung</span>
						<textarea name="description" rows="3" maxlength={MAX_BESCHREIBUNG}
							>{v.description}</textarea
						>
					</label>
					<fieldset class="feld">
						<legend>Themen</legend>
						{#if data.themen.length}
							<div class="auswahl">
								{#each data.themen as t (t.id)}
									<label class="haken">
										<input
											type="checkbox"
											name="thema"
											value={t.id}
											checked={v.themenIds.includes(t.id)}
										/>
										{t.name}
									</label>
								{/each}
							</div>
						{:else}
							<p class="hinweis">Noch keine Themen angelegt.</p>
						{/if}
					</fieldset>
					{#if v.unit.isCentral && v.mandanten.length > 1}
						<fieldset class="feld">
							<legend>Nur für bestimmte Mandanten (leer = alle)</legend>
							<div class="auswahl">
								{#each v.mandanten as m (m.id)}
									<label class="haken">
										<input
											type="checkbox"
											name="mandant"
											value={m.id}
											checked={v.tenantIds?.includes(m.id) ?? false}
										/>
										{m.name}
									</label>
								{/each}
							</div>
						</fieldset>
					{/if}
					<div><button class="knopf" type="submit">Angaben speichern</button></div>
				</form>
				<ThemaVorschlag />
			</section>

			{#if fertig}
				<section id="schritt-2" class="karte stapel" aria-labelledby="h-ut">
					<h2 id="h-ut"><span class="nr" aria-hidden="true">2</span>Untertitel</h2>
					{#if v.noCaptionsReason}
						<p>
							<strong>Ohne Untertitel.</strong>
							{OHNE_UNTERTITEL[v.noCaptionsReason as keyof typeof OHNE_UNTERTITEL]}.
						</p>
						<form method="POST" action="?/ohneUntertitel" use:enhance>
							<input type="hidden" name="aus" value="1" />
							<button class="knopf zweit" type="submit">Doch Untertitel verwenden</button>
						</form>
					{:else if v.hatUntertitel}
						{#if v.captionsSource === 'automatisch'}
							<p>
								<strong>Automatisch erzeugt.</strong>
								{v.captionsCheckedAt
									? 'Als geprüft markiert.'
									: 'Lies sie bitte einmal durch und korrigiere Namen und Fachbegriffe. Danach als geprüft markieren.'}
							</p>
						{:else}
							<p><strong>Hochgeladen.</strong> Die Untertitel stammen aus einer eigenen Datei.</p>
						{/if}
						<div class="reihe">
							<button
								class="knopf zweit"
								type="button"
								aria-expanded={utOffen}
								onclick={() => (utOffen = !utOffen)}
							>
								{utOffen ? 'Bearbeiten schließen' : `Untertitel bearbeiten (${data.cues.length})`}
							</button>
							{#if v.captionsSource === 'automatisch'}
								<form method="POST" action="?/geprueft" use:enhance>
									<input type="hidden" name="wert" value={v.captionsCheckedAt ? 'aus' : 'an'} />
									<button class="knopf {v.captionsCheckedAt ? 'zweit' : ''}" type="submit">
										{v.captionsCheckedAt
											? 'Markierung „geprüft“ zurücknehmen'
											: 'Untertitel sind geprüft'}
									</button>
								</form>
							{/if}
						</div>
						{#if utOffen}
							<form
								method="POST"
								action="?/untertitelText"
								class="stapel"
								use:enhance={() =>
									async ({ update }) =>
										update({ reset: false })}
							>
								<input type="hidden" name="texte" value={JSON.stringify(utTexte)} />
								<ol class="cues">
									{#each data.cues as c, i (i)}
										<li>
											<button
												class="linkknopf zeit"
												type="button"
												onclick={() => player?.springen(sekAus(c.a))}
												aria-label="Ab {c.a} abspielen"
											>
												{c.a.replace(/\.\d+$/, '')}
											</button>
											<textarea rows="2" aria-label="Untertitel ab {c.a}" bind:value={utTexte[i]}
											></textarea>
										</li>
									{/each}
								</ol>
								<p class="hinweis">Leere Zeilen werden entfernt. Die Zeiten bleiben unverändert.</p>
								<div><button class="knopf" type="submit">Untertitel speichern</button></div>
							</form>
						{/if}
					{:else}
						<p class="hinweis">
							Es gibt noch keine Untertitel. Lade eine WebVTT-Datei hoch oder gib an, warum das
							Video keine braucht.
						</p>
					{/if}

					<details class="mehr">
						<summary>
							{v.hatUntertitel
								? 'Eigene Datei statt dieser Untertitel'
								: 'Eigene Untertitel-Datei hochladen'}
						</summary>
						<p class="hinweis">
							WebVTT-Datei (.vtt, höchstens 2 MB), etwa aus Teams. Formatierungen werden entfernt;
							der Text ist in der Suche auffindbar.
						</p>
						<form
							method="POST"
							action="?/untertitel"
							enctype="multipart/form-data"
							class="reihe unten"
							use:enhance
						>
							<label class="feld">
								<span>Datei</span>
								<input type="file" name="datei" accept=".vtt,text/vtt" required />
							</label>
							<button class="knopf" type="submit">Hochladen</button>
						</form>
					</details>

					{#if !v.noCaptionsReason}
						<details class="mehr">
							<summary>Dieses Video braucht keine Untertitel</summary>
							<form method="POST" action="?/ohneUntertitel" class="stapel" use:enhance>
								<fieldset class="feld">
									<legend>Grund</legend>
									{#each Object.entries(OHNE_UNTERTITEL) as [k, t] (k)}
										<label class="haken">
											<input type="radio" name="grund" value={k} bind:group={grund} />
											{t}
										</label>
									{/each}
								</fieldset>
								{#if v.hatUntertitel}
									<p class="hinweis">Die vorhandenen Untertitel werden dabei entfernt.</p>
								{/if}
								<div>
									<button class="knopf zweit" type="submit">Ohne Untertitel speichern</button>
								</div>
							</form>
						</details>
					{/if}

					{#if v.hatUntertitel}
						<div>
							<MitFrage
								action="?/untertitelWeg"
								enhance
								knopf="Untertitel entfernen"
								knopfKlasse="linkknopf"
								frage={{
									titel: 'Untertitel entfernen?',
									text:
										v.status === 'veroeffentlicht'
											? 'Ohne Untertitel wird das Video zurückgezogen und ist wieder ein Entwurf.'
											: 'Du kannst danach neue Untertitel hochladen.',
									ja: 'Entfernen',
									gefahr: true
								}}
							/>
						</div>
					{/if}
				</section>

				<section class="karte stapel vorschlag" aria-labelledby="h-vorschlag">
					<h2 id="h-vorschlag">Zusammenfassung und Kapitel vorschlagen</h2>
					{#if !v.hatUntertitel || !v.bereit}
						<p class="hinweis">
							Sobald das Video geprüfte Untertitel hat, kann das Intranet daraus eine
							Zusammenfassung und Kapitel vorschlagen.
						</p>
					{:else if v.suggestionStatus === 'warten'}
						<p class="laeuft" role="status">
							<span class="kreisel" aria-hidden="true"></span>
							Der Vorschlag wird erstellt. Das dauert einige Minuten; du bekommst eine Nachricht, wenn
							er fertig ist.
						</p>
						<form method="POST" action="?/vorschlagVerwerfen" use:enhance>
							<button class="linkknopf" type="submit">Abbrechen</button>
						</form>
					{:else if v.suggestionStatus === 'fertig' && v.suggestion}
						{@const s = v.suggestion}
						<p class="hinweis">
							Ein Vorschlag aus den Untertiteln, erstellt von einem Sprachmodell auf unserem Server.
							Lies ihn bitte gegen, bevor du ihn übernimmst.
						</p>
						{#if s.zusammenfassung}
							<div class="vorschlagteil stapel eng">
								<h3>Zusammenfassung</h3>
								<p class="vorschlagtext">{s.zusammenfassung}</p>
								<div>
									{#if v.description.trim()}
										<MitFrage
											action="?/vorschlagZusammenfassung"
											enhance
											knopf="Als Beschreibung übernehmen"
											knopfKlasse="knopf zweit"
											frage={{
												titel: 'Beschreibung ersetzen?',
												text: 'Die bisherige Beschreibung wird durch die Zusammenfassung ersetzt.',
												ja: 'Ersetzen'
											}}
										/>
									{:else}
										<form method="POST" action="?/vorschlagZusammenfassung" use:enhance>
											<button class="knopf zweit" type="submit">Als Beschreibung übernehmen</button>
										</form>
									{/if}
								</div>
							</div>
						{/if}
						{#if s.kapitel.length}
							<div class="vorschlagteil stapel eng">
								<h3>Kapitel</h3>
								<ol class="vorschlagkapitel">
									{#each s.kapitel as k (k.s)}
										<li><span class="zeit">{zeitText(k.s)}</span> {k.t}</li>
									{/each}
								</ol>
								<div>
									{#if v.chapters.length}
										<MitFrage
											action="?/vorschlagKapitel"
											enhance
											knopf="Kapitel übernehmen"
											knopfKlasse="knopf zweit"
											frage={{
												titel: 'Kapitel ersetzen?',
												text: `Die ${v.chapters.length} bisherigen Kapitel werden durch den Vorschlag ersetzt.`,
												ja: 'Ersetzen'
											}}
										/>
									{:else}
										<form method="POST" action="?/vorschlagKapitel" use:enhance>
											<button class="knopf zweit" type="submit">Kapitel übernehmen</button>
										</form>
									{/if}
								</div>
							</div>
						{/if}
						<div class="knoepfe">
							<form method="POST" action="?/vorschlag" use:enhance>
								<button class="linkknopf" type="submit">Neu vorschlagen</button>
							</form>
							<form method="POST" action="?/vorschlagVerwerfen" use:enhance>
								<button class="linkknopf" type="submit">Vorschlag verwerfen</button>
							</form>
						</div>
					{:else}
						{#if v.suggestionStatus === 'fehler'}
							<p class="meldung fehler" role="alert">
								{v.suggestionError ?? 'Der Vorschlag hat nicht geklappt.'}
							</p>
						{/if}
						<p class="hinweis">
							Ein Sprachmodell liest die Untertitel und schlägt eine kurze Zusammenfassung und
							Kapitel vor. Es läuft auf unserem Server, der Text verlässt das Intranet nicht.
							Übernommen wird nur, was du bestätigst.
						</p>
						<form method="POST" action="?/vorschlag" use:enhance>
							<button class="knopf zweit" type="submit">
								{v.suggestionStatus === 'fehler' ? 'Noch einmal versuchen' : 'Vorschlag erstellen'}
							</button>
						</form>
					{/if}
				</section>

				<section id="schritt-3" class="karte stapel" aria-labelledby="h-kap">
					<h2 id="h-kap">
						<span class="nr" aria-hidden="true">3</span>Kapitel <span class="frei">freiwillig</span>
					</h2>
					<p class="hinweis">
						Spiel das Video ab und setze an der passenden Stelle ein Kapitel, oder füge eine Liste
						ein („0:00 Einleitung“ je Zeile).
					</p>
					<div class="reihe">
						<button
							class="knopf zweit"
							type="button"
							onclick={hierBeginnen}
							disabled={zeilen.length >= MAX_KAPITEL}
						>
							Kapitel hier beginnen ({zeitText(zeit)})
						</button>
						<button
							class="knopf zweit"
							type="button"
							onclick={() => (einfuegen = !einfuegen)}
							aria-expanded={einfuegen}
						>
							Als Text einfügen
						</button>
					</div>
					{#if einfuegen}
						<label class="feld">
							<span>Liste (ersetzt die Kapitel unten)</span>
							<textarea rows="6" bind:value={textEin} placeholder={beispielKapitel}></textarea>
						</label>
						<div>
							<button class="knopf" type="button" onclick={uebernehmen}>Übernehmen</button>
						</div>
					{/if}
					{#if zeilen.length}
						<ol class="kapitel">
							{#each zeilen as z, i (i)}
								<li class="stapel null">
									<div class="kzeile">
										<input
											class="zeit"
											aria-label="Beginn von Kapitel {i + 1}"
											bind:value={z.zeit}
											inputmode="numeric"
										/>
										<input
											aria-label="Titel von Kapitel {i + 1}"
											bind:value={z.t}
											maxlength="120"
										/>
										<button
											class="knopf zweit klein"
											type="button"
											aria-label="Zu Kapitel {i + 1} springen"
											onclick={() => player?.springen(zeitLesen(z.zeit) || 0)}
										>
											▶
										</button>
										<button
											class="knopf zweit klein"
											type="button"
											aria-label="Kapitel {i + 1} entfernen"
											onclick={() => (zeilen = zeilen.filter((_, j) => j !== i))}
										>
											✕
										</button>
									</div>
									{#if fehler[i]}<span class="feldfehler">{fehler[i]}</span>{/if}
								</li>
							{/each}
						</ol>
					{:else}
						<p class="hinweis">Noch keine Kapitel.</p>
					{/if}
					<form method="POST" action="?/kapitel" use:enhance>
						<input type="hidden" name="kapitel" value={JSON.stringify(kapitelOk ? liste : [])} />
						<button class="knopf" type="submit" disabled={!kapitelOk}>Kapitel speichern</button>
					</form>
				</section>

				<section id="schritt-4" class="karte stapel" aria-labelledby="h-text">
					<h2 id="h-text">
						<span class="nr" aria-hidden="true">4</span>Textfassung und Anhänge
						<span class="frei">freiwillig</span>
					</h2>
					<p class="hinweis">
						Der Inhalt zum Nachlesen, etwa für Menschen, die nicht hören können, und Unterlagen zum
						Video (PDF, Office, Bilder).
					</p>
					{#if data.cues.length}
						<div>
							<button class="knopf zweit" type="button" onclick={ausUntertiteln}>
								Aus den Untertiteln übernehmen
							</button>
						</div>
					{/if}
					<form
						method="POST"
						action="?/textfassung"
						class="stapel"
						use:enhance={() =>
							async ({ update }) =>
								update({ reset: false })}
					>
						{#key textVersion}
							<Editor name="text" value={textStart} label="Textfassung" bilder={false} />
						{/key}
						<Anhaenge start={data.anhaenge} legende="Anhänge zum Video" />
						<div>
							<button class="knopf" type="submit">Textfassung und Anhänge speichern</button>
						</div>
					</form>
				</section>

				<section id="schritt-5" class="karte stapel" aria-labelledby="h-pub">
					<h2 id="h-pub"><span class="nr" aria-hidden="true">5</span>Veröffentlichen</h2>
					<p class="sichtbar" class:offen={v.status !== 'veroeffentlicht'}>{sichtbarText}</p>
					{#if v.status === 'veroeffentlicht'}
						<form method="POST" action="?/zurueckziehen" use:enhance>
							<button class="knopf zweit" type="submit">Zurückziehen</button>
						</form>
					{:else if !v.bereit}
						<p class="hinweis">
							{v.hatUntertitel
								? 'Prüfe zuerst die automatisch erzeugten Untertitel (Schritt 2).'
								: 'Zuerst Untertitel hinzufügen oder angeben, warum das Video keine braucht (Schritt 2).'}
						</p>
						<div><button class="knopf" type="button" disabled>Veröffentlichen</button></div>
					{:else}
						<form method="POST" action="?/veroeffentlichen" use:enhance>
							<button class="knopf" type="submit">Veröffentlichen</button>
						</form>
					{/if}
				</section>
			{/if}

			<section class="karte stapel weitere" aria-labelledby="h-weitere">
				<h2 id="h-weitere">Weitere Aktionen</h2>
				{#if fertig}
					<details class="mehr" open={Boolean(ersatz)}>
						<summary>Videodatei ersetzen</summary>
						{#if ersatz && ersatz.status === 'hochladen'}
							<p>
								Eine neue Fassung wird hochgeladen ({mb(ersatz.uploadReceived)} von {mb(
									ersatz.uploadSize
								)} MB).
							</p>
							{#if ersatz.eigener}
								<form class="reihe unten" onsubmit={(e) => hochladen(e, 'ersatzFortsetzen')}>
									<label class="feld">
										<span>Dieselbe Datei noch einmal wählen</span>
										<input
											type="file"
											accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
											required
											disabled={laeuft}
										/>
									</label>
									<button class="knopf" type="submit" disabled={laeuft}>
										Hochladen fortsetzen
									</button>
								</form>
							{/if}
						{:else if ersatzLaeuft}
							<p>
								Die neue Fassung wird umgewandelt. Bis sie fertig ist, bleibt das bisherige Video
								online.
							</p>
							<progress
								max="100"
								value={ersatz?.status === 'umwandeln' ? ersatz.progress : undefined}
								aria-label="Fortschritt der neuen Fassung"
							>
								{ersatz?.progress} %
							</progress>
						{:else}
							{#if ersatz?.status === 'fehler'}
								<p class="meldung fehler">
									Die neue Fassung ließ sich nicht umwandeln: {ersatz.errorMessage ||
										'unbekannter Fehler'}.
								</p>
							{/if}
							<p class="hinweis">
								Das bisherige Video bleibt online, bis die neue Fassung umgewandelt ist. Kapitel
								bleiben (soweit sie in die neue Länge passen), hochgeladene Untertitel auch;
								automatisch erzeugte werden neu erzeugt und müssen wieder geprüft werden.
							</p>
							<form class="reihe unten" onsubmit={(e) => hochladen(e, 'ersatz')}>
								<label class="feld">
									<span>Neue Videodatei</span>
									<input
										type="file"
										accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
										required
										disabled={laeuft}
									/>
								</label>
								<button class="knopf" type="submit" disabled={laeuft}>
									Neue Fassung hochladen
								</button>
							</form>
						{/if}
						{#if ersatz && ersatz.status !== 'fehler' && !laeuft}
							<MitFrage
								action="?/ersatzAbbrechen"
								enhance
								knopf="Neue Fassung verwerfen"
								knopfKlasse="knopf zweit"
								frage={{
									titel: 'Neue Fassung verwerfen?',
									text: 'Das bisherige Video bleibt unverändert.',
									ja: 'Verwerfen'
								}}
							/>
						{/if}
					</details>
				{/if}
				{#if laeuft}
					<div class="stapel eng" role="status">
						<span>
							Wird hochgeladen: {prozent} % ({mb(gesendet)} von {mb(groesse)} MB). Lass die Seite bitte
							offen.
						</span>
						<progress max="100" value={prozent} aria-label="Fortschritt beim Hochladen"></progress>
					</div>
				{/if}
				{#if hochFehler}<p class="meldung fehler" role="alert">{hochFehler}</p>{/if}
				<details class="mehr">
					<summary>Video löschen</summary>
					<p class="hinweis">Das Video und alle umgewandelten Dateien werden endgültig gelöscht.</p>
					<div>
						<MitFrage
							action="?/loeschen"
							knopf="Video löschen"
							knopfKlasse="knopf rot"
							frage={{
								titel: 'Video löschen?',
								text: `„${v.title}“ wird endgültig gelöscht.`,
								ja: 'Löschen',
								gefahr: true
							}}
						/>
					</div>
				</details>
			</section>
		</div>
	</div>
</div>

<style>
	.seite {
		max-width: 80rem;
	}
	.vorschlag .knoepfe {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 18px;
	}
	.vorschlag h3 {
		margin: 0;
		font-size: 1rem;
	}
	.vorschlagteil {
		padding: 12px 14px;
		border-radius: 14px;
		border: 1px dashed var(--bd);
	}
	.vorschlagtext {
		margin: 0;
		white-space: pre-line;
	}
	.vorschlagkapitel {
		margin: 0;
		padding-left: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.vorschlagkapitel .zeit {
		display: inline-block;
		min-width: 3.5em;
		font-variant-numeric: tabular-nums;
		color: var(--mu);
	}
	.laeuft {
		display: flex;
		align-items: center;
		gap: 10px;
		margin: 0;
	}
	.kreisel {
		flex: none;
		width: 18px;
		height: 18px;
		border-radius: 999px;
		border: 2px solid var(--bd);
		border-top-color: var(--ac);
		animation: drehen 1s linear infinite;
	}
	@keyframes drehen {
		to {
			transform: rotate(360deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.kreisel {
			animation: none;
		}
	}
	h1,
	h2 {
		margin: 0;
	}
	h1 {
		font-size: 1.5rem;
	}
	h2 {
		font-size: 1.1rem;
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}
	p {
		margin: 0;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
	}
	.null {
		gap: 2px;
	}
	.eng {
		gap: 4px;
	}
	.titelzeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
	}
	.status {
		font-size: 12px;
		font-weight: 700;
		border-radius: 999px;
		padding: 2px 10px;
		background: var(--tint);
	}
	.s-fehler {
		color: var(--err-tx);
	}
	.aufbau {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
		gap: 24px;
		align-items: start;
	}
	.seitenleiste {
		position: sticky;
		top: 76px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.schritte {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	@media (max-width: 1099px) {
		.aufbau {
			grid-template-columns: minmax(0, 1fr);
		}
		.seitenleiste {
			position: static;
		}
	}
	.schritte > section {
		scroll-margin-top: 80px;
	}
	.nr {
		display: inline-grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--ac);
		color: var(--ac-tx, #fff);
		font-size: 14px;
		font-weight: 700;
	}
	.frei {
		font-size: 12px;
		font-weight: 600;
		color: var(--mu);
	}
	.sichtbar {
		padding: 8px 12px;
		border-radius: 8px;
		background: var(--ok-bg);
		border: 1px solid var(--bd);
	}
	.sichtbar.offen {
		background: var(--warn-bg);
		border-color: var(--warn-bd);
		color: var(--warn-tx);
	}
	.punkte {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.punkte li {
		display: flex;
		gap: 8px;
		align-items: baseline;
	}
	.zeichen {
		display: inline-grid;
		place-items: center;
		flex: 0 0 20px;
		height: 20px;
		border-radius: 50%;
		font-size: 12px;
		font-weight: 700;
		background: var(--tint);
	}
	.punkte .ok .zeichen {
		background: var(--ok-bg);
		color: var(--ok-tx, inherit);
		border: 1px solid var(--bd);
	}
	.punkte .offen .zeichen {
		background: var(--warn-bg);
		color: var(--warn-tx);
		border: 1px solid var(--warn-bd);
	}
	.punkte .optional {
		color: var(--mu);
	}
	.mehr summary {
		cursor: pointer;
		font-weight: 600;
		min-height: 36px;
		display: flex;
		align-items: center;
	}
	.mehr[open] > :not(summary) {
		margin-top: 8px;
	}
	.mehr {
		border-top: 1px solid var(--bd);
		padding-top: 8px;
	}
	progress {
		width: 100%;
	}
	.reihe {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.reihe.unten {
		align-items: flex-end;
	}
	.kapitel,
	.cues {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.cues {
		gap: 6px;
		max-height: 60vh;
		overflow: auto;
	}
	.cues li {
		display: grid;
		grid-template-columns: 72px 1fr;
		gap: 8px;
		align-items: start;
	}
	.cues .zeit {
		font-variant-numeric: tabular-nums;
		min-height: 40px;
	}
	.cues textarea {
		width: 100%;
		resize: vertical;
	}
	.kzeile {
		display: flex;
		gap: 6px;
		align-items: center;
	}
	.kzeile input {
		min-width: 0;
		flex: 1;
		min-height: 40px;
	}
	.kzeile input.zeit {
		flex: 0 0 72px;
		font-variant-numeric: tabular-nums;
	}
	.klein {
		min-width: 40px;
		padding: 0 8px;
	}
	.feldfehler {
		font-size: 13px;
		color: var(--err-tx);
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	legend {
		font-weight: 600;
		margin-bottom: 6px;
	}
	.auswahl {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 16px;
	}
	.haken {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		min-height: 32px;
	}
</style>
