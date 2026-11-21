<script lang="ts">
	import { enhance } from '$app/forms';
	import EntraAbgleich from '#lib/components/EntraAbgleich.svelte';
	import Info from '#lib/components/Info.svelte';
	import { PASSWORD_MIN_OPTIONS, RESET_MINUTES_OPTIONS } from '#lib/password.ts';

	let { data, form } = $props();
	const f = $derived(data.entra.felder);
	const meldung = (bereich: string) => (form?.bereich === bereich ? form : null);
	const feldFehler = $derived(
		(form?.bereich === 'entra' && 'felder' in form ? form.felder : {}) as Record<string, string>
	);
	const eingabe = (name: 'tenantId' | 'clientId' | 'accessGroupId') =>
		form?.bereich === 'entra' && 'werte' in form
			? String((form.werte as Record<string, string>)[name] ?? '')
			: (f[name].gespeichert ?? '');

	const FELDER = [
		{ key: 'tenantId', label: 'Tenant-ID (Verzeichnis-ID)' },
		{ key: 'clientId', label: 'Client-ID (Anwendungs-ID)' },
		{ key: 'accessGroupId', label: 'Zugangsgruppe (Objekt-ID)' }
	] as const;

	const optionen = [
		{ wert: '30m', text: '30 Minuten' },
		{ wert: '8h', text: '8 Stunden (Standard)' },
		{ wert: '7d', text: '7 Tage' }
	];
	let pruefe = $state(false);
</script>

<svelte:head>
	<title>Anmeldung · Verwaltung · Intranet</title>
</svelte:head>

