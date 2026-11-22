<script lang="ts">
	/**
	 * Verwaltung → Speicher (Kap. 18): Speicherorte, Zuordnung je Inhaltsart,
	 * Umzug vorhandener Dateien. Nur System-Admins.
	 */
	import { onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import MitFrage from '#lib/components/MitFrage.svelte';
	import { frage } from '#lib/frage.svelte.ts';

	let { data, form } = $props();

	type Pruefung = {
		ok: boolean;
		meldung: string;
		schritte: { label: string; ok: boolean | null }[];
	};
	const bereich = (b: string) =>
		form && 'bereich' in form && form.bereich === b
			? (form as Record<string, unknown> & {
					fehler?: string;
					ergebnis?: string;
					pruefung?: Pruefung;
					felder?: Record<string, string>;
					werte?: Record<string, string | boolean>;
					id?: string | null;
				})
			: null;

	const groesse = (b: number) => {
		if (b < 1024 * 1024) return `${Math.max(0, Math.round(b / 1024))} KB`;
		if (b < 1024 ** 3)
			return `${(b / 1024 ** 2).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
		return `${(b / 1024 ** 3).toLocaleString('de-DE', { maximumFractionDigits: 1 })} GB`;
	};
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Europe/Berlin'
	});
	const zielName = (id: string | null) =>
		id ? (data.ziele.find((t) => t.id === id)?.name ?? 'unbekannt') : 'Lokal';

	/** Formular: null = zu, 'neu' = neuer Speicher, sonst ID des bearbeiteten */
	let offen = $state<string | null>(null);
	$effect(() => {
		const f = bereich('s3');
		if (f?.fehler) offen = f.id ?? 'neu';
		else if (f?.ergebnis) offen = null;
	});
	const bearbeitet = $derived(
		offen && offen !== 'neu' ? data.ziele.find((t) => t.id === offen) : null
	);
	const fs3 = $derived(bereich('s3'));
	const wert = (name: string, gespeichert: string | undefined) =>
		fs3?.werte && name in fs3.werte ? String(fs3.werte[name]) : (gespeichert ?? '');

	// Während eines Umzugs regelmäßig aktualisieren
	const laeuft = $derived(data.kategorien.some((k) => k.umzug));
	let timer: ReturnType<typeof setInterval> | null = null;
	$effect(() => {
		if (laeuft && !timer) timer = setInterval(() => void invalidateAll(), 3000);
		if (!laeuft && timer) {
			clearInterval(timer);
			timer = null;
		}
	});
	onDestroy(() => timer && clearInterval(timer));

	/** Vor dem Absenden nachfragen, wenn vorhandene Dateien umziehen sollen */
	function zuordnenAbsenden(k: { label: string; anzahl: number }) {
		return async ({ formData, cancel }: { formData: FormData; cancel: () => void }) => {
			if (formData.get('umziehen') === 'on') {
				const ok = await frage({
					titel: 'Vorhandene Dateien umziehen?',
					text: `„${k.label}“: Jede Datei wird an den neuen Ort kopiert und geprüft, erst danach am alten Ort gelöscht. Du kannst den Umzug jederzeit abbrechen.`,
					ja: 'Umzug starten'
				});
				if (!ok) return cancel();
			}
			// Nach dem Speichern zurücksetzen (Auswahl kommt aus den Daten, Häkchen wieder aus)
			return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => update();
		};
	}
</script>

<svelte:head><title>Speicher · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<div class="stapel eng">
		<h1>Speicher</h1>
		<p class="hinweis">
			Lege fest, wo die Dateien des Intranets liegen. Das Intranet verschlüsselt jede Datei selbst,
			bevor es sie ablegt, egal an welchem Ort.
		</p>
	</div>

	<section class="stapel" aria-labelledby="h-orte">
		<div class="zeile">
			<h2 id="h-orte">Speicherorte</h2>
			{#if offen !== 'neu'}
				<button class="knopf" type="button" onclick={() => (offen = 'neu')}>
					S3-Speicher hinzufügen
				</button>
			{/if}
		</div>
		{#if bereich('s3')?.ergebnis}
			<p class="meldung" role="status">{bereich('s3')?.ergebnis}</p>
		{/if}
		<div class="raster">
			<div class="karte stapel eng">
				<div class="zeile"><strong>Lokal</strong><span class="schild">immer vorhanden</span></div>
				<span class="hinweis">Volume auf dem Server</span>
				<span>{groesse(data.belegungJeZiel.lokal ?? 0)} belegt</span>
				{#if data.platte}
					{@const anteil = 1 - data.platte.frei / data.platte.gesamt}
					<div
						class="balken"
						role="img"
						aria-label="Platte zu {Math.round(anteil * 100)} % belegt, {groesse(
							data.platte.frei
						)} frei"
					>
						<div class:voll={anteil > 0.9} style:width="{Math.min(100, anteil * 100)}%"></div>
					</div>
					<span class="hinweis">
						Platte: {groesse(data.platte.frei)} frei von {groesse(data.platte.gesamt)}
					</span>
				{/if}
			</div>
			{#each data.ziele as t (t.id)}
				{@const pr = bereich(`pruefen-${t.id}`)}
				<div class="karte stapel eng">
					<div class="zeile">
						<strong>{t.name}</strong>
						{#if t.checkOk === null}
							<span class="schild warn">nicht geprüft</span>
						{:else if t.checkOk}
							<span class="schild">
								{t.checkVersioning ? 'verbunden' : 'verbunden, ohne Versionierung'}
							</span>
						{:else}
							<span class="schild fehler">Fehler</span>
						{/if}
					</div>
					<span class="hinweis umbruch">S3 · {t.endpoint} · Bucket {t.bucket}</span>
					<span class="hinweis">
						Secret Key: gesetzt · {groesse(data.belegungJeZiel[t.id] ?? 0)} belegt
					</span>
					{#if t.checkedAt}
						<span class="hinweis">Zuletzt geprüft: {datum.format(new Date(t.checkedAt))}</span>
					{/if}
					{#if pr?.pruefung}
						<ul class="schritte" aria-label="Ergebnis der Verbindungsprüfung">
							{#each pr.pruefung.schritte as s (s.label)}
								<li class:ok={s.ok === true} class:nein={s.ok === false}>
									<span aria-hidden="true">{s.ok === true ? '✓' : s.ok === false ? '✗' : '–'}</span>
									{s.label}{s.ok === null ? ' (nicht geprüft)' : ''}
								</li>
							{/each}
						</ul>
					{/if}
					{#if pr?.ergebnis}<p class="meldung" role="status">{pr.ergebnis}</p>{/if}
					{#if pr?.fehler}<p class="meldung fehler" role="alert">{pr.fehler}</p>{/if}
					<div class="reihe">
						<form method="POST" action="?/pruefen" use:enhance>
							<input type="hidden" name="id" value={t.id} />
							<button class="knopf zweit" type="submit">Verbindung prüfen</button>
						</form>
						<button class="knopf zweit" type="button" onclick={() => (offen = t.id)}>
							Bearbeiten
						</button>
						<MitFrage
							action="?/loeschen"
							enhance
							knopf="Löschen"
							knopfKlasse="knopf zweit"
							knopfLabel="Speicherort {t.name} löschen"
							frage={{
								titel: 'Speicherort löschen?',
								text: `„${t.name}“ wird aus dem Intranet entfernt. Das geht nur, wenn dort keine Dateien mehr liegen. Der Bucket selbst bleibt unverändert.`,
								ja: 'Löschen',
								gefahr: true
							}}
						>
							{#snippet felder()}<input type="hidden" name="id" value={t.id} />{/snippet}
						</MitFrage>
					</div>
				</div>
			{/each}
		</div>
	</section>

	{#if offen}
		<section class="karte stapel" aria-labelledby="h-form">
			<h2 id="h-form">{bearbeitet ? `${bearbeitet.name} bearbeiten` : 'S3-Speicher hinzufügen'}</h2>
			{#if fs3?.fehler}<p class="meldung fehler" role="alert">{fs3.fehler}</p>{/if}
			{#if fs3?.pruefung}
				<ul class="schritte" aria-label="Ergebnis der Verbindungsprüfung">
					{#each fs3.pruefung.schritte as s (s.label)}
						<li class:ok={s.ok === true} class:nein={s.ok === false}>
							<span aria-hidden="true">{s.ok === true ? '✓' : s.ok === false ? '✗' : '–'}</span>
							{s.label}
						</li>
					{/each}
				</ul>
			{/if}
			<form
				method="POST"
				action="?/s3"
				class="felder"
				autocomplete="off"
				use:enhance={() =>
					({ update }) =>
						update({ reset: false })}
			>
				{#if bearbeitet}<input type="hidden" name="id" value={bearbeitet.id} />{/if}
				<div class="zwei gleich">
					<label class="feld">
						<span>Name</span>
						<input
							name="name"
							required
							maxlength="80"
							value={wert('name', bearbeitet?.name)}
							placeholder="z. B. Objektspeicher"
							aria-invalid={fs3?.felder?.name ? 'true' : undefined}
						/>
						{#if fs3?.felder?.name}<span class="feldfehler">{fs3.felder.name}</span>{/if}
					</label>
					<label class="feld">
						<span>Endpoint</span>
						<input
							name="endpoint"
							type="url"
							required
							value={wert('endpoint', bearbeitet?.endpoint)}
							placeholder="https://s3.example.org"
							aria-invalid={fs3?.felder?.endpoint ? 'true' : undefined}
							aria-describedby="ep-hinweis"
						/>
						{#if fs3?.felder?.endpoint}<span class="feldfehler">
								{fs3.felder.endpoint}
							</span>{:else}<span class="hinweis" id="ep-hinweis">
								Nur https://, keine internen Adressen.
							</span>{/if}
					</label>
				</div>
				<div class="zwei gleich">
					<label class="feld">
						<span>Region <span class="optional">(optional)</span></span>
						<input
							name="region"
							maxlength="60"
							value={wert('region', bearbeitet?.region)}
							placeholder="z. B. eu-central"
							aria-invalid={fs3?.felder?.region ? 'true' : undefined}
						/>
						{#if fs3?.felder?.region}<span class="feldfehler">{fs3.felder.region}</span>{/if}
					</label>
					<label class="feld">
						<span>Bucket</span>
						<input
							name="bucket"
							required
							maxlength="63"
							value={wert('bucket', bearbeitet?.bucket)}
							aria-invalid={fs3?.felder?.bucket ? 'true' : undefined}
						/>
						{#if fs3?.felder?.bucket}<span class="feldfehler">{fs3.felder.bucket}</span>{/if}
					</label>
				</div>
				<div class="zwei gleich">
					<label class="feld">
						<span>Access Key</span>
						<input
							name="accessKey"
							required
							maxlength="200"
							value={wert('accessKey', bearbeitet?.accessKey)}
							aria-invalid={fs3?.felder?.accessKey ? 'true' : undefined}
						/>
						{#if fs3?.felder?.accessKey}<span class="feldfehler">{fs3.felder.accessKey}</span>{/if}
					</label>
					<label class="feld">
						<span>Secret Key</span>
						<input
							name="secret"
							type="password"
							autocomplete="new-password"
							maxlength="500"
							required={!bearbeitet}
							placeholder={bearbeitet ? 'gesetzt – nur zum Ändern eingeben' : ''}
							aria-invalid={fs3?.felder?.secret ? 'true' : undefined}
						/>
						{#if fs3?.felder?.secret}<span class="feldfehler">{fs3.felder.secret}</span>{:else}<span
								class="hinweis"
							>
								Wird verschlüsselt gespeichert und nie angezeigt.
							</span>{/if}
					</label>
				</div>
				<label class="option">
					<input
						type="checkbox"
						name="pathStyle"
						checked={fs3?.werte ? Boolean(fs3.werte.pathStyle) : (bearbeitet?.pathStyle ?? true)}
					/>
					<span>
						Pfad-Stil (Adresse/Bucket/Datei) <span class="hinweis">
							– nötig bei vielen selbst betriebenen Speichern
						</span>
					</span>
				</label>
				<p class="hinweis">
					Vor dem Speichern prüft das Intranet die Verbindung. Gib ihm Zugangsdaten, die nur auf
					diesen einen Bucket zugreifen können, und schalte im Bucket die Versionierung ein.
				</p>
				<div class="reihe">
					<button class="knopf" type="submit">Prüfen und speichern</button>
					<button class="knopf zweit" type="button" onclick={() => (offen = null)}>
						Abbrechen
					</button>
				</div>
			</form>
		</section>
	{/if}

	<section class="karte stapel" aria-labelledby="h-zu">
		<h2 id="h-zu">Was wo liegt</h2>
		<p class="hinweis">
			Neue Dateien landen sofort am gewählten Ort. Vorhandene Dateien kannst du dabei umziehen
			lassen.
		</p>
		<ul class="arten">
			{#each data.kategorien as k (k.key)}
				{@const fk = bereich(`k-${k.key}`)}
				<li class="stapel eng">
					<div class="zeile">
						<div class="stapel null">
							<strong>{k.label}</strong>
							<span class="hinweis">{k.text}</span>
						</div>
						<span class="hinweis">
							{k.anzahl.toLocaleString('de-DE')} Dateien · {groesse(k.bytes)}
						</span>
					</div>
					{#if k.orte.length > 1}
						<span class="hinweis">
							Verteilt: {k.orte
								.map((o) => `${zielName(o.ziel)} ${o.anzahl.toLocaleString('de-DE')}`)
								.join(' · ')}
						</span>
					{/if}
					{#if fk?.ergebnis}<p class="meldung" role="status">{fk.ergebnis}</p>{/if}
					{#if fk?.fehler}<p class="meldung fehler" role="alert">{fk.fehler}</p>{/if}
					{#if k.umzug}
						{@const anteil = k.umzug.total ? (k.umzug.done + k.umzug.failed) / k.umzug.total : 1}
						<div class="stapel eng">
							<span>
								Wird umgezogen nach {zielName(k.umzug.ziel)}: {k.umzug.done.toLocaleString('de-DE')} von
								{k.umzug.total.toLocaleString('de-DE')}{k.umzug.failed
									? `, ${k.umzug.failed} mit Fehler`
									: ''}
							</span>
							<div
								class="balken"
								role="progressbar"
								aria-label="Umzug {k.label}"
								aria-valuemin="0"
								aria-valuemax="100"
								aria-valuenow={Math.round(anteil * 100)}
							>
								<div style:width="{Math.round(anteil * 100)}%"></div>
							</div>
							<MitFrage
								action="?/abbrechen"
								enhance
								knopf="Umzug abbrechen"
								frage={{
									titel: 'Umzug abbrechen?',
									text: 'Bereits umgezogene Dateien bleiben am neuen Ort, die übrigen am alten. Es geht nichts verloren.',
									ja: 'Abbrechen',
									nein: 'Weiter umziehen'
								}}
							>
								{#snippet felder()}
									<input type="hidden" name="id" value={k.umzug?.id} />
									<input type="hidden" name="kategorie" value={k.key} />
								{/snippet}
							</MitFrage>
						</div>
					{:else}
						{#if k.letzterUmzug?.message}
							<p class="meldung warnung">{k.letzterUmzug.message}</p>
						{/if}
						<form
							method="POST"
							action="?/zuordnen"
							class="reihe unten"
							use:enhance={zuordnenAbsenden(k)}
						>
							<input type="hidden" name="kategorie" value={k.key} />
							<label class="feld">
								<span>Speicherort</span>
								<select name="ziel" value={k.ziel ?? 'lokal'}>
									<option value="lokal">Lokal</option>
									{#each data.ziele as t (t.id)}
										<option value={t.id}>{t.name}</option>
									{/each}
								</select>
							</label>
							<label class="option">
								<input type="checkbox" name="umziehen" />
								<span>Vorhandene Dateien umziehen</span>
							</label>
							<button class="knopf zweit" type="submit">Speichern</button>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.seite {
		max-width: 56rem;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	p {
		margin: 0;
	}
	.eng {
		gap: 6px;
	}
	.null {
		gap: 0;
	}
	.zeile {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px 12px;
		flex-wrap: wrap;
	}
	.reihe {
		display: flex;
		flex-wrap: wrap;
		gap: 8px 12px;
		align-items: center;
	}
	.reihe.unten {
		align-items: flex-end;
	}
	.raster {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
		gap: 12px;
	}
	.schild {
		font-size: 12px;
		font-weight: 700;
		border-radius: 999px;
		padding: 2px 10px;
		background: var(--tint);
		color: var(--ac);
	}
	.schild.warn {
		background: var(--warn-bg);
		color: var(--warn-tx);
	}
	.schild.fehler {
		background: var(--fehler-bg, #fce4e4);
		color: var(--fehler-fg, #7a1616);
	}
	.umbruch {
		overflow-wrap: anywhere;
	}
	.balken {
		height: 8px;
		border-radius: 999px;
		background: var(--bd);
		overflow: hidden;
	}
	.balken > div {
		height: 100%;
		background: var(--ac);
	}
	.balken > div.voll {
		background: #c0392b;
	}
	.schritte {
		margin: 0;
		padding: 8px 12px;
		list-style: none;
		border-radius: 10px;
		background: var(--bg);
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 14px;
	}
	.schritte .ok {
		color: var(--ac);
	}
	.schritte .nein {
		color: #b42318;
	}
	.arten {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.arten > li {
		padding: 14px 0;
		border-top: 1px solid var(--bd);
	}
	select {
		min-width: 200px;
	}
</style>
