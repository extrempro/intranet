<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Info from '#lib/components/Info.svelte';
	import { groesse } from '#lib/system-status.ts';

	let { data } = $props();
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
			<div>
				<dt>Erkannte Adresse</dt>
				<dd class:warnung-text={!data.client.header}>
					{data.client.adresse ?? 'nicht lesbar'}
					{#if data.client.header}
						· aus {data.client.header}
					{:else}
						· ADDRESS_HEADER nicht gesetzt: vermutlich die Adresse des Reverse Proxys. Dann gelten
						Begrenzungen je IP für alle gemeinsam (siehe .env.example).
					{/if}
				</dd>
			</div>
			<div>
				<dt>Abgleich mit Entra</dt>
				<dd class:warnung-text={e.letzter && !e.letzter.ok}>
					{#if !e.eingerichtet}nicht eingerichtet{:else if e.letzter}
						{datum(e.letzter.zeit)} · {e.letzter.ok
							? 'erfolgreich'
							: e.letzter.angehalten
								? 'angehalten'
								: 'fehlgeschlagen'}
					{:else}noch nicht gelaufen{/if}
					· <a href={resolve('/(app)/verwaltung/anmeldung')}>Anmeldung</a>
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
