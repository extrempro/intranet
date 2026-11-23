<script lang="ts">
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
			.filter(([k]) => (hub ? k !== 'kulissen' : k !== 'dokumente'))
			// Umfragen nur, wenn für die Einheit freigeschaltet
			.filter(([k]) => k !== 'umfragen' || e.surveys) as [
			string,
			string,
			keyof (typeof e.team)[number]
		][]
	);
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

	<form method="POST" action="?/hinzufuegen" class="hinzu" use:enhance>
		<label class="feld">
			<span>Person hinzufügen (E-Mail-Adresse)</span>
			<input name="email" type="email" required autocomplete="off" />
		</label>
		<button class="knopf zweit" type="submit">Hinzufügen</button>
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
							{#if hub}<input type="hidden" name="dokumente_feld" value="1" />{/if}
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
							<label class="option">
								<input type="checkbox" name="primaer" checked={m.isPrimary} />
								Eigene Abteilung der Person
							</label>
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
	.hinzu {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: flex-end;
	}
	.hinzu .feld {
		flex: 1 1 260px;
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
</style>
