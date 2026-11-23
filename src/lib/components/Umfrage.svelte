<script lang="ts">
	/**
	 * Umfrage im Beitrag (Kap. 8.16): beantworten, Ergebnis, „Wer sieht was?“
	 * und für das Team die Auswertung.
	 */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Icon from './Icon.svelte';
	import MitFrage from './MitFrage.svelte';
	import { formatWhen } from '#lib/news.ts';
	import {
		FRAGE_ARTEN,
		MAX_FREITEXT,
		STERNE_TEXT,
		TERMIN_WAHL,
		werSiehtWas,
		type Ergebnis,
		type ErgebnisAb,
		type FrageArt,
		type TerminWahl
	} from '#lib/umfrage.ts';

	interface Zeile {
		text: string;
		anzahl: number;
		anteil: number;
		vorne: boolean;
		zusatz?: string;
	}
	interface Daten {
		anonym: boolean;
		ergebnis: Ergebnis;
		ab: ErgebnisAb;
		endsAt: Date;
		beendet: boolean;
		team: boolean;
		teamText: string;
		teamNamen: string[];
		teilgenommen: boolean;
		teilnehmende: number;
		aenderbar: boolean;
		fragen: {
			id: string;
			art: FrageArt;
			text: string;
			pflicht: boolean;
			mehrfach: boolean;
			optionen: string[];
			meine: unknown;
		}[];
		ergebnisse:
			| {
					frageId: string;
					antworten: number;
					zeilen: Zeile[];
					schnitt: number | null;
					texte: { text: string; name: string | null }[] | null;
			  }[]
			| null;
	}

	let {
		u,
		newsId,
		fehlend = [],
		gesendet = false
	}: { u: Daten; newsId: string; fehlend?: string[]; gesendet?: boolean } = $props();

	let aendern = $state(false);
	let sendet = $state(false);
	const zeigeFormular = $derived(!u.beendet && (!u.teilgenommen || aendern));
	const erklaerung = $derived(
		werSiehtWas({
			anonym: u.anonym,
			ergebnis: u.ergebnis,
			ab: u.ab,
			team: u.teamText,
			ende: formatWhen(u.endsAt)
		})
	);
	const ergebnisVon = (id: string) => u.ergebnisse?.find((e) => e.frageId === id);
	const prozent = (a: number) => `${Math.round(a * 100)} %`;
	const hatAuswahl = (f: Daten['fragen'][number], i: number) =>
		Array.isArray(f.meine) && (f.meine as number[]).includes(i);
	const terminVon = (f: Daten['fragen'][number], k: number) =>
		Array.isArray(f.meine) ? ((f.meine as TerminWahl[])[k] ?? null) : null;
	const STERN =
		'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z';
	const anzahlFragen = $derived(
		u.fragen.length === 1 ? FRAGE_ARTEN[u.fragen[0].art] : `${u.fragen.length} Fragen`
	);
	const wannSichtbar = $derived(
		u.ergebnis === 'team'
			? `Das Ergebnis sieht nur ${u.teamText}.`
			: u.ab === 'ende'
				? `Das Ergebnis siehst du nach dem Ende (${formatWhen(u.endsAt)}).`
				: 'Das Ergebnis siehst du, sobald du geantwortet hast.'
	);
</script>

