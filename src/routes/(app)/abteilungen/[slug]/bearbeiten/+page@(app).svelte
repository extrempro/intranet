<script lang="ts">
	import PersonSuche from '#lib/components/PersonSuche.svelte';
	import SeitenGestaltung from '#lib/components/abteilung/SeitenGestaltung.svelte';
	import MitFrage from '#lib/components/MitFrage.svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '$app/forms';
	import ZustaendigkeitFormular from '#lib/components/ZustaendigkeitFormular.svelte';
	import { linksToText, type ResponsibilityErrors } from '#lib/departments.ts';
	import { untrack } from 'svelte';
	import EinfuehrungAngebot from '#lib/components/EinfuehrungAngebot.svelte';
	import EinfuehrungKnopf from '#lib/components/EinfuehrungKnopf.svelte';
	import { ROLLEN } from '#lib/tours.ts';

	let { data, form } = $props();
	const e = $derived(data.einheit);
	const behalten: SubmitFunction =
		() =>
		async ({ update }) =>
			update({ reset: false });

	let seite = $state(
		untrack(() => ({
			about: data.einheit.about,
			tagline: data.einheit.tagline,
			email: data.einheit.contactEmail,
			phone: data.einheit.contactPhone,
			hours: data.einheit.officeHours,
			room: data.einheit.room,
			lead: data.einheit.leadPersonId ?? '',
			second: data.einheit.secondLeadPersonId ?? '',
			deputy: data.einheit.deputyPersonId ?? ''
		}))
	);

	// Nur beim Laden: danach bleibt offen, was die Person aufgeklappt hat
	const leerAmAnfang = untrack(() => data.einheit.zustaendigkeiten.length === 0);
	const aktiveTeam = $derived(e.team.filter((m) => !m.disabled));
	const gruppen = $derived(
		[...new Set(e.zustaendigkeiten.map((z) => z.groupName).filter(Boolean))].sort()
	);
	const rechte = $derived(
		(
			[
				['neuigkeiten', 'Neuigkeiten', 'mayWriteNews'],
				['faqs', 'FAQs', 'mayWriteFaqs'],
				['termine', 'Termine', 'mayWriteEvents'],
				['kulissen', 'Hinter den Kulissen', 'mayWriteBehindScenes'],
				['dokumente', 'Dokumente', 'mayWriteDocuments'],
				['mediathek', 'Mediathek', 'mayWriteMedia'],
				['umfragen', 'Umfragen', 'mayWriteSurveys']
			] as const
		).filter(([k]) => k !== 'umfragen' || e.umfragenFrei)
	);

	const fehlerFuer = (id: string): ResponsibilityErrors =>
		form && 'eintrag' in form && form.eintrag === id && 'felder' in form
			? (form.felder as ResponsibilityErrors)
			: {};
	let neuZaehler = $state(0);
	const neuAngelegt: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') neuZaehler++;
		};
	let hinzuForm = $state<HTMLFormElement>();
	let hinzuId = $state('');
</script>

<svelte:head><title>{e.name} bearbeiten · Intranet</title></svelte:head>

