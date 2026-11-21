<script lang="ts">
	import MitFrage from '#lib/components/MitFrage.svelte';
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */
	import { enhance, type SubmitFunction } from '$app/forms';
	import { page } from '$app/state';
	import {
		addDays,
		ANNOUNCE_OPTIONS,
		closureRange,
		closureTitle,
		dayLabel,
		weekdayOf,
		WEEKDAYS
	} from '#lib/canteen.ts';
	import { formatSize } from '#lib/format.ts';
	import Info from '#lib/components/Info.svelte';
	import PdfZone from '#lib/components/PdfZone.svelte';
	import { formatRange, planState } from '#lib/plans.ts';

	let { data, form } = $props();
	const infos = $derived(page.url.searchParams.get('bereich') === 'infos');
	const loc = $derived(data.location);

	// Vorschlag: nächste Woche Montag bis Freitag
	const montag = $derived(addDays(data.today, 7 - weekdayOf(data.today)));
	let ersetzen = $state<string | null>(null);
	let schliessForm = $state<string | null>(null); // '' = neu, sonst ID
	// Schalter je Tag; nach dem Speichern wieder aus den Daten
	let offen = $derived(loc.hours.map((d) => d.open));

	const fehler = $derived(form && 'fehler' in form ? form.fehler : null);
	const toast = $derived(form && 'toast' in form ? form.toast : null);
	const sf = $derived(form && 'schliessFehler' in form ? form.schliessFehler : null);
	const sWerte = $derived.by(() => {
		if (form && 'schliessung' in form && form.schliessung) return form.schliessung;
		const c = data.closures.find((x) => x.id === schliessForm);
		return c
			? {
					id: c.id,
					fromDate: c.fromDate,
					untilDate: c.untilDate,
					reason: c.reason ?? '',
					announceDays: c.announceDays
				}
			: { id: null, fromDate: data.today, untilDate: data.today, reason: '', announceDays: 7 };
	});
	const zeigeSchliessForm = $derived(schliessForm !== null || Boolean(sf));

	// Nach Erfolg: Formulare schließen, Datei-Felder leeren, eingegebene Daten behalten
	const nachAktion: SubmitFunction =
		({ formElement }) =>
		async ({ update, result }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				for (const el of formElement.querySelectorAll<HTMLInputElement>('input[type=file]'))
					el.value = '';
				ersetzen = null;
				schliessForm = null;
			}
		};
	let zone: PdfZone | undefined = $state();
	let zonenFehler = $state('');
	/** Ohne gewählte PDF gar nicht erst absenden. */
	const hochladen: SubmitFunction = (eingabe) => {
		const f = eingabe.formData.get('datei');
		if (!(f instanceof File) || f.size === 0) {
			eingabe.cancel();
			zonenFehler = 'Bitte zuerst eine PDF auswählen.';
			return;
		}
		const weiter = nachAktion(eingabe);
		return async (opts) => {
			const nach = await weiter;
			if (typeof nach === 'function') await nach(opts);
			if (opts.result.type === 'success') zone?.leeren();
		};
	};
	const ANKUENDIGEN: Record<number, string> = {
		0: 'Nicht vorher ankündigen',
		3: '3 Tage vorher',
		7: '7 Tage vorher',
		14: '14 Tage vorher'
	};
</script>

<svelte:head><title>Kantinen-Pflege · {loc.name}</title></svelte:head>

