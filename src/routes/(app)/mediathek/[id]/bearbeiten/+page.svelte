<script lang="ts">
	/** Video bearbeiten (Kap. 8.15): Angaben, Untertitel, Kapitel, Veröffentlichen. */
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
		if (!(['warten', 'umwandeln'].includes(v.status) || ersatzLaeuft) || laeuft) return;
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

	{#if inArbeit}
		<section class="karte stapel" aria-labelledby="h-stand">
			<h2 id="h-stand">Stand</h2>
			{#if v.status === 'hochladen'}
				<p>
					Das Hochladen wurde nicht abgeschlossen ({mb(v.uploadReceived)} von {mb(v.uploadSize)} MB).
					Ohne Fortschritt wird es nach 24 Stunden gelöscht.
				</p>
				{#if v.eigenerUpload}
					<form class="reihe unten" onsubmit={(e) => hochladen(e, 'fortsetzen')}>
						<label class="feld">
							<span>Dieselbe Datei noch einmal wählen</span>
							<input
								type="file"
								accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
								required
								disabled={laeuft}
							/>
						</label>
						<button class="knopf" type="submit" disabled={laeuft}>Hochladen fortsetzen</button>
					</form>
				{:else}
					<p class="hinweis">Fortsetzen kann nur die Person, die das Hochladen begonnen hat.</p>
				{/if}
			{:else}
				<p>
					{v.status === 'warten'
						? 'Das Video wartet auf die Umwandlung.'
						: 'Das Video wird umgewandelt.'} Du kannst die Seite schließen; du bekommst eine Benachrichtigung,
					wenn es fertig ist.
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
			Die Umwandlung ist fehlgeschlagen: {v.errorMessage || 'unbekannter Fehler'}. Lösche das Video
			und lade es bitte neu hoch.
		</p>
	{/if}

	{#if fertig}
		<div class="zweispaltig">
			<div class="stapel">
				<VideoPlayer
					bind:this={player}
					bind:zeit
					titel={v.title}
					quelle="/mediathek/{v.id}/medien/master.m3u8"
					vorschau="/mediathek/{v.id}/medien/vorschau.jpg"
					untertitel={v.hatUntertitel ? `/mediathek/${v.id}/untertitel.vtt` : null}
				/>
				<section class="karte stapel" aria-labelledby="h-pub">
					<h2 id="h-pub">Veröffentlichen</h2>
					{#if v.status === 'veroeffentlicht'}
						<p>Das Video ist veröffentlicht. Alle mit Zugriff auf {v.unit.name} sehen es.</p>
						<form method="POST" action="?/zurueckziehen" use:enhance>
							<button class="knopf zweit" type="submit">Zurückziehen</button>
						</form>
					{:else if !v.hatUntertitel}
						<p class="hinweis">
							Zum Veröffentlichen braucht das Video Untertitel (Barrierefreiheit).
						</p>
						<button class="knopf" type="button" disabled>Veröffentlichen</button>
					{:else if !v.bereit}
						<p class="hinweis">
							Die Untertitel wurden automatisch erzeugt. Prüfe sie unten und markiere sie als
							geprüft, dann kannst du veröffentlichen.
						</p>
						<button class="knopf" type="button" disabled>Veröffentlichen</button>
					{:else}
						<p class="hinweis">Bis dahin sehen das Video nur Personen mit dem Recht „Mediathek“.</p>
						<form method="POST" action="?/veroeffentlichen" use:enhance>
							<button class="knopf" type="submit">Veröffentlichen</button>
						</form>
					{/if}
				</section>
			</div>

			<section class="karte stapel" aria-labelledby="h-kap">
				<h2 id="h-kap">Kapitel</h2>
				<p class="hinweis">
					Spiel das Video ab und setze an der passenden Stelle ein Kapitel, oder füge eine Liste ein
					(„0:00 Einleitung“ je Zeile).
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
					<div><button class="knopf" type="button" onclick={uebernehmen}>Übernehmen</button></div>
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
									<input aria-label="Titel von Kapitel {i + 1}" bind:value={z.t} maxlength="120" />
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
		</div>
	{/if}

	<section class="karte stapel" aria-labelledby="h-meta">
		<h2 id="h-meta">Angaben</h2>
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
				<textarea name="description" rows="4" maxlength={MAX_BESCHREIBUNG}>{v.description}</textarea
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
			<div><button class="knopf" type="submit">Speichern</button></div>
		</form>
		<ThemaVorschlag />
	</section>

	{#if fertig}
		<section class="karte stapel" aria-labelledby="h-ut">
			<h2 id="h-ut">Untertitel</h2>
			<p class="hinweis">
				WebVTT-Datei (.vtt, höchstens 2 MB). Formatierungen werden entfernt; der Text ist in der
				Suche auffindbar.
			</p>
			{#if v.hatUntertitel}
				{#if v.captionsSource === 'automatisch'}
					<p>
						<strong>Automatisch erzeugt.</strong>
						{v.captionsCheckedAt
							? 'Als geprüft markiert.'
							: 'Lies sie bitte einmal durch und korrigiere Namen und Fachbegriffe.'}
					</p>
					<form method="POST" action="?/geprueft" use:enhance>
						<input type="hidden" name="wert" value={v.captionsCheckedAt ? 'aus' : 'an'} />
						<button class="knopf {v.captionsCheckedAt ? 'zweit' : ''}" type="submit">
							{v.captionsCheckedAt
								? 'Markierung „geprüft“ zurücknehmen'
								: 'Untertitel sind geprüft'}
						</button>
					</form>
				{:else}
					<p>Untertitel sind hinterlegt.</p>
				{/if}
				<div>
					<button
						class="knopf zweit"
						type="button"
						aria-expanded={utOffen}
						onclick={() => (utOffen = !utOffen)}
					>
						Untertitel bearbeiten ({data.cues.length})
					</button>
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
			{/if}
			<form
				method="POST"
				action="?/untertitel"
				enctype="multipart/form-data"
				class="reihe unten"
				use:enhance
			>
				<label class="feld">
					<span>{v.hatUntertitel ? 'Untertitel ersetzen' : 'Untertitel hochladen'}</span>
					<input type="file" name="datei" accept=".vtt,text/vtt" required />
				</label>
				<button class="knopf" type="submit">Hochladen</button>
			</form>
			{#if v.hatUntertitel}
				<MitFrage
					action="?/untertitelWeg"
					enhance
					knopf="Untertitel entfernen"
					knopfKlasse="knopf zweit"
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
			{/if}
		</section>
	{/if}

	{#if fertig}
		<section class="karte stapel" aria-labelledby="h-text">
			<h2 id="h-text">Textfassung und Anhänge</h2>
			<p class="hinweis">
				Freiwillig: der Inhalt zum Nachlesen, etwa für Menschen, die nicht hören können, und
				Unterlagen zum Video (PDF, Office, Bilder).
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
				<div><button class="knopf" type="submit">Speichern</button></div>
			</form>
		</section>

		<section class="karte stapel" aria-labelledby="h-neu">
			<h2 id="h-neu">Videodatei ersetzen</h2>
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
						<button class="knopf" type="submit" disabled={laeuft}>Hochladen fortsetzen</button>
					</form>
				{/if}
			{:else if ersatzLaeuft}
				<p>
					Die neue Fassung wird umgewandelt. Bis sie fertig ist, bleibt das bisherige Video online.
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
					<p class="meldung fehler" role="alert">
						Die neue Fassung ließ sich nicht umwandeln: {ersatz.errorMessage ||
							'unbekannter Fehler'}.
					</p>
				{/if}
				<p class="hinweis">
					Das bisherige Video bleibt online, bis die neue Fassung umgewandelt ist. Kapitel bleiben
					(soweit sie in die neue Länge passen). Hochgeladene Untertitel bleiben; automatisch
					erzeugte werden neu erzeugt und müssen wieder geprüft werden. Prüfe danach, ob alles noch
					passt.
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
					<button class="knopf" type="submit" disabled={laeuft}>Neue Fassung hochladen</button>
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
		</section>
	{/if}

	{#if laeuft}
		<div class="karte stapel eng" role="status">
			<span>
				Wird hochgeladen: {prozent} % ({mb(gesendet)} von {mb(groesse)} MB). Lass die Seite bitte offen.
			</span>
			<progress max="100" value={prozent} aria-label="Fortschritt beim Hochladen"></progress>
		</div>
	{/if}
	{#if hochFehler}<p class="meldung fehler" role="alert">{hochFehler}</p>{/if}

	<section class="karte stapel" aria-labelledby="h-weg">
		<h2 id="h-weg">Löschen</h2>
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
	</section>
</div>

<style>
	.seite {
		max-width: 76rem;
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
		color: var(--err, #b00020);
	}
	.zweispaltig {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 380px;
		gap: 24px;
		align-items: start;
	}
	@media (max-width: 1099px) {
		.zweispaltig {
			grid-template-columns: minmax(0, 1fr);
		}
	}
	progress {
		width: 100%;
	}
	.eng {
		gap: 4px;
	}
	.cues {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
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
	.reihe {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.reihe.unten {
		align-items: flex-end;
	}
	.kapitel {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
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
		color: var(--err, #b00020);
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
