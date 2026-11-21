<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */

	let { data } = $props();
	const zeit = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Europe/Berlin'
	});
	const weiter = $derived(
		data.mehr
			? `?${new URLSearchParams({
					tage: String(data.filter.tage),
					art: data.filter.art,
					person: data.filter.person,
					vor: data.mehr
				})}`
			: null
	);
</script>

<svelte:head><title>Protokoll · Verwaltung · Intranet</title></svelte:head>

<div class="stapel">
	<div>
		<h1>Protokoll</h1>
		<p class="hinweis">
			{data.system
				? 'Alle Änderungen in der Verwaltung und das Anmeldeprotokoll.'
				: 'Änderungen in der Verwaltung deines Mandanten.'} Ohne Inhalte von Beiträgen.
		</p>
	</div>

	<form method="GET" class="karte filter">
		{#if data.system}
			<label class="feld">
				<span>Art</span>
				<select name="art" value={data.filter.art}>
					<option value="admin">Verwaltung</option>
					<option value="security">Anmeldungen</option>
				</select>
			</label>
		{/if}
		<label class="feld">
			<span>Zeitraum</span>
			<select name="tage" value={String(data.filter.tage)}>
				{#each data.zeitraeume as t (t)}<option value={String(t)}>letzte {t} Tage</option>{/each}
			</select>
		</label>
		<label class="feld breit">
			<span>Person</span>
			<input name="person" type="search" value={data.filter.person} maxlength="60" />
		</label>
		<button class="knopf" type="submit">Anzeigen</button>
	</form>

	{#if data.eintraege.length === 0}
		<p class="karte hinweis">Keine Einträge im gewählten Zeitraum.</p>
	{:else}
		<!-- Bei schmalem Bildschirm waagerecht scrollbar, darum per Tastatur erreichbar -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div class="karte tabelle-rahmen" tabindex="0" role="region" aria-label="Protokolleinträge">
			<table>
				<thead>
					<tr>
						<th scope="col">Wann</th>
						<th scope="col">Wer</th>
						<th scope="col">Was</th>
						<th scope="col">Einzelheiten</th>
					</tr>
				</thead>
				<tbody>
					{#each data.eintraege as e (e.id)}
						<tr>
							<td class="nowrap">{zeit.format(e.at)}</td>
							<td>{e.wer}{e.mandant ? ` · ${e.mandant}` : ''}</td>
							<td title={e.aktion}>{e.was}</td>
							<td class="details">{e.details}{e.ip ? ` · IP ${e.ip}` : ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if weiter}<a class="knopf zweit" href={weiter}>Ältere Einträge</a>{/if}
	{/if}
</div>

<style>
	h1 {
		margin: 0;
	}
	.filter {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: flex-end;
	}
	.breit {
		flex: 1 1 220px;
	}
	.tabelle-rahmen {
		overflow-x: auto;
		padding: 0;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 14px;
	}
	th,
	td {
		text-align: left;
		padding: 10px 14px;
		border-bottom: 1px solid var(--bd);
		vertical-align: top;
	}
	th {
		font-size: 13px;
		color: var(--mu);
	}
	tbody tr:last-child td {
		border-bottom: 0;
	}
	.nowrap {
		white-space: nowrap;
	}
	.details {
		color: var(--mu);
		overflow-wrap: anywhere;
	}
	.knopf.zweit {
		justify-self: start;
	}
	/* Handy: jeder Eintrag als Block statt Tabelle (sonst sehr schmale Spalten) */
	@media (max-width: 599px) {
		table,
		tbody,
		tr,
		td {
			display: block;
		}
		thead {
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(50%);
		}
		tr {
			padding: 10px 0;
			border-bottom: 1px solid var(--bd);
		}
		tbody tr:last-child {
			border-bottom: 0;
		}
		td {
			padding: 2px 14px;
			border: 0;
		}
		td.nowrap {
			font-size: 13px;
			color: var(--mu);
		}
	}
</style>