<div class="stapel seite">
	<EinfuehrungAngebot
		tour={ROLLEN.abteilungsverwaltung}
		text="Du pflegst diese Abteilung. Eine kurze Einführung zeigt dir, was du hier einstellen kannst."
	/>
	<a class="zurueck" href={resolve('/(app)/abteilungen/[slug]', { slug: e.slug })}> ← Zur Seite </a>
	<div>
		<h1 class="mit-hilfe">
			{e.name} bearbeiten <EinfuehrungKnopf tour={ROLLEN.abteilungsverwaltung} />
		</h1>
		<p class="hinweis">{e.label}</p>
	</div>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}

	<details class="karte" open data-tour="seite">
		<summary><h2>Seite</h2></summary>
		<form method="POST" action="?/seite" class="stapel" use:enhance={behalten}>
			<div class="zwei">
				<label class="feld">
					<span>Leitung</span>
					<select name="leitung" bind:value={seite.lead}>
						<option value="">Keine</option>
						{#each aktiveTeam as m (m.personId)}<option value={m.personId}>{m.name}</option>{/each}
					</select>
				</label>
				<label class="feld">
					<span>Zweite Leitung (Doppelspitze)</span>
					<select name="zweite" bind:value={seite.second}>
						<option value="">Keine</option>
						{#each aktiveTeam as m (m.personId)}<option value={m.personId}>{m.name}</option>{/each}
					</select>
				</label>
				<label class="feld">
					<span>Stellvertretung</span>
					<select name="stellvertretung" bind:value={seite.deputy}>
						<option value="">Keine</option>
						{#each aktiveTeam as m (m.personId)}<option value={m.personId}>{m.name}</option>{/each}
					</select>
				</label>
			</div>
			<p class="hinweis">Zur Auswahl stehen Personen aus dem Team.</p>
			<label class="feld">
				<span>Kurzbeschreibung</span>
				<input
					name="kurz"
					maxlength="120"
					bind:value={seite.tagline}
					placeholder="z. B. Verträge, Abwesenheiten, Gehalt"
				/>
				<span class="hinweis">Eine Zeile unter dem Namen, auch in der Abteilungsliste.</span>
			</label>
			<fieldset class="kontaktfelder">
				<legend>Kontakt im Kopf der Seite (alles freiwillig)</legend>
				<div class="zwei">
					<label class="feld">
						<span>Funktionsadresse</span>
						<input
							name="funktionsadresse"
							type="email"
							maxlength="254"
							bind:value={seite.email}
							placeholder="z. B. personal@…"
						/>
					</label>
					<label class="feld">
						<span>Telefon</span>
						<input name="telefon" type="tel" maxlength="40" bind:value={seite.phone} />
					</label>
					<label class="feld">
						<span>Sprechzeiten</span>
						<input
							name="sprechzeiten"
							maxlength="120"
							bind:value={seite.hours}
							placeholder="z. B. Mo–Do 9–12 Uhr"
						/>
					</label>
					<label class="feld">
						<span>Raum</span>
						<input
							name="raum"
							maxlength="60"
							bind:value={seite.room}
							placeholder="z. B. 3.14, Haus B"
						/>
					</label>
				</div>
			</fieldset>
			<label class="feld">
				<span>Über uns</span>
				<textarea name="ueber" rows="6" maxlength="3000" bind:value={seite.about}></textarea>
			</label>
			<button class="knopf" type="submit">Seite speichern</button>
		</form>
	</details>

	<details class="karte" open={leerAmAnfang || undefined} data-tour="zustaendigkeiten">
		<summary><h2>Wer hilft bei was? ({e.zustaendigkeiten.length})</h2></summary>
		<div class="stapel">
			<div class="pruefzeile">
				<p class="hinweis">
					Ist eine Ansprechperson inaktiv, zeigt die Seite automatisch die Vertretung. Nach der
					eingestellten Frist (Standard 12 Monate) erinnert dich das Intranet, alles zu prüfen.
				</p>
				{#if e.zustaendigkeiten.length}
					<form method="POST" action="?/geprueft" use:enhance>
						<button class="knopf zweit klein" type="submit">Alles geprüft</button>
					</form>
				{/if}
			</div>

			{#each e.zustaendigkeiten as z, i (z.id)}
				<details
					class="eintrag"
					open={(form && 'eintrag' in form && form.eintrag === z.id && 'fehler' in form) ||
						undefined}
				>
					<summary>
						<span>
							<strong>{z.topic}</strong>
							<span class="hinweis">
								· {z.personName ?? 'ohne Person'}{z.groupName ? ` · ${z.groupName}` : ''}
							</span>
							{#if z.personInaktiv}<span class="schild warnung">Person inaktiv</span>{/if}
							{#if z.deputyInaktiv}<span class="schild warnung">Vertretung inaktiv</span>{/if}
						</span>
					</summary>
					<form method="POST" action="?/zspeichern" class="stapel" use:enhance={behalten}>
						<input type="hidden" name="id" value={z.id} />
						<ZustaendigkeitFormular
							praefix="z{i}"
							team={e.team}
							{gruppen}
							fehler={fehlerFuer(z.id)}
							werte={{
								topic: z.topic,
								description: z.description,
								keywords: z.keywords.join(', '),
								groupName: z.groupName,
								personId: z.personId ?? '',
								deputyId: z.deputyId ?? '',
								links: linksToText(z.links)
							}}
						/>
						<div class="aktionen">
							<button class="knopf" type="submit">Speichern</button>
							<button
								class="knopf zweit klein"
								type="submit"
								formaction="?/zverschieben"
								name="richtung"
								value="hoch"
								disabled={i === 0}
								aria-label="{z.topic} nach oben"
							>
								↑
							</button>
							<button
								class="knopf zweit klein"
								type="submit"
								formaction="?/zverschieben"
								name="richtung"
								value="runter"
								disabled={i === e.zustaendigkeiten.length - 1}
								aria-label="{z.topic} nach unten"
							>
								↓
							</button>
							<button class="linkknopf" type="submit" formaction="?/zloeschen">Löschen</button>
						</div>
					</form>
				</details>
			{/each}

			<details class="eintrag neu" open={leerAmAnfang || undefined}>
				<summary><strong>Neue Zuständigkeit</strong></summary>
				{#if aktiveTeam.length === 0}
					<p class="hinweis">Füge zuerst Personen zum Team hinzu.</p>
				{:else}
					{#key neuZaehler}
						<form method="POST" action="?/zneu" class="stapel" use:enhance={neuAngelegt}>
							<ZustaendigkeitFormular
								praefix="neu"
								team={aktiveTeam}
								{gruppen}
								fehler={fehlerFuer('neu')}
								werte={{
									topic: '',
									description: '',
									keywords: '',
									groupName: '',
									personId: '',
									deputyId: '',
									links: ''
								}}
							/>
							<button class="knopf" type="submit">Anlegen</button>
						</form>
					{/key}
				{/if}
			</details>
		</div>
	</details>

	<details class="karte" data-tour="team">
		<summary><h2>Team und Schreibrechte ({e.team.length})</h2></summary>
		<div class="stapel">
			<p class="hinweis">
				Schreibrechte vergibst du je Person. Höchstens {e.maxSchreibende} Personen mit Schreibrecht; die
				Abteilungsverwaltung zählt nicht mit und darf immer alles. Die Abteilungsverwaltung selbst vergibt
				die Verwaltung.
			</p>
			<form
				method="POST"
				action="?/hinzufuegen"
				class="hinzu-suche"
				bind:this={hinzuForm}
				use:enhance
			>
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
			<ul class="team">
				{#each e.team as m (m.personId)}
					<li>
						<form method="POST" action="?/rechte" use:enhance={behalten}>
							<input type="hidden" name="person" value={m.personId} />
							{#if m.verwaltet}<input type="hidden" name="verwaltet" value="on" />{/if}
							<div>
								<strong>{m.name}</strong>
								{#if m.verwaltet}<span class="schild">Abteilungsverwaltung</span>{/if}
								{#if m.disabled}<span class="schild warnung">inaktiv</span>{/if}
								<br /><span class="hinweis">{m.email}</span>
							</div>
							<fieldset>
								<legend class="sr-only">Rechte von {m.name}</legend>
								{#if m.verwaltet}
									<p class="hinweis">Darf als Abteilungsverwaltung alles.</p>
								{:else}
									{#each rechte as [name, text, key] (name)}
										<label class="option">
											<input type="checkbox" {name} checked={m[key]} />
											{text}
										</label>
									{/each}
								{/if}
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
							</fieldset>
							<div class="aktionen">
								<button class="knopf zweit klein" type="submit">Rechte speichern</button>
								{#if !m.verwaltet || e.isAdmin}
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
								{/if}
							</div>
						</form>
					</li>
				{/each}
			</ul>
		</div>
	</details>

	<details
		class="karte"
		id="gestaltung"
		open={(form && 'bereich' in form && form.bereich === 'gestaltung') ||
			['#gestaltung', '#dokumente'].includes(page.url.hash) ||
			undefined}
	>
		<summary><h2>Aufbau, Schnellzugriff und Dokumente</h2></summary>
		{#key e.links.length + e.dokumente.length}
			<SeitenGestaltung
				einheit={e}
				meldung={form && 'bereich' in form && form.bereich === 'gestaltung'
					? (form as { fehler?: string; ok?: string })
					: null}
			/>
		{/key}
	</details>

	<details class="karte">
		<summary><h2>Hinter den Kulissen</h2></summary>
		<form method="POST" action="?/kulissen" class="stapel" use:enhance>
			<p class="hinweis">
				{e.behindScenes
					? 'Freigeschaltet: Personen mit dem Schreibrecht „Hinter den Kulissen“ können Einblicke teilen.'
					: 'Noch nicht freigeschaltet. Danach vergibst du das Schreibrecht je Person im Team.'}
			</p>
			<input type="hidden" name="an" value={e.behindScenes ? 'nein' : 'ja'} />
			<button class="knopf zweit" type="submit">
				{e.behindScenes ? 'Ausschalten' : 'Freischalten'}
			</button>
		</form>
	</details>
</div>

<style>
	.kontaktfelder {
		border: 1px solid var(--bd);
		border-radius: var(--radius);
		padding: 10px 16px 14px;
		margin: 0;
	}
	.kontaktfelder legend {
		font-weight: 600;
	}
	.seite {
		max-width: 52rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
		display: inline;
	}
	summary {
		min-height: 44px;
		display: flex;
		align-items: center;
		cursor: pointer;
	}
	details[open] > summary {
		margin-bottom: 12px;
	}
	.zwei {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
		gap: 12px;
	}
	.pruefzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
	}
	.pruefzeile .hinweis {
		margin: 0;
		flex: 1 1 280px;
	}
	.eintrag {
		border-top: 1px solid var(--bd);
		padding-top: 4px;
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
	}
	.team li {
		padding: 12px 0;
		border-top: 1px solid var(--bd);
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 8px 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
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
	.klein {
		min-height: 38px;
		padding: 6px 12px;
		font-size: 14px;
	}
	.schild.warnung {
		background: #fcebeb;
		color: #b42318;
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
