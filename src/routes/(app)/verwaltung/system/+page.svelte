<script lang="ts">
	import { onDestroy } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Info from '#lib/components/Info.svelte';
	import { groesse } from '#lib/system-status.ts';

	let { data, form } = $props();
	const e = $derived(data.abgleich);
	const s = $derived(data.system);
	const b = $derived(data.sicherung);
	const zeit = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Europe/Berlin'
	});
	const datum = (v: string | Date | null | undefined) => {
		if (!v) return '–';
		const d = typeof v === 'string' ? new Date(v) : v;
		return Number.isNaN(d.getTime()) ? '–' : zeit.format(d);
	};
	function dauer(sek: number) {
		if (sek < 60) return `${sek} s`;
		if (sek < 3600) return `${Math.round(sek / 60)} min`;
		const t = Math.floor(sek / 86400);
		const h = Math.floor((sek % 86400) / 3600);
		return t ? `${t} ${t === 1 ? 'Tag' : 'Tage'}, ${h} h` : `${h} h`;
	}
	const fehler = $derived(b?.befunde.filter((x) => x.stufe === 'fehler') ?? []);
	const warnungen = $derived(b?.befunde.filter((x) => x.stufe === 'warnung') ?? []);
	const migrationenOk = $derived(
		s.datenbank.migrationen.vorhanden !== null &&
			s.datenbank.migrationen.eingespielt === s.datenbank.migrationen.vorhanden
	);
	// SvelteKit-Build-Version ist standardmäßig der Zeitstempel des Builds
	const gebaut = $derived(/^\d{13}$/.test(s.build) ? datum(new Date(Number(s.build))) : s.build);
	let laedt = $state(false);

	// Läuft der Abgleich, alle 3 Sekunden nachsehen, bis er fertig ist
	let poll: ReturnType<typeof setInterval> | null = null;
	$effect(() => {
		if (e.laeuft && !poll) poll = setInterval(() => invalidateAll(), 3000);
		if (!e.laeuft && poll) {
			clearInterval(poll);
			poll = null;
		}
	});
	onDestroy(() => {
		if (poll) clearInterval(poll);
	});
	const zahlen = $derived(
		e.letzter
			? [
					[e.letzter.geprueft, 'geprüft'],
					[e.letzter.aktualisiert, 'Profil geändert'],
					[e.letzter.rollen, 'Rollen geändert'],
					[e.letzter.gesperrt, 'gesperrt'],
					[e.letzter.freigegeben, 'wieder freigegeben'],
					[e.letzter.fehler, 'Fehler']
				].filter(([n], i) => i === 0 || Number(n) > 0)
			: []
	);
</script>