<div class="stapel seite">
	<h1>Anmeldung</h1>

	<section class="karte stapel" aria-labelledby="h-entra-verbindung">
		<h2 id="h-entra-verbindung">
			Microsoft Entra ID
			<Info
				thema="Microsoft Entra ID"
				text="Die Werte findest du im Entra Admin Center in der App-Registrierung (Übersicht) und bei der Gruppe (Objekt-ID). Leere Felder nehmen den Wert aus der .env. Das Client-Secret steht nur in der .env."
			/>
		</h2>
		{#if meldung('entra')?.gespeichert}<p class="meldung" role="status">Gespeichert.</p>{/if}
		{#if meldung('entra')?.fehler}
			<p class="meldung fehler" role="alert">{meldung('entra')?.fehler}</p>
		{/if}
		<form
			method="POST"
			action="?/entra"
			class="felder"
			use:enhance={() =>
				({ update }) =>
					update({ reset: false })}
		>
			{#each FELDER as feld (feld.key)}
				<label class="feld">
					<span>{feld.label}</span>
					<input
						name={feld.key}
						value={eingabe(feld.key)}
						placeholder={f[feld.key].env ? `aus .env: ${f[feld.key].env}` : 'nicht gesetzt'}
						autocomplete="off"
						spellcheck="false"
						maxlength="36"
						class="id"
						aria-invalid={feldFehler[feld.key] ? 'true' : undefined}
						aria-describedby="h-{feld.key}"
					/>
					<span id="h-{feld.key}" class={feldFehler[feld.key] ? 'feldfehler' : 'hinweis'}>
						{feldFehler[feld.key] ??
							(f[feld.key].gespeichert
								? 'Hier gespeichert.'
								: f[feld.key].env
									? `Leer: gilt ${f[feld.key].envName} aus der .env.`
									: 'Nicht gesetzt.')}
					</span>
				</label>
			{/each}
			<dl class="werte">
				<div>
					<dt>Client-Secret</dt>
					<dd>
						{data.entra.secretGesetzt ? 'gesetzt (ENTRA_CLIENT_SECRET)' : 'fehlt in der .env'}
					</dd>
				</div>
				<div>
					<dt>Umleitungs-URI</dt>
					<dd class="id">{data.umleitung}</dd>
				</div>
			</dl>
			<div class="aktionen">
				<button class="knopf" type="submit">Speichern</button>
			</div>
		</form>

		<form
			method="POST"
			action="?/pruefen"
			use:enhance={() => {
				pruefe = true;
				return async ({ update }) => {
					await update({ reset: false });
					pruefe = false;
				};
			}}
		>
			<button class="knopf zweit" type="submit" disabled={pruefe}>
				{pruefe ? 'Prüfe …' : 'Verbindung prüfen'}
			</button>
		</form>
		{#if form?.bereich === 'pruefung' && 'pruefung' in form && form.pruefung}
			<ul class="pruefung" aria-label="Ergebnis der Prüfung" role="status">
				{#each form.pruefung as p (p.name)}
					<li class={p.stufe}>
						<span class="zeichen" aria-hidden="true">
							{p.stufe === 'ok' ? '✓' : p.stufe === 'warnung' ? '!' : '✗'}
						</span>
						<span>
							<strong>{p.name}</strong>
							<span class="sr-only">
								({p.stufe === 'ok' ? 'in Ordnung' : p.stufe === 'warnung' ? 'Warnung' : 'Fehler'})
							</span>: {p.text}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<EntraAbgleich
		abgleich={data.abgleich}
		fehler={form?.bereich === 'abgleich' && 'fehler' in form ? String(form.fehler) : null}
	/>

	<section class="karte stapel" aria-labelledby="h-richtlinie">
		<h2 id="h-richtlinie">Lokale Konten</h2>
		{#if meldung('richtlinie')?.gespeichert}<p class="meldung" role="status">Gespeichert.</p>{/if}
		{#if meldung('richtlinie')?.fehler}
			<p class="meldung fehler" role="alert">{meldung('richtlinie')?.fehler}</p>
		{/if}
		<form
			method="POST"
			action="?/richtlinie"
			class="felder"
			use:enhance={() =>
				({ update }) =>
					update({ reset: false })}
		>
			<fieldset>
				<legend>
					Mindestlänge des Passworts
					<Info
						thema="Mindestlänge"
						text="Gilt für neue Passwörter (Einladung, Zurücksetzen). Bestehende Passwörter bleiben gültig. Passwörter aus bekannten Datenlecks werden immer abgelehnt."
					/>
				</legend>
				<div role="radiogroup" aria-label="Mindestlänge des Passworts" class="reihe">
					{#each PASSWORD_MIN_OPTIONS as n (n)}
						<label class="option">
							<input
								type="radio"
								name="mindestlaenge"
								value={n}
								checked={data.richtlinie.minLength === n}
							/>
							{n} Zeichen{n === 12 ? ' (Standard)' : ''}
						</label>
					{/each}
				</div>
			</fieldset>
			<fieldset>
				<legend>
					Link „Passwort vergessen“ gilt
					<Info
						thema="Link Passwort vergessen"
						text="So lange kann die Person ihr Passwort mit dem Link aus der E-Mail neu festlegen. Der Link gilt nur einmal; der zweite Faktor bleibt nötig."
					/>
				</legend>
				<div role="radiogroup" aria-label="Gültigkeit des Links" class="reihe">
					{#each RESET_MINUTES_OPTIONS as n (n)}
						<label class="option">
							<input
								type="radio"
								name="link"
								value={n}
								checked={data.richtlinie.resetMinutes === n}
							/>
							{n} Minuten{n === 30 ? ' (Standard)' : ''}
						</label>
					{/each}
				</div>
			</fieldset>
			<div><button class="knopf" type="submit">Speichern</button></div>
		</form>
	</section>

	<section class="karte stapel" aria-labelledby="h-inaktiv">
		<h2 id="h-inaktiv">Abmelden nach Inaktivität</h2>
		{#if meldung('inaktivitaet')?.gespeichert}<p class="meldung" role="status">Gespeichert.</p>{/if}
		{#if meldung('inaktivitaet')?.fehler}
			<p class="meldung fehler" role="alert">{meldung('inaktivitaet')?.fehler}</p>
		{/if}
		<form
			method="POST"
			action="?/inaktivitaet"
			class="felder"
			use:enhance={() =>
				({ update }) =>
					update({ reset: false })}
		>
			<p class="hinweis">
				Gilt für alle Anmeldungen (Microsoft und lokal). Unabhängig davon endet jede Sitzung
				spätestens nach 30 Tagen.
			</p>
			<div role="radiogroup" aria-labelledby="h-inaktiv" class="reihe">
				{#each optionen as o (o.wert)}
					<label class="option">
						<input type="radio" name="idle" value={o.wert} checked={data.idle === o.wert} />
						{o.text}
					</label>
				{/each}
			</div>
			<div><button class="knopf" type="submit">Speichern</button></div>
		</form>
	</section>
</div>

<style>
	.seite {
		max-width: 48rem;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	legend {
		margin-bottom: 4px;
	}
	.reihe {
		display: flex;
		flex-wrap: wrap;
		column-gap: 20px;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
	}
	.option input {
		width: 1.25rem;
		height: 1.25rem;
		accent-color: var(--fill);
	}
	.id {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.92rem;
		word-break: break-all;
	}
	.werte {
		margin: 0;
		display: grid;
		gap: 8px;
	}
	.werte > div {
		display: grid;
		grid-template-columns: minmax(10rem, 13rem) 1fr;
		gap: 12px;
	}
	@media (max-width: 560px) {
		.werte > div {
			grid-template-columns: 1fr;
			gap: 2px;
		}
	}
	dt {
		color: var(--mu);
	}
	dd {
		margin: 0;
	}
	.aktionen {
		display: flex;
		gap: 10px;
	}
	.pruefung {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	.pruefung li {
		display: flex;
		gap: 10px;
		align-items: baseline;
	}
	.zeichen {
		font-weight: 700;
		width: 1.2em;
		text-align: center;
	}
	.ok .zeichen {
		color: var(--ac);
	}
	.warnung .zeichen {
		color: var(--warn-tx);
	}
	.fehler .zeichen {
		color: var(--err-tx);
	}
</style>
