<script lang="ts">
	import PersonSuche from '#lib/components/PersonSuche.svelte';
	import MitFrage from '#lib/components/MitFrage.svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import EinheitFelder from '#lib/components/EinheitFelder.svelte';
	import { unitTypeLabel } from '#lib/roles.ts';

	let { data, form } = $props();
	const e = $derived(data.einheit);
	const hub = $derived(e.type === 'hub');
	const rechte = $derived(
		[
			['neuigkeiten', 'Neuigkeiten', 'mayWriteNews'],
			['faqs', 'FAQs', 'mayWriteFaqs'],
			['termine', 'Termine', 'mayWriteEvents'],
			['kulissen', 'Hinter den Kulissen', 'mayWriteBehindScenes'],
			['dokumente', 'Dokumente', 'mayWriteDocuments'],
			['mediathek', 'Mediathek', 'mayWriteMedia'],
			['umfragen', 'Umfragen', 'mayWriteSurveys']
		]
			.filter(([k]) => !hub || k !== 'kulissen')
			// Umfragen nur, wenn für die Einheit freigeschaltet
			.filter(([k]) => k !== 'umfragen' || e.surveys) as [
			string,
			string,
			keyof (typeof e.team)[number]
		][]
	);
	let hinzuForm = $state<HTMLFormElement>();
	let hinzuId = $state('');
</script>

<svelte:head><title>{e.name} · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<a href={resolve('/(app)/verwaltung/abteilungen')} class="zurueck">← Abteilungen und Hubs</a>
	<h1>{e.name}</h1>
	<p class="hinweis">
		{unitTypeLabel(e)} · {e.isCentral ? 'Zentral, für alle Mandanten' : e.tenantName}
		·
		{#if hub}
			<a href={resolve('/(app)/hubs/[slug]', { slug: e.slug })}>Zur Hub-Seite</a>
		{:else}
			<a href={resolve('/(app)/abteilungen/[slug]', { slug: e.slug })}>Zur Abteilungsseite</a>
		{/if}
	</p>

	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form?.gespeichert}<p class="meldung" role="status">Gespeichert.</p>{/if}

	<details class="karte">
		<summary><strong>Angaben bearbeiten</strong></summary>
		<form
			method="POST"
			action="?/speichern"
			class="felder"
			use:enhance={() =>
				async ({ update }) =>
					update({ reset: false })}
		>
			<EinheitFelder
				werte={{ ...e, tenantId: e.tenantId }}
				mandanten={data.mandanten}
				neu={false}
			/>
			<button class="knopf" type="submit">Speichern</button>
		</form>
	</details>

	<h2>Team und Rechte</h2>
	<p class="hinweis">
		Wer {hub ? 'im Hub-Team ist' : 'die Einheit verwaltet'}, darf immer alles und zählt nicht zur
		Höchstzahl von
		{data.maxSchreibende} Personen mit Schreibrecht.
	</p>

	<form method="POST" action="?/hinzufuegen" class="hinzu-suche" bind:this={hinzuForm} use:enhance>
		<input type="hidden" name="person" value={hinzuId} />
		<span class="feld-titel" id="hinzu-titel">Person hinzufügen</span>
		<PersonSuche
			quelle={resolve('/(app)/einheiten/[id]/personen', { id: e.id })}
			beschriftung="Name oder E-Mail-Adresse"
			ausschliessen={e.team.map((m) => m.personId)}
			onwahl={(t) => {
				hinzuId = t.id;
				queueMicrotask(() => hinzuForm?.requestSubmit());
			}}
		/>
		<p class="hinweis">
			Findet Personen im Intranet und aus Entra. Wer sich noch nie angemeldet hat, bekommt sein
			Konto gleich beim Hinzufügen.
		</p>
	</form>

	{#if e.team.length === 0}
		<p class="hinweis">Noch niemand im Team.</p>
	{:else}
		<ul class="team">
			{#each e.team as m (m.personId)}
				<li class="karte">
					<form
						method="POST"
						action="?/rechte"
						use:enhance={() =>
							async ({ update }) =>
								update({ reset: false })}
					>
						<input type="hidden" name="person" value={m.personId} />
						<div class="kopf">
							<div><strong>{m.name}</strong><br /><span class="hinweis">{m.email}</span></div>
						</div>
						<fieldset>
							<legend class="sr-only">Rechte von {m.name}</legend>
							<label class="option">
								<input
									type="checkbox"
									name="verwaltet"
									checked={m.verwaltet}
									disabled={m.ausEntra}
								/>
								{hub ? 'Hub-Team' : 'Abteilungsverwaltung'}{#if m.ausEntra}<span
										class="schild rand"
									>
										aus Entra
									</span>{/if}
							</label>
							{#if m.ausEntra}<input type="hidden" name="verwaltet" value="on" />{/if}
							{#each rechte as [name, text, key] (name)}
								<label class="option">
									<input type="checkbox" {name} checked={Boolean(m[key])} />
									{text}
								</label>
							{/each}
							{#if e.isKbb}
								<input type="hidden" name="fachpflege_feld" value="1" />
								<label class="option">
									<input
										type="checkbox"
										name="fachpflege"
										checked={m.fachpflege}
										disabled={m.fachpflegeAusEntra}
									/>
									Fachpflege (Pläne){#if m.fachpflegeAusEntra}<span class="schild rand">
											aus Entra
										</span>{/if}
								</label>
								{#if m.fachpflegeAusEntra}<input type="hidden" name="fachpflege" value="on" />{/if}
							{/if}
							<!-- Hubs sind nie Stammabteilung -->
							{#if !hub}
								<label class="option">
									<input type="checkbox" name="primaer" checked={m.isPrimary} />
									<span class="stamm">
										<strong>Stammabteilung</strong>
										<span class="hinweis">
											Wird im Personenverzeichnis und im Profil als Abteilung der Person angezeigt.
											Jede Person hat nur eine.
										</span>
									</span>
								</label>
							{/if}
						</fieldset>
						<div class="aktionen">
							<button class="knopf zweit" type="submit">Rechte speichern</button>
							<MitFrage
								action="?/entfernen"
								imFormular
								knopf="Aus dem Team entfernen"
								frage={{
									titel: `${m.name} aus dem Team entfernen?`,
									text: 'Die Person verliert ihre Rechte in dieser Einheit sofort.',
									ja: 'Entfernen',
									gefahr: true
								}}
							/>
						</div>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.seite {
		max-width: 48rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	summary {
		min-height: 44px;
		display: flex;
		align-items: center;
		cursor: pointer;
	}
	details[open] summary {
		margin-bottom: 12px;
	}
	.hinzu-suche {
		display: grid;
		gap: 6px;
	}
	.hinzu-suche .hinweis {
		margin: 0;
	}
	.feld-titel {
		font-weight: 600;
		font-size: 14px;
	}
	.team {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 12px;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 8px 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
	}
	.option {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
	}
	.option input {
		width: 20px;
		height: 20px;
		flex: none;
		accent-color: var(--fill);
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.knopf {
		justify-self: start;
	}
	.stamm {
		display: grid;
		gap: 2px;
		max-width: 60ch;
	}
	/* Haken oben neben der Überschrift, Zeile über die ganze Breite */
	.option:has(.stamm) {
		grid-column: 1 / -1;
		align-items: flex-start;
	}
	.option:has(.stamm) input {
		margin-top: 1px;
	}
	.stamm .hinweis {
		font-size: 13px;
	}
</style>