<section class="karte umfrage" aria-labelledby="umfrage-titel">
	<div class="kopf">
		<h2 id="umfrage-titel">Umfrage · {anzahlFragen}</h2>
		<div class="schilder">
			<span class="schild">{u.anonym ? 'Anonym' : 'Mit Namen'}</span>
			<span class="schild"
				>{u.ergebnis === 'team' ? `Ergebnis nur für ${u.teamText}` : 'Ergebnis für alle'}</span
			>
			<span class="schild" class:warn={u.beendet}
				>{u.beendet ? `Beendet ${formatWhen(u.endsAt)}` : `Bis ${formatWhen(u.endsAt)}`}</span
			>
		</div>
	</div>

	<details class="wersieht">
		<summary>Wer sieht was?</summary>
		<ul>
			{#each erklaerung as e (e.was)}<li><strong>{e.was}:</strong> {e.wer}</li>{/each}
		</ul>
		{#if u.teamNamen.length}
			<p class="hinweis">
				Zu {u.teamText} gehören: {u.teamNamen.join(', ')}. Verwaltung und zentrale Redaktion sehen
				Ergebnisse nur, wenn sie selbst dazugehören.
			</p>
		{/if}
	</details>

	{#if gesendet && !zeigeFormular}
		<p class="meldung ok" role="status">Danke, deine Antworten sind angekommen.</p>
	{/if}

	{#if zeigeFormular}
		<form
			method="POST"
			action="?/umfrage"
			class="fragen"
			novalidate
			use:enhance={() => {
				sendet = true;
				return async ({ update, result }) => {
					await update({ reset: false });
					sendet = false;
					if (result.type === 'success') aendern = false;
				};
			}}
		>
			{#each u.fragen as f, i (f.id)}
				{@const fehlt = fehlend.includes(f.id)}
				<fieldset
					class="frage"
					class:fehlt
					aria-describedby={fehlt ? `fehlt-${f.id}` : undefined}
				>
					<legend>
						<span class="nr">{i + 1}</span>
						<span>{f.text}{#if f.pflicht}<span class="pflicht">&nbsp;· Pflicht</span>{/if}</span>
					</legend>
					{#if fehlt}<p class="fehlertext" id="fehlt-{f.id}">Bitte beantworte diese Frage.</p>{/if}
					{#if f.art === 'auswahl'}
						{#if f.mehrfach}<p class="hinweis">Mehrere Antworten möglich.</p>{/if}
						{#each f.optionen as o, k (k)}
							<label class="wahl">
								<input
									type={f.mehrfach ? 'checkbox' : 'radio'}
									name="q-{f.id}"
									value={k}
									checked={hatAuswahl(f, k)}
								/>
								<span>{o}</span>
							</label>
						{/each}
					{:else if f.art === 'termin'}
						<div class="termine">
							{#each f.optionen as o, k (k)}
								<fieldset class="termin">
									<legend>{o}</legend>
									<div class="segmente">
										{#each Object.entries(TERMIN_WAHL) as [w, t] (w)}
											<label class="segment {w}">
												<input
													type="radio"
													name="q-{f.id}-{k}"
													value={w}
													checked={terminVon(f, k) === w}
												/>
												<span>{t}</span>
											</label>
										{/each}
									</div>
								</fieldset>
							{/each}
						</div>
					{:else if f.art === 'bewertung'}
						<div class="sterne">
							{#each [1, 2, 3, 4, 5] as n (n)}
								<label class="stern">
									<input type="radio" name="q-{f.id}" value={n} checked={f.meine === n} />
									<Icon d={STERN} size={30} stroke={1.75} />
									<span class="sr-only">{n} von 5: {STERNE_TEXT[n]}</span>
								</label>
							{/each}
						</div>
					{:else}
						<label class="sr-only" for="frei-{f.id}">Deine Antwort zu Frage {i + 1}</label>
						<textarea
							id="frei-{f.id}"
							name="q-{f.id}"
							maxlength={MAX_FREITEXT}
							rows="3"
							value={typeof f.meine === 'string' ? f.meine : ''}
						></textarea>
						<p class="hinweis">Höchstens {MAX_FREITEXT} Zeichen. Lesen kann das nur {u.teamText}.</p>
					{/if}
				</fieldset>
			{/each}
			<div class="aktionen">
				<button class="knopf" type="submit" disabled={sendet}>
					{u.teilgenommen ? 'Änderungen senden' : 'Antworten senden'}
				</button>
				{#if aendern}
					<button class="knopf zweit" type="button" onclick={() => (aendern = false)}
						>Abbrechen</button
					>
				{/if}
			</div>
			<p class="hinweis">
				{u.anonym
					? 'Anonym: Deine Antworten lassen sich danach nicht mehr ändern.'
					: 'Bis zum Ende kannst du deine Antworten noch ändern.'}
			</p>
		</form>
	{:else if u.teilgenommen && !u.beendet && u.aenderbar}
		<button class="knopf zweit" type="button" onclick={() => (aendern = true)}
			>Antworten ändern</button
		>
	{/if}

	{#if u.ergebnisse && (!zeigeFormular || u.team)}
		<div class="ergebnis">
			<h3>Ergebnis · {u.teilnehmende} {u.teilnehmende === 1 ? 'Teilnahme' : 'Teilnahmen'}</h3>
			{#each u.fragen as f, i (f.id)}
				{@const e = ergebnisVon(f.id)}
				{#if e}
					<div class="frage-ergebnis">
						<p class="frage-text"><span class="nr">{i + 1}</span>{f.text}</p>
						{#if f.art === 'freitext'}
							{#if e.texte}
								{#if e.texte.length}
									<ul class="texte">
										{#each e.texte as t, k (k)}
											<li>{t.text}{#if t.name}<span class="hinweis"> · {t.name}</span>{/if}</li>
										{/each}
									</ul>
								{:else}<p class="hinweis">Noch keine Antworten.</p>{/if}
							{:else}
								<p class="hinweis">
									{e.antworten}
									{e.antworten === 1 ? 'Antwort' : 'Antworten'}. Die Texte liest nur {u.teamText}.
								</p>
							{/if}
						{:else}
							{#if e.schnitt !== null}
								<p class="schnitt">
									Durchschnitt <strong>{e.schnitt.toFixed(1).replace('.', ',')}</strong> von 5
								</p>
							{/if}
							<ul class="balken">
								{#each e.zeilen as z (z.text)}
									<li class:vorne={z.vorne}>
										<span class="zeile">
											<span>{z.text}{#if f.art === 'termin'}<span class="hinweis"> · passt</span>{/if}</span>
											<span class="zahl"
												>{z.anzahl} · {prozent(z.anteil)}{#if z.zusatz}<span class="hinweis">
														· {z.zusatz}</span
													>{/if}</span
											>
										</span>
										<span class="spur" aria-hidden="true"
											><span class="fuellung" style:width={prozent(z.anteil)}></span></span
										>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	{:else if !u.ergebnisse && u.teilgenommen}
		<p class="hinweis">{wannSichtbar}</p>
	{/if}

	{#if u.team}
		<div class="auswertung">
			<h3>Auswertung für {u.teamText}</h3>
			<p class="hinweis">
				{u.teilnehmende}
				{u.teilnehmende === 1 ? 'Person hat' : 'Personen haben'} teilgenommen.
			</p>
			<div class="aktionen">
				<a
					class="knopf zweit"
					href={resolve('/(app)/neuigkeiten/[id]/umfrage.csv', { id: newsId })}
					download>Als CSV herunterladen</a
				>
				{#if !u.beendet}
					<MitFrage
						action="?/umfrageBeenden"
						knopf="Jetzt beenden"
						knopfKlasse="knopf zweit"
						frage={{
							titel: 'Umfrage jetzt beenden?',
							text: 'Danach kann niemand mehr antworten. Das Ergebnis bleibt erhalten.',
							ja: 'Beenden'
						}}
					/>
				{/if}
			</div>
		</div>
	{/if}
</section>

<style>
	.umfrage {
		display: grid;
		gap: 14px;
	}
	.kopf {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	h2 {
		margin: 0;
		font-size: 18px;
	}
	h3 {
		margin: 0;
		font-size: 16px;
	}
	.schilder {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.wersieht {
		border-radius: 12px;
		background: color-mix(in srgb, var(--tint) 60%, var(--sf));
		padding: 0 14px;
	}
	.wersieht summary {
		min-height: 44px;
		display: flex;
		align-items: center;
		font-weight: 600;
		cursor: pointer;
	}
	.wersieht ul {
		margin: 0 0 10px;
		padding-left: 18px;
		display: grid;
		gap: 4px;
		font-size: 14px;
	}
	.wersieht p {
		margin: 0 0 12px;
	}
	.fragen {
		display: grid;
		gap: 14px;
	}
	.frage {
		border: 1px solid var(--bd);
		border-radius: 12px;
		padding: 12px 14px;
		margin: 0;
		display: grid;
		gap: 6px;
		min-width: 0;
	}
	.frage.fehlt {
		border-color: var(--rot, #c62828);
		box-shadow: 0 0 0 1px var(--rot, #c62828);
	}
	.frage > legend {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		font-weight: 600;
		padding: 0 4px;
	}
	.nr {
		width: 24px;
		height: 24px;
		border-radius: 7px;
		background: var(--tint);
		color: var(--ac);
		font-size: 13px;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: none;
		margin-right: 8px;
	}
	.frage > legend .nr {
		margin-right: 0;
	}
	.pflicht {
		font-weight: 400;
		color: var(--mu);
		font-size: 14px;
	}
	.fehlertext {
		margin: 0;
		color: var(--rot, #c62828);
		font-weight: 600;
		font-size: 14px;
	}
	.wahl {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 0 10px;
		border-radius: 10px;
		cursor: pointer;
	}
	.wahl:hover {
		background: var(--tint);
	}
	.wahl input {
		width: 20px;
		height: 20px;
		margin: 0;
		accent-color: var(--fill);
		flex: none;
	}
	.termine {
		display: grid;
		gap: 10px;
	}
	.termin {
		border: 0;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 4px;
		min-width: 0;
	}
	.termin legend {
		font-size: 14px;
		font-weight: 600;
		padding: 0;
	}
	.segmente {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}
	.segment {
		position: relative;
	}
	.segment input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
	}
	.segment span {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		padding: 0 6px;
		text-align: center;
		border: 1px solid var(--bd);
		border-radius: 10px;
		font-size: 14px;
		cursor: pointer;
	}
	.segment input:focus-visible + span {
		outline: 3px solid var(--focus, #2f7de1);
		outline-offset: 2px;
	}
	.segment.ja input:checked + span {
		background: var(--fill);
		border-color: var(--fill);
		color: var(--on-fill, #fff);
	}
	.segment.vielleicht input:checked + span {
		background: var(--tint);
		border-color: var(--ac);
		color: var(--ac);
	}
	.segment.nein input:checked + span {
		background: var(--sf2, var(--tint));
		border-color: var(--mu);
		text-decoration: line-through;
	}
	.sterne {
		display: flex;
		gap: 2px;
	}
	.stern {
		position: relative;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--mu);
		cursor: pointer;
	}
	.stern input {
		position: absolute;
		opacity: 0;
		inset: 0;
		margin: 0;
		cursor: pointer;
	}
	/* Gewählter Stern und alle davor gefüllt */
	.sterne:has(input:checked) .stern {
		color: var(--warn, #b7791f);
	}
	.sterne .stern:has(input:checked) ~ .stern {
		color: var(--mu);
	}
	.sterne:has(input:checked) .stern :global(svg) {
		fill: currentColor;
	}
	.sterne .stern:has(input:checked) ~ .stern :global(svg) {
		fill: none;
	}
	.stern:has(input:focus-visible) {
		outline: 3px solid var(--focus, #2f7de1);
		border-radius: 8px;
	}
	textarea {
		width: 100%;
		box-sizing: border-box;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.fragen > .hinweis {
		margin: 0;
	}
	.ergebnis,
	.auswertung {
		display: grid;
		gap: 12px;
		border-top: 1px solid var(--bd);
		padding-top: 14px;
	}
	.auswertung p {
		margin: 0;
	}
	.frage-ergebnis {
		display: grid;
		gap: 6px;
	}
	.frage-text {
		margin: 0;
		font-weight: 600;
		display: flex;
		align-items: flex-start;
	}
	.schnitt {
		margin: 0;
	}
	.balken {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.zeile {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		font-size: 14px;
	}
	.zahl {
		white-space: nowrap;
		color: var(--mu);
	}
	.vorne .zeile {
		font-weight: 700;
	}
	.spur {
		display: block;
		height: 8px;
		border-radius: 99px;
		background: var(--tint);
		overflow: hidden;
		margin-top: 3px;
	}
	.fuellung {
		display: block;
		height: 100%;
		border-radius: 99px;
		background: color-mix(in srgb, var(--fill) 55%, var(--sf));
	}
	.vorne .fuellung {
		background: var(--fill);
	}
	.texte {
		margin: 0;
		padding-left: 18px;
		display: grid;
		gap: 6px;
		font-size: 15px;
	}
	@media (max-width: 480px) {
		.zeile {
			flex-direction: column;
			gap: 0;
		}
	}
</style>