<div class="stapel">
	<!-- Überschrift für Bildschirmleser; sichtbar steht „Kantinen-Pflege“ in der Kopfzeile -->
	<h1 class="sr-only">Kantinen-Pflege {loc.name}: {infos ? 'Kantinen-Infos' : 'Speiseplan'}</h1>
	<p class="karte rahmen hinweis mit-symbol">
		<svg
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="9" />
			<path d="M12 8h.01M11 12h1v4h1" />
		</svg>
		<span>
			Dieser Zugang ist auf den Speiseplan und die Infos deiner Kantine beschränkt. Andere Inhalte
			des Intranets sind hier nicht sichtbar.
		</span>
	</p>

	<nav class="reiter" aria-label="Bereiche">
		<a href="?" aria-current={!infos ? 'page' : undefined}>Speiseplan</a>
		<a href="?bereich=infos" aria-current={infos ? 'page' : undefined}>Kantinen-Infos</a>
	</nav>

	{#if toast}<p class="meldung" role="status">{toast}</p>{/if}
	{#if fehler}<p class="meldung fehler" role="alert">{fehler}</p>{/if}

	{#if !infos}
		<section class="karte stapel" aria-labelledby="h-hochladen">
			<h2 id="h-hochladen">
				Neuen Speiseplan hochladen
				<Info
					thema="Speiseplan hochladen"
					text="Lade den Speiseplan als PDF hoch. Er erscheint bei allen Beschäftigten, die diesen Standort in ihrem Konto eingetragen haben."
				/>
			</h2>
			<form
				method="POST"
				action="?/hochladen"
				enctype="multipart/form-data"
				class="felder"
				use:enhance={hochladen}
			>
				<PdfZone bind:this={zone} bind:fehler={zonenFehler} />
				<div class="zeile">
					<label class="feld">
						<span>
							Gültig von
							<Info
								thema="Gültig von"
								text="Ab diesem Tag wird der Speiseplan angezeigt. So kannst du den Plan für nächste Woche schon jetzt hochladen."
							/>
						</span>
						<input
							type="date"
							name="von"
							required
							value={form && 'upload' in form ? form.upload?.validFrom : montag}
						/>
					</label>
					<label class="feld">
						<span>
							Gültig bis
							<Info
								thema="Gültig bis"
								text="Bis zu diesem Tag ist der Speiseplan sichtbar. Danach wird er automatisch gelöscht."
							/>
						</span>
						<input
							type="date"
							name="bis"
							required
							value={form && 'upload' in form ? form.upload?.validUntil : addDays(montag, 4)}
						/>
					</label>
				</div>
				<div class="rechts"><button class="knopf" type="submit">Hochladen</button></div>
				<p class="hinweis">Nur PDF, höchstens 20 MB · verschlüsselt gespeichert</p>
				{#if zonenFehler}<p class="meldung fehler" role="alert">{zonenFehler}</p>{/if}
			</form>
		</section>

		<section class="karte stapel" aria-labelledby="h-liste">
			<h2 id="h-liste">
				Deine Speisepläne
				<Info
					thema="Deine Speisepläne"
					text="Geplant: erscheint ab „Gültig von“. Aktuell: ist gerade sichtbar. Löschen entfernt das PDF endgültig. Abgelaufene Speisepläne löscht das System selbst."
				/>
			</h2>
			<p class="hinweis">
				Abgelaufene Speisepläne werden am Tag nach „Gültig bis“ automatisch gelöscht.
			</p>
			{#if data.menus.length === 0}
				<p class="hinweis">Keine Speisepläne vorhanden.</p>
			{:else}
				<ul class="liste">
					{#each data.menus as m (m.id)}
						{@const aktuell = planState(m, data.today) === 'aktuell'}
						<li>
							<div class="zeilenkopf">
								<span class="wer">
									<strong>{m.title}</strong>
									<span class="hinweis">
										{formatRange(m.validFrom, m.validUntil)} · PDF · {formatSize(m.size)} ·
										<a href="/dateien/{m.fileId}" target="_blank" rel="noopener">ansehen</a>
									</span>
								</span>
								<span class="schild" class:rand={!aktuell}>{aktuell ? 'Aktuell' : 'Geplant'}</span>
								<button class="knopf zweit klein" type="button" onclick={() => (ersetzen = m.id)}>
									Ersetzen
								</button>
								<MitFrage
									action="?/loeschen"
									enhance={nachAktion}
									frage={{
										titel: `Speiseplan „${m.title}“ löschen?`,
										text: aktuell
											? 'Dieser Speiseplan ist gerade sichtbar. Danach steht bei den Beschäftigten „Für diese Woche liegt noch kein Speiseplan vor“.'
											: 'Der Speiseplan wird endgültig gelöscht und erscheint nicht mehr.',
										ja: 'Endgültig löschen',
										gefahr: true
									}}
								>
									{#snippet felder()}<input type="hidden" name="id" value={m.id} />{/snippet}
									{#snippet ausloeser(klick: () => void)}
										<button class="knopf zweit klein rotschrift" type="button" onclick={klick}>
											Löschen
										</button>
									{/snippet}
								</MitFrage>
							</div>
							{#if ersetzen === m.id}
								<form
									method="POST"
									action="?/ersetzen"
									enctype="multipart/form-data"
									class="unterform"
									use:enhance={nachAktion}
								>
									<input type="hidden" name="id" value={m.id} />
									<label class="feld">
										<span>Neue PDF-Datei für {m.title}</span>
										<input type="file" name="datei" accept=".pdf,application/pdf" required />
									</label>
									<div class="aktionen">
										<button class="knopf" type="submit">Ersetzen</button>
										<button class="knopf zweit" type="button" onclick={() => (ersetzen = null)}>
											Abbrechen
										</button>
									</div>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{:else}
		<form
			method="POST"
			action="?bereich=infos&/infos"
			class="karte felder"
			aria-labelledby="h-infos"
			use:enhance={() =>
				({ update }) =>
					update({ reset: false })}
		>
			<h2 id="h-infos">Kantinen-Infos</h2>
			<p class="hinweis">
				Diese Angaben sehen die Beschäftigten über dem Speiseplan. Alle Felder sind optional, leere
				Felder werden nicht angezeigt.
			</p>
			<div class="standort">
				<span>
					<span class="klein">Standort</span><br /><strong>{loc.name}</strong>
					{#if loc.address}<br /><span class="hinweis">{loc.address}</span>{/if}
				</span>
				<span class="hinweis">Wird von der Verwaltung gepflegt</span>
			</div>

			<fieldset class="tage">
				<legend>Öffnungszeiten</legend>
				<p class="hinweis">
					Ausgeschaltet bedeutet Ruhetag. Daraus wird auch „Jetzt geöffnet“ berechnet.
				</p>
				{#each WEEKDAYS as tag, i (tag)}
					<div class="tag">
						<label class="schalter">
							<input
								type="checkbox"
								role="switch"
								name="offen_{i}"
								bind:checked={offen[i]}
								aria-label="{tag} geöffnet"
							/>
							<span class="tagname">{tag}</span>
						</label>
						{#if offen[i]}
							<span class="uhr">
								<input
									type="time"
									name="von_{i}"
									value={loc.hours[i].from || '11:30'}
									aria-label="{tag} von"
									required
								/>
								<span aria-hidden="true">–</span>
								<input
									type="time"
									name="bis_{i}"
									value={loc.hours[i].to || '14:00'}
									aria-label="{tag} bis"
									required
								/>
							</span>
						{:else}
							<span class="hinweis">Ruhetag</span>
						{/if}
					</div>
				{/each}
			</fieldset>

			<label class="feld">
				<span>Lage in der Kantine bzw. Zugang <span class="optional">(optional)</span></span>
				<input
					name="lage"
					maxlength="200"
					value={loc.place}
					placeholder="z. B. Eingang über den Innenhof"
				/>
			</label>
			<label class="feld">
				<span>Hinweis <span class="optional">(optional)</span></span>
				<textarea
					name="hinweis"
					rows="3"
					maxlength="500"
					placeholder="z. B. Bezahlung nur mit Karte">{loc.note}</textarea
				>
			</label>
			<label class="feld">
				<span>Kontakt für Rückfragen <span class="optional">(optional)</span></span>
				<input
					name="kontakt"
					maxlength="200"
					value={loc.contact}
					placeholder="z. B. E-Mail-Adresse oder Durchwahl"
				/>
			</label>
			<div><button class="knopf" type="submit">Speichern</button></div>
		</form>

		<section class="karte stapel" aria-labelledby="h-schliess">
			<div class="zeilenkopf">
				<h2 id="h-schliess">Schließzeiten</h2>
				{#if !zeigeSchliessForm}
					<button class="knopf" type="button" onclick={() => (schliessForm = '')}>
						Schließzeit eintragen
					</button>
				{/if}
			</div>
			<p class="hinweis">
				Während einer Schließzeit sehen die Beschäftigten über dem Speiseplan einen deutlichen roten
				Hinweis. Feste Ruhetage stellst du besser bei den Öffnungszeiten ein.
			</p>

			<form method="POST" action="?bereich=infos&/heute" class="heute" use:enhance>
				<span>
					<strong>Heute geschlossen</strong><br />
					<span class="hinweis">Für kurzfristige Ausfälle. Endet automatisch um Mitternacht.</span>
				</span>
				{#if loc.closedToday}
					<button class="knopf zweit" name="zu" value="nein">Hinweis entfernen</button>
				{:else}
					<button class="knopf rot" name="zu" value="ja">Heute geschlossen melden</button>
				{/if}
			</form>
			{#if loc.closedToday}
				<div class="vorschau">
					<span class="klein">VORSCHAU · SO SEHEN ES DIE BESCHÄFTIGTEN</span>
					<div class="zu">
						<strong>Heute geschlossen</strong><span>Heute, {dayLabel(data.today)}</span>
					</div>
				</div>
			{/if}

			{#if zeigeSchliessForm}
				{#key sWerte}
					<form
						method="POST"
						action="?bereich=infos&/schliessung"
						class="felder unterform rahmenform"
						use:enhance={nachAktion}
					>
						<strong>{sWerte.id ? 'Schließzeit bearbeiten' : 'Neue Schließzeit'}</strong>
						<input type="hidden" name="id" value={sWerte.id ?? ''} />
						<div class="zeile">
							<label class="feld">
								<span>Von</span>
								<input type="date" name="von" required value={sWerte.fromDate} />
								{#if sf?.fromDate}<span class="feldfehler">{sf.fromDate}</span>{/if}
							</label>
							<label class="feld">
								<span>Bis einschließlich</span>
								<input type="date" name="bis" required value={sWerte.untilDate} />
								{#if sf?.untilDate}<span class="feldfehler">{sf.untilDate}</span>{/if}
							</label>
						</div>
						<label class="feld">
							<span>Grund</span>
							<input
								name="grund"
								maxlength="80"
								value={sWerte.reason}
								placeholder="z. B. Betriebsferien, Umbau"
							/>
							{#if sf?.reason}<span class="feldfehler">{sf.reason}</span>{/if}
						</label>
						<label class="feld">
							<span>Vorher ankündigen</span>
							<select name="ankuendigen" value={String(sWerte.announceDays)}>
								{#each ANNOUNCE_OPTIONS as n (n)}<option value={String(n)}>
										{ANKUENDIGEN[n]}
									</option>{/each}
							</select>
							<span class="hinweis">
								Die Ankündigung erscheint dezent über dem Speiseplan und auf der Startseite.
							</span>
						</label>
						<div class="aktionen">
							<button class="knopf" type="submit">Speichern</button>
							<a class="knopf zweit" href="?bereich=infos" onclick={() => (schliessForm = null)}>
								Abbrechen
							</a>
						</div>
					</form>
				{/key}
			{/if}

			{#if data.closures.length === 0}
				<p class="hinweis">Keine Schließzeiten eingetragen.</p>
			{:else}
				<ul class="liste">
					{#each data.closures as c (c.id)}
						{@const laeuft = c.fromDate <= data.today}
						<li>
							<div class="zeilenkopf">
								<span class="wer">
									<strong>{closureTitle(c)}</strong>
									<span class="hinweis">
										{closureRange(c)}{c.announceDays
											? ` · Ankündigung ${c.announceDays} Tage vorher`
											: ''}
									</span>
								</span>
								<span class="schild" class:rand={!laeuft}>{laeuft ? 'Läuft' : 'Geplant'}</span>
								<button
									class="knopf zweit klein"
									type="button"
									onclick={() => (schliessForm = c.id)}
								>
									Bearbeiten
								</button>
								<form method="POST" action="?bereich=infos&/schliessungLoeschen" use:enhance>
									<input type="hidden" name="id" value={c.id} />
									<button class="knopf zweit klein rotschrift" type="submit">Löschen</button>
								</form>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>

<style>
	h2 {
		margin: 0;
		font-size: 1.15rem;
	}
	.rahmen {
		margin: 0;
	}
	.mit-symbol {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	.mit-symbol svg {
		flex: none;
		margin-top: 2px;
	}
	.rechts {
		display: flex;
		justify-content: flex-end;
	}
	.reiter {
		display: flex;
		gap: 8px;
	}
	.reiter a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 18px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		font-weight: 600;
		text-decoration: none;
	}
	.reiter a[aria-current='page'] {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
	}
	.zeile {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
		gap: 14px;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.liste > li {
		display: grid;
		gap: 8px;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.zeilenkopf {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 14px;
	}
	.zeilenkopf h2 {
		flex: 1;
	}
	.wer {
		flex: 1 1 200px;
		display: flex;
		flex-direction: column;
	}
	.klein {
		min-height: 40px;
		padding: 6px 14px;
		font-size: 14px;
		border-radius: 999px;
	}
	span.klein {
		font-size: 12px;
		font-weight: 700;
		color: var(--mu);
		padding: 0;
		min-height: 0;
	}
	.rot {
		background: var(--rot);
		border-color: var(--rot);
		color: #fff;
	}
	.rotschrift {
		color: var(--err-tx);
	}
	.unterform {
		display: grid;
		gap: 10px;
	}
	.rahmenform {
		padding: 14px;
		border: 1px solid var(--ac);
		border-radius: 14px;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.standort {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 8px;
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--bg);
	}
	.tage {
		border: 0;
		margin: 0;
		padding: 0;
		display: grid;
	}
	.tag {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 6px 10px;
		min-height: 52px;
		border-top: 1px solid var(--bd);
	}
	.schalter {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		cursor: pointer;
	}
	.schalter input {
		appearance: none;
		width: 44px;
		height: 26px;
		margin: 0;
		border-radius: 999px;
		background: #a7b0ab;
		position: relative;
		cursor: pointer;
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
	}
	.schalter input:checked {
		background: var(--fill);
	}
	.schalter input:checked::after {
		left: 21px;
	}
	.tagname {
		font-weight: 600;
		min-width: 84px;
	}
	.uhr {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.uhr input {
		width: 116px;
	}
	.optional {
		font-weight: 400;
		color: var(--mu);
	}
	.heute {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--bg);
	}
	.vorschau {
		display: grid;
		gap: 8px;
		padding: 12px;
		border-radius: 12px;
		background: var(--bg);
	}
	.zu {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 16px 18px;
		border-radius: 16px;
		background: #fcebeb;
		border: 1px solid #f09595;
		border-left: 6px solid var(--err-tx);
		color: #18201c;
	}
	.zu strong {
		font-size: 20px;
		color: var(--err-tx);
	}
	.feldfehler {
		color: var(--err-tx);
		font-weight: 600;
	}
</style>
