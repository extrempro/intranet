<script lang="ts">
	/**
	 * Umfrage im Beitragsformular (Kap. 8.18): Fragen anlegen, sortieren,
	 * Einstellungen für die ganze Umfrage und „Wer sieht was?“. Der Wert geht
	 * als JSON im Feld `umfrage` mit; nach der ersten Antwort sind Fragen und
	 * „Anonym“ gesperrt.
	 */
	import { untrack } from 'svelte';
	import Icon from './Icon.svelte';
	import {
		FRAGE_ARTEN,
		leereFrage,
		MAX_FRAGEN,
		MAX_OPTIONEN,
		teamText,
		werSiehtWas,
		type FrageArt,
		type UmfrageEingabe
	} from '#lib/umfrage.ts';

	let {
		json,
		einheit,
		gesperrt = false,
		fehler = ''
	}: {
		/** Wert aus dem Formular (JSON oder leer) */
		json: string;
		einheit: string;
		gesperrt?: boolean;
		fehler?: string;
	} = $props();

	function inEinerWoche() {
		const d = new Date(Date.now() + 7 * 86400000);
		const z = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T12:00`;
	}
	function start(): UmfrageEingabe | null {
		try {
			const w = json ? JSON.parse(json) : null;
			return w && Array.isArray(w.fragen) ? w : null;
		} catch {
			return null;
		}
	}
	let u = $state<UmfrageEingabe | null>(untrack(start));
	const wert = $derived(u ? JSON.stringify(u) : 'null');

	function anlegen() {
		u = {
			anonym: true,
			ergebnis: 'alle',
			ab: 'antwort',
			ende: inEinerWoche(),
			fragen: [leereFrage('auswahl')]
		};
	}
	function neueFrage(art: FrageArt) {
		if (!u || u.fragen.length >= MAX_FRAGEN) return;
		u.fragen.push(leereFrage(art));
		ansage = `${FRAGE_ARTEN[art]} als Frage ${u.fragen.length} hinzugefügt.`;
	}
	function schieben(i: number, d: number) {
		if (!u) return;
		const [f] = u.fragen.splice(i, 1);
		u.fragen.splice(i + d, 0, f);
		ansage = `Frage ${i + 1} ist jetzt Frage ${i + d + 1}.`;
	}
	let ansage = $state('');

	const team = $derived(teamText(einheit));
	const erklaerung = $derived(
		u
			? werSiehtWas({
					anonym: u.anonym,
					ergebnis: u.ergebnis,
					ab: u.ab,
					team,
					ende: u.ende.replace('T', ', ')
				})
			: []
	);
	const PFEIL_HOCH = 'M6 15l6 -6l6 6';
	const PFEIL_RUNTER = 'M6 9l6 6l6 -6';
	const MUELL = 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12M9 7v-3h6v3';
	const ARTEN = Object.entries(FRAGE_ARTEN) as [FrageArt, string][];
</script>

<input type="hidden" name="umfrage" value={wert} />

<fieldset class="gruppe umfrage">
	<legend>Umfrage</legend>
	{#if fehler}<p class="meldung fehler" role="alert">{fehler}</p>{/if}
	{#if !u}
		<p class="hinweis">
			Hängt eine Umfrage an den Beitrag: Auswahl, Terminfindung, Bewertung oder Freitext, auch
			mehrere Fragen.
		</p>
		<button type="button" class="knopf zweit" onclick={anlegen}>
			<Icon d="M12 5v14M5 12h14" size={18} stroke={2} />Umfrage hinzufügen
		</button>
	{:else}
		{#if gesperrt}
			<p class="meldung" role="status">
				Die Umfrage hat schon Antworten. Fragen, Reihenfolge und „Anonym“ lassen sich nicht mehr
				ändern, damit die Ergebnisse vergleichbar bleiben. Ende und Sichtbarkeit schon.
			</p>
		{/if}
		<ol class="fragen">
			{#each u.fragen as f, i (f)}
				<li class="frage">
					<div class="fragekopf">
						<span class="nr">{i + 1}</span>
						<span class="art">{FRAGE_ARTEN[f.art]}</span>
						{#if !gesperrt}
							<button
								type="button"
								class="klein"
								disabled={i === 0}
								aria-label="Frage {i + 1} nach oben"
								onclick={() => schieben(i, -1)}><Icon d={PFEIL_HOCH} size={16} stroke={2} /></button
							>
							<button
								type="button"
								class="klein"
								disabled={i === u.fragen.length - 1}
								aria-label="Frage {i + 1} nach unten"
								onclick={() => schieben(i, 1)}><Icon d={PFEIL_RUNTER} size={16} stroke={2} /></button
							>
							<button
								type="button"
								class="klein"
								aria-label="Frage {i + 1} entfernen"
								onclick={() => {
									u!.fragen.splice(i, 1);
									ansage = `Frage ${i + 1} entfernt.`;
									if (!u!.fragen.length) u = null;
								}}><Icon d={MUELL} size={16} stroke={2} /></button
							>
						{/if}
					</div>
					<label class="feld">
						<span>Frage</span>
						<input type="text" bind:value={f.text} maxlength="200" disabled={gesperrt} required />
					</label>
					{#if f.art === 'auswahl' || f.art === 'termin'}
						<div class="optionen">
							<span class="unter">{f.art === 'auswahl' ? 'Antworten' : 'Termine, z. B. „Di 12.1., 11:30–13:00“'}</span>
							{#each f.optionen as _, k (k)}
								<div class="option">
									<label class="sr-only" for="opt-{i}-{k}">
										{f.art === 'auswahl' ? 'Antwort' : 'Termin'}
										{k + 1} zu Frage {i + 1}
									</label>
									<input
										id="opt-{i}-{k}"
										type="text"
										bind:value={f.optionen[k]}
										maxlength="100"
										disabled={gesperrt}
									/>
									{#if !gesperrt}
										<button
											type="button"
											class="klein"
											disabled={f.optionen.length <= 2}
											aria-label="{f.art === 'auswahl' ? 'Antwort' : 'Termin'} {k + 1} entfernen"
											onclick={() => f.optionen.splice(k, 1)}
											><Icon d="M6 6l12 12M18 6l-12 12" size={16} stroke={2} /></button
										>
									{/if}
								</div>
							{/each}
							{#if !gesperrt && f.optionen.length < MAX_OPTIONEN}
								<button type="button" class="linkknopf" onclick={() => f.optionen.push('')}>
									+ {f.art === 'auswahl' ? 'Antwort' : 'Termin'} hinzufügen
								</button>
							{/if}
						</div>
					{/if}
					<div class="schalter">
						<label class="haken"
							><input type="checkbox" bind:checked={f.pflicht} disabled={gesperrt} /> Pflichtfrage</label
						>
						{#if f.art === 'auswahl'}
							<label class="haken"
								><input type="checkbox" bind:checked={f.mehrfach} disabled={gesperrt} /> Mehrere Antworten
								erlauben</label
							>
						{/if}
					</div>
				</li>
			{/each}
		</ol>
		{#if !gesperrt && u.fragen.length < MAX_FRAGEN}
			<div class="neu">
				<span>Frage hinzufügen:</span>
				{#each ARTEN as [art, text] (art)}
					<button type="button" class="pille" onclick={() => neueFrage(art)}>+ {text}</button>
				{/each}
			</div>
		{/if}

		<div class="einstellungen">
			<label class="haken">
				<input type="checkbox" bind:checked={u.anonym} disabled={gesperrt} />
				<span><strong>Anonym</strong><br /><span class="unter"
						>Niemand sieht, wer was geantwortet hat. Anonyme Antworten lassen sich danach nicht mehr
						ändern.</span
					></span
				>
			</label>
			<fieldset class="wahl">
				<legend>Wer sieht das Ergebnis?</legend>
				<label class="haken"
					><input type="radio" value="alle" bind:group={u.ergebnis} /> Alle Teilnehmenden</label
				>
				<label class="haken"
					><input type="radio" value="team" bind:group={u.ergebnis} /> Nur {team}</label
				>
			</fieldset>
			{#if u.ergebnis === 'alle'}
				<fieldset class="wahl">
					<legend>Ab wann?</legend>
					<label class="haken"><input type="radio" value="sofort" bind:group={u.ab} /> Sofort</label>
					<label class="haken"
						><input type="radio" value="antwort" bind:group={u.ab} /> Nach der eigenen Antwort</label
					>
					<label class="haken"
						><input type="radio" value="ende" bind:group={u.ab} /> Erst nach dem Ende</label
					>
				</fieldset>
			{/if}
			<label class="feld ende">
				<span>Ende</span>
				<input type="datetime-local" bind:value={u.ende} required />
			</label>
		</div>

		<section class="wersieht" aria-labelledby="wer-sieht-titel">
			<h3 id="wer-sieht-titel">Wer sieht was?</h3>
			<p class="unter">So erklären wir es den Teilnehmenden direkt an der Umfrage.</p>
			<ul>
				{#each erklaerung as e (e.was)}<li><strong>{e.was}:</strong> {e.wer}</li>{/each}
			</ul>
		</section>
		{#if !gesperrt}
			<button type="button" class="linkknopf" onclick={() => (u = null)}>Umfrage entfernen</button>
		{/if}
	{/if}
	<p class="sr-only" role="status">{ansage}</p>
</fieldset>

<style>
	.gruppe {
		border: 1px solid var(--bd);
		border-radius: var(--radius);
		padding: 10px 16px 14px;
		margin: 0;
		display: grid;
		gap: 12px;
	}
	legend {
		font-weight: 700;
	}
	.knopf {
		justify-self: start;
		gap: 6px;
	}
	.fragen {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 12px;
	}
	.frage {
		display: grid;
		gap: 10px;
		padding: 12px;
		border: 1px solid var(--bd);
		border-radius: 12px;
		background: var(--sf);
	}
	.fragekopf {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.nr {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		background: var(--tint);
		color: var(--ac);
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
	}
	.art {
		flex: 1;
		font-size: 13px;
		font-weight: 700;
		color: var(--mu);
	}
	.klein {
		width: 44px;
		height: 44px;
		flex: none;
		border: 1px solid var(--bd);
		border-radius: 10px;
		background: var(--sf);
		color: var(--tx);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.klein:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.feld {
		display: grid;
		gap: 4px;
	}
	.feld span {
		font-weight: 600;
		font-size: 14px;
	}
	.optionen {
		display: grid;
		gap: 6px;
	}
	.option {
		display: flex;
		gap: 8px;
	}
	.option input {
		flex: 1;
		min-width: 0;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
	}
	.schalter,
	.neu {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 16px;
	}
	.haken {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		min-height: 44px;
		align-content: center;
		padding-top: 10px;
	}
	.haken input {
		width: 20px;
		height: 20px;
		flex: none;
		accent-color: var(--fill);
		margin: 0;
	}
	.einstellungen {
		display: grid;
		gap: 8px;
	}
	.wahl {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0 18px;
	}
	.wahl legend {
		font-size: 14px;
		padding: 0;
	}
	.ende {
		max-width: 280px;
	}
	.wersieht {
		padding: 12px 14px;
		border-radius: 12px;
		background: color-mix(in srgb, var(--tint) 60%, var(--sf));
	}
	.wersieht h3 {
		margin: 0;
		font-size: 15px;
	}
	.wersieht ul {
		margin: 8px 0 0;
		padding-left: 18px;
		display: grid;
		gap: 4px;
		font-size: 14px;
	}
	.linkknopf {
		justify-self: start;
	}
</style>