<svelte:head><title>System · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/verwaltung')}>← Verwaltung</a>
	<div class="kopf">
		<h1>System</h1>
		<button
			class="knopf zweit"
			type="button"
			disabled={laedt}
			onclick={async () => {
				laedt = true;
				await invalidateAll();
				laedt = false;
			}}
		>
			{laedt ? 'Lädt …' : 'Aktualisieren'}
		</button>
	</div>

	<section class="karte stapel" aria-labelledby="h-sicherung">
		<h2 id="h-sicherung">
			Sicherungen
			<Info
				thema="Sicherungen"
				text="Der Dienst „backup“ sichert täglich Datenbank und Dateien. Die Datenbank wird mit age verschlüsselt; den privaten Schlüssel gibt es nur außerhalb des Servers. Einmal pro Woche spielt er eine Sicherung probeweise in eine leere Datenbank ein. Ohne ENCRYPTION_KEY sind Sicherungen wertlos – bewahre ihn getrennt auf."
			/>
		</h2>
		{#if !b}
			<p class="meldung fehler">
				Sicherungen sind nicht eingerichtet. Starte den Dienst „backup“ aus der docker-compose.yml
				und setze BACKUP_AGE_RECIPIENTS in der .env.
			</p>
		{:else}
			{#if fehler.length}
				<ul class="befunde" role="alert">
					{#each fehler as f (f.text)}<li class="meldung fehler">{f.text}</li>{/each}
				</ul>
			{/if}
			{#if warnungen.length}
				<ul class="befunde">
					{#each warnungen as w (w.text)}<li class="meldung warnung">{w.text}</li>{/each}
				</ul>
			{/if}
			{#if !fehler.length && !warnungen.length}
				<p class="meldung" role="status">Alles in Ordnung.</p>
			{/if}

			<dl class="werte">
				<div>
					<dt>Letzte Sicherung</dt>
					<dd>
						{#if b.sicherung}
							{datum(b.sicherung.zeit)} · {b.sicherung.ok ? 'erfolgreich' : 'fehlgeschlagen'}
							· {dauer(b.sicherung.dauer_s)}
						{:else}–{/if}
					</dd>
				</div>
				{#if b.sicherung && !b.sicherung.ok && b.sicherung.erfolg_epoch}
					<div>
						<dt>Letzte erfolgreiche</dt>
						<dd>{datum(new Date(b.sicherung.erfolg_epoch * 1000))}</dd>
					</div>
				{/if}
				{#if b.sicherung}
					<div>
						<dt>Zeitplan</dt>
						<dd>
							täglich {b.sicherung.uhrzeit} Uhr · {b.sicherung.aufbewahrung_tage} Tage aufbewahrt
						</dd>
					</div>
					<div>
						<dt>Verschlüsselt für</dt>
						<dd>
							{b.sicherung.empfaenger} öffentliche{b.sicherung.empfaenger === 1 ? 'n' : ''} Schlüssel
							(age)
						</dd>
					</div>
				{/if}
				<div>
					<dt>Wiederherstellungstest</dt>
					<dd>
						{#if b.test}
							{datum(b.test.zeit)} · {b.test.ok ? 'bestanden' : 'fehlgeschlagen'}
							{#if b.test.ok}
								· {b.test.tabellen} Tabellen, {b.test.personen} Personen, {b.test.dateien} Dateien
							{/if}
						{:else}
							noch nicht gelaufen
						{/if}
					</dd>
				</div>
				{#if b.speicher}
					<div>
						<dt>Speicher für Sicherungen</dt>
						<dd>{groesse(b.speicher.frei)} frei von {groesse(b.speicher.gesamt)}</dd>
					</div>
				{/if}
			</dl>

			{#if b.liste.length}
				<details>
					<summary>Vorhandene Sicherungen ({b.liste.length})</summary>
					<div class="tabelle">
						<table>
							<thead>
								<tr>
									<th scope="col">Zeitpunkt</th>
									<th scope="col" class="zahl">Datenbank</th>
									<th scope="col" class="zahl">Dateien</th>
								</tr>
							</thead>
							<tbody>
								{#each b.liste as e (e.name)}
									<tr>
										<td>{datum(e.zeit)}</td>
										<td class="zahl">{groesse(e.db_bytes)}</td>
										<td class="zahl">{e.dateien} · {groesse(e.dateien_bytes)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<p class="hinweis">
						Unveränderte Dateien teilen sich den Platz zwischen den Sicherungen. Wiederherstellen
						beschreibt das Handbuch unter „Verwaltung“ und die Datei backup/README.md im Repo.
					</p>
				</details>
			{/if}
		{/if}
	</section>

	<section class="karte stapel" aria-labelledby="h-entra">
		<h2 id="h-entra">
			Abgleich mit Entra
			<Info
				thema="Abgleich mit Entra"
				text="Gleicht jede Nacht Name, E-Mail, Mandant und Rollen aller Microsoft-Konten ab. In Entra gelöschte oder deaktivierte Konten und Personen ohne Zugangsgruppe werden gesperrt; werden sie in Entra wieder gültig, gibt der Abgleich sie frei. Von der Verwaltung gesperrte Konten bleiben gesperrt. Würde der Abgleich mehr als 10 % der Konten sperren, hält er an."
			/>
		</h2>
		{#if !e.eingerichtet}
			<p class="hinweis">Die Anmeldung mit Microsoft ist nicht eingerichtet.</p>
		{:else}
			{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
			{#if e.laeuft}
				<p class="meldung" role="status">Der Abgleich läuft …</p>
			{:else if e.letzter && !e.letzter.ok}
				<p class={['meldung', e.letzter.angehalten ? 'warnung' : 'fehler']} role="alert">
					{e.letzter.meldung}
				</p>
			{:else if e.letzter?.meldung}
				<p class="meldung warnung">{e.letzter.meldung}</p>
			{/if}
			<dl class="werte">
				<div>
					<dt>Letzter Abgleich</dt>
					<dd>
						{#if e.letzter}
							{datum(e.letzter.zeit)} · {e.letzter.ok
								? 'erfolgreich'
								: e.letzter.angehalten
									? 'angehalten'
									: 'fehlgeschlagen'} · {e.letzter.ausgeloest === 'hand'
								? 'von Hand'
								: 'nach Zeitplan'}
						{:else}noch nicht gelaufen{/if}
					</dd>
				</div>
				{#if e.letzter && zahlen.length}
					<div>
						<dt>Ergebnis</dt>
						<dd>{zahlen.map(([n, t]) => `${n} ${t}`).join(' · ')}</dd>
					</div>
				{/if}
				<div>
					<dt>Zeitplan</dt>
					<dd>täglich ab {e.uhrzeit} Uhr</dd>
				</div>
			</dl>
			<div class="aktionen">
				<form method="POST" action="?/abgleichen" use:enhance>
					<button class="knopf zweit" type="submit" disabled={e.laeuft}>Jetzt abgleichen</button>
				</form>
				{#if e.letzter?.angehalten && !e.laeuft}
					<form method="POST" action="?/abgleichen" use:enhance>
						<input type="hidden" name="trotzdem" value="ja" />
						<button class="knopf gefahr" type="submit">
							Trotzdem abgleichen ({e.letzter.angehalten.sperren} Konten sperren)
						</button>
					</form>
				{/if}
			</div>
			<p class="hinweis">
				Gesperrte Konten stehen im <a href={resolve('/(app)/verwaltung/protokoll')}>Protokoll</a>.
			</p>
		{/if}
	</section>

	<section class="karte stapel" aria-labelledby="h-zustand">
		<h2 id="h-zustand">Zustand</h2>
		<dl class="werte">
			<div>
				<dt>Datenbank</dt>
				<dd>PostgreSQL {s.datenbank.version} · {groesse(s.datenbank.groesse)}</dd>
			</div>
			<div>
				<dt>Migrationen</dt>
				<dd class:warnung-text={!migrationenOk}>
					{s.datenbank.migrationen.eingespielt ?? '?'} von {s.datenbank.migrationen.vorhanden ??
						'?'}
					eingespielt
				</dd>
			</div>
			<div>
				<dt>Dateien</dt>
				<dd>
					{[
						`${s.dateien.anzahl}`,
						groesse(s.dateien.bytes),
						s.dateien.speicher ? `${groesse(s.dateien.speicher.frei)} frei` : null
					]
						.filter(Boolean)
						.join(' · ')}
				</dd>
			</div>
			<div>
				<dt>Aufräumen (stündlich)</dt>
				<dd class:warnung-text={s.aufgaben.aufraeumen && !s.aufgaben.aufraeumen.ok}>
					{#if s.aufgaben.aufraeumen}
						{datum(s.aufgaben.aufraeumen.at)} · {s.aufgaben.aufraeumen.ok
							? 'ohne Fehler'
							: `Fehler: ${s.aufgaben.aufraeumen.fehler}`}
					{:else}noch nicht gelaufen{/if}
				</dd>
			</div>
			<div>
				<dt>Benachrichtigungen (minütlich)</dt>
				<dd class:warnung-text={s.aufgaben.benachrichtigungen && !s.aufgaben.benachrichtigungen.ok}>
					{#if s.aufgaben.benachrichtigungen}
						{datum(s.aufgaben.benachrichtigungen.at)} · {s.aufgaben.benachrichtigungen.ok
							? 'ohne Fehler'
							: `Fehler: ${s.aufgaben.benachrichtigungen.fehler}`}
					{:else}noch nicht gelaufen{/if}
				</dd>
			</div>
		</dl>
		<h3>Anbindungen</h3>
		<ul class="anbindungen">
			{#each [['Microsoft Entra ID', s.anbindungen.entra], ['E-Mail', s.anbindungen.mail], ['Web Push', s.anbindungen.push], ['Sicherung', s.anbindungen.sicherung]] as const as [name, an] (name)}
				<li>
					<span class="punkt" class:an aria-hidden="true"></span>
					{name}: <strong>{an ? 'eingerichtet' : 'nicht eingerichtet'}</strong>
				</li>
			{/each}
		</ul>
	</section>

	<section class="karte stapel" aria-labelledby="h-version">
		<h2 id="h-version">Version</h2>
		<dl class="werte">
			<div>
				<dt>Intranet</dt>
				<dd>{s.version} · gebaut {gebaut}</dd>
			</div>
			<div>
				<dt>Node.js</dt>
				<dd>{s.node}</dd>
			</div>
			<div>
				<dt>Läuft seit</dt>
				<dd>{dauer(s.laufzeitS)}</dd>
			</div>
		</dl>
	</section>
</div>

<style>
	.seite {
		max-width: 52rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	h1,
	h2,
	h3 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	h3 {
		font-size: 1rem;
	}
	.befunde {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.werte {
		margin: 0;
		display: grid;
		gap: 10px;
	}
	.werte > div {
		display: grid;
		grid-template-columns: minmax(12rem, 16rem) 1fr;
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
	.warnung-text {
		color: var(--err-tx);
		font-weight: 600;
	}
	.tabelle {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		margin-top: 8px;
	}
	th,
	td {
		text-align: left;
		padding: 8px 6px;
		border-bottom: 1px solid var(--bd);
	}
	.zahl {
		text-align: right;
		white-space: nowrap;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.gefahr {
		background: #b42318;
		border-color: #b42318;
		color: #fff;
	}
	.anbindungen {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	.punkt {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-right: 6px;
		background: var(--bd);
	}
	.punkt.an {
		background: var(--ac);
	}
</style>
