<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import Anhaenge from './Anhaenge.svelte';
	import { frage } from '#lib/frage.svelte.ts';
	import Editor from './Editor.svelte';
	import Info from './Info.svelte';
	import UmfrageEditor from './UmfrageEditor.svelte';
	import { berlinToDate, endOfBerlinDay, lifecycle } from '#lib/news.ts';

	interface Einheit {
		id: string;
		name: string;
		label: string;
		isCentral: boolean;
		tenantId: string;
		/** Wählbare Zielmandanten: null = nur der eigene, 'alle' = frei */
		zielMandanten: 'alle' | string[] | null;
		mayUrgent: boolean;
		isHub: boolean;
		/** Intern schreiben möglich: Teamgröße je Kreis (Kap. 8.17) */
		intern?: { mitglieder: number; stamm: number } | null;
		/** Darf an Beiträgen dieser Einheit Umfragen anlegen (Recht und Regel an) */
		mayUmfrage?: boolean;
		/** Umfragen für die Einheit von der Verwaltung freigeschaltet */
		umfrageFrei?: boolean;
	}
	interface Werte {
		unitId: string;
		title: string;
		bodyHtml: string;
		publishAt: string;
		expiresAt: string;
		pin: boolean;
		pinnedUntil: string;
		urgent: boolean;
		urgentUntil: string;
		urgentText: string;
		allTenants: boolean;
		tenantIds: string[];
		/** Nur für das Team (Kap. 8.17): '' = alle */
		teamScope?: '' | 'mitglieder' | 'stamm';
		replacePin: boolean;
		attachments: {
			id: string;
			name: string;
			size: number;
		}[];
		/** Umfrage als JSON (Kap. 8.16), leer = keine */
		umfrage?: string;
	}

	let {
		werte,
		einheiten,
		mandanten,
		fehler = {},
		pinKonflikt = null,
		regeln,
		knopf,
		zusatz,
		umfrageGesperrt = false,
		pruefenNurBeiAenderung = false
	}: {
		werte: Werte;
		einheiten: Einheit[];
		mandanten: { id: string; name: string }[];
		fehler?: Record<string, string>;
		pinKonflikt?: { id: string; title: string } | null;
		regeln: { pinMaxDays: number; urgentMaxDays: number; surveys?: boolean };
		knopf: string;
		/** Weitere Knöpfe neben „Speichern“, z. B. Entwurf */
		zusatz?: Snippet;
		/** Umfrage hat schon Antworten */
		umfrageGesperrt?: boolean;
		/** Bearbeiten: Prüfdialog nur, wenn sich „Wer sieht das?“ geändert hat */
		pruefenNurBeiAenderung?: boolean;
	} = $props();

	// Startwerte aus den Props, danach im Formular änderbar (tief reaktiv).
	// Neue Werte vom Server: die Seite baut das Formular per {#key} neu auf.
	let v = $state<Werte>(untrack(() => structuredClone(werte)));

	const einheit = $derived(einheiten.find((e) => e.id === v.unitId) ?? einheiten[0]);
	// Mandantenwahl: zentrale Einheiten und die Redaktion (Kap. 8.1, 10)
	const ziel = $derived(einheit?.zielMandanten ?? null);
	const waehlbar = $derived(
		ziel === 'alle' ? mandanten : mandanten.filter((m) => ziel?.includes(m.id))
	);
	// Absender gewechselt: Zielgruppe passend vorbelegen (zentral an alle, sonst der eigene Mandant)
	let letzteEinheit = untrack(() => v.unitId);
	$effect(() => {
		const e = einheit;
		if (!e || e.id === letzteEinheit) return;
		letzteEinheit = e.id;
		untrack(() => {
			v.allTenants = e.isCentral;
			v.tenantIds = e.isCentral ? [] : [e.tenantId];
		});
	});
	const ablauf = $derived(
		lifecycle({
			publishAt: (v.publishAt && berlinToDate(v.publishAt)) || undefined,
			expiresAt: (v.expiresAt && endOfBerlinDay(v.expiresAt)) || null,
			pinnedUntil: (v.pin && v.pinnedUntil && endOfBerlinDay(v.pinnedUntil)) || null,
			urgentUntil: (v.urgent && v.urgentUntil && berlinToDate(v.urgentUntil)) || null
		})
	);
	const hatUmfrage = $derived(!!v.umfrage && v.umfrage !== 'null');

	// Intern (Kap. 8.17): nur Abteilungen, deren Team die Person angehört
	const intern = $derived(einheit?.intern ?? null);
	const team = $derived(!!intern && !!v.teamScope);
	$effect(() => {
		if (!intern && v.teamScope) untrack(() => (v.teamScope = ''));
	});

	// Prüfdialog vor dem Veröffentlichen
	let knopfEl: HTMLButtonElement | undefined = $state();
	let bestaetigt = false;
	const start = untrack(() => ({
		team: werte.teamScope ?? '',
		alle: werte.allTenants,
		ids: [...werte.tenantIds].sort().join()
	}));
	const geaendert = $derived(
		(v.teamScope ?? '') !== start.team ||
			(!team && (v.allTenants !== start.alle || [...v.tenantIds].sort().join() !== start.ids))
	);
	// Klingt der Titel nach einer internen Info? Dann bei „an alle“ nachfragen.
	const INTERN_WOERTER = [
		'intern',
		'teambesprechung',
		'teamsitzung',
		'dienstplan',
		'schichtplan',
		'urlaubsplan',
		'vertretungsplan',
		'übergabe',
		'nur für uns',
		'nur für das team'
	];
	const klingtIntern = $derived(INTERN_WOERTER.some((w) => v.title.toLowerCase().includes(w)));
	const empfaenger = $derived.by(() => {
		if (team && intern) return v.teamScope === 'stamm' ? intern.stamm : intern.mitglieder;
		return null;
	});
	const mandantText = $derived.by(() => {
		if (!ziel) return 'Alle Personen deines Mandanten';
		if (v.allTenants && ziel === 'alle') return 'Alle Personen in allen Mandanten';
		const namen = mandanten.filter((m) => v.tenantIds.includes(m.id)).map((m) => m.name);
		return namen.length ? `Alle Personen in ${namen.join(', ')}` : 'noch kein Mandant gewählt';
	});
	const geplant = $derived(
		!!v.publishAt && (berlinToDate(v.publishAt)?.getTime() ?? 0) > Date.now() + 60_000
	);

	/** Zeilen des Prüfdialogs: wer sieht den Beitrag, wer wird benachrichtigt */
	function pruefzeilen(): string[] {
		const z: string[] = [];
		if (team) {
			z.push(
				`Nur für das Team ${einheit?.name} (${v.teamScope === 'stamm' ? 'nur mit Stammabteilung' : 'alle Mitglieder'})`,
				`${empfaenger} ${empfaenger === 1 ? 'Person' : 'Personen'}, mit Leitung und Stellvertretung`,
				'Benachrichtigung, Push und Teams nur an das Team',
				'Alle anderen sehen den Beitrag nicht, auch nicht die Redaktion'
			);
		} else {
			z.push(`Wer sieht das: ${mandantText}`);
			if (v.pin && v.pinnedUntil) z.push('Oben in den Neuigkeiten angeheftet');
			if (v.urgent && v.urgentUntil) z.push('Als dringende Meldung mit Banner');
			if (klingtIntern)
				z.push(
					'Achtung: Der Titel klingt nach einer internen Info. Soll das wirklich an alle?' +
						(intern ? ' Für dein Team wähle „Nur für unser Team“.' : '')
				);
		}
		if (geplant) z.push('Erscheint erst zur Freigabe');
		return z.map((t) => `• ${t}`);
	}

	async function absenden(e: MouseEvent) {
		if (bestaetigt || (pruefenNurBeiAenderung && !geaendert)) return;
		e.preventDefault();
		const ja = await frage({
			titel: 'Bitte kurz prüfen',
			text: pruefzeilen().join('\n'),
			ja: knopf,
			nein: 'Zurück'
		});
		if (!ja) return;
		bestaetigt = true;
		knopfEl?.click();
	}
	const fid = (k: string) => (fehler[k] ? `f-${k}` : undefined);
</script>

{#if Object.keys(fehler).length}
	<div class="meldung fehler" role="alert">
		<strong>Bitte prüf deine Angaben:</strong>
		<ul>
			{#each Object.values(fehler) as f (f)}<li>{f}</li>{/each}
		</ul>
	</div>
{/if}

{#if einheiten.length > 1}
	<label class="feld">
		<span>Absender</span>
		<select name="absender" bind:value={v.unitId}>
			{#each einheiten as e (e.id)}<option value={e.id}>{e.name} ({e.label})</option>{/each}
		</select>
		<span class="hinweis">Als Absender erscheint immer die Einheit, nie dein Name.</span>
	</label>
{:else}
	<input type="hidden" name="absender" value={einheit?.id} />
	<p class="hinweis">Absender: <strong>{einheit?.name}</strong>. Dein Name erscheint nicht.</p>
{/if}

<label class="feld">
	<span>Titel</span>
	<input
		name="titel"
		required
		maxlength="160"
		bind:value={v.title}
		aria-invalid={!!fehler.title}
		aria-describedby={fid('title')}
	/>
	{#if fehler.title}<span id="f-title" class="feldfehler">{fehler.title}</span>{/if}
</label>

<div class="feld">
	<span id="text-l">Text</span>
	<Editor name="text" value={v.bodyHtml} label="Text des Beitrags" describedby={fid('body')} />
	{#if fehler.body}<span id="f-body" class="feldfehler">{fehler.body}</span>{/if}
</div>

<Anhaenge start={werte.attachments} fehler={fehler.attachments} beschreibungen />

{#if intern}
	<fieldset class="gruppe">
		<legend>
			Für wen?
			<Info
				thema="Nur für unser Team"
				text="Interne Beiträge sehen nur die Mitglieder deiner Abteilung, Leitung und Stellvertretung. Sie stehen im Reiter „Intern“ und in den Neuigkeiten der Mitglieder. Die Redaktion sieht sie nicht."
			/>
		</legend>
		<label class="option">
			<input
				type="radio"
				name="sicht"
				value="alle"
				checked={!v.teamScope}
				onchange={() => (v.teamScope = '')}
			/> Öffentlich
		</label>
		<label class="option">
			<input
				type="radio"
				name="sicht"
				value="team"
				checked={!!v.teamScope}
				onchange={() => (v.teamScope = 'mitglieder')}
			/> Nur für unser Team
		</label>
		{#if team}
			<div class="einzug">
				<label class="option">
					<input
						type="radio"
						name="kreis"
						value="mitglieder"
						checked={v.teamScope === 'mitglieder'}
						onchange={() => (v.teamScope = 'mitglieder')}
					/> Alle Mitglieder
				</label>
				<label class="option">
					<input
						type="radio"
						name="kreis"
						value="stamm"
						checked={v.teamScope === 'stamm'}
						onchange={() => (v.teamScope = 'stamm')}
					/>
					Nur mit Stammabteilung {einheit?.name}
				</label>
				<p class="hinweis" aria-live="polite">
					Erreicht {empfaenger}
					{empfaenger === 1 ? 'Person' : 'Personen'} (mit Leitung und Stellvertretung). Anheften und „Dringend“
					gibt es für interne Beiträge nicht.
				</p>
			</div>
		{/if}
	</fieldset>
{:else}
	<input type="hidden" name="sicht" value="alle" />
{/if}

{#if team}
	<p class="hinweis">Wer sieht das? Nur dein Team, Leitung und Stellvertretung.</p>
{:else if ziel}
	<fieldset class="gruppe">
		<legend>
			Wer sieht das?
			<Info
				thema="Wer sieht das?"
				text={ziel === 'alle'
					? 'Du kannst für alle Mandanten schreiben oder nur für einzelne. Wer nicht dazugehört, sieht den Beitrag nicht, auch nicht in der Suche.'
					: 'Du kannst an die Mandanten schreiben, für die du Redaktion bist. Wer nicht dazugehört, sieht den Beitrag nicht, auch nicht in der Suche.'}
			/>
		</legend>
		{#if ziel === 'alle'}
			<label class="option">
				<input
					type="radio"
					name="zielgruppe"
					value="alle"
					checked={v.allTenants}
					onchange={() => (v.allTenants = true)}
				/> Alle Mandanten
			</label>
		{/if}
		{#if ziel === 'alle'}
			<label class="option">
				<input
					type="radio"
					name="zielgruppe"
					value="auswahl"
					checked={!v.allTenants}
					onchange={() => (v.allTenants = false)}
				/> Nur ausgewählte Mandanten
			</label>
		{:else}
			<input type="hidden" name="zielgruppe" value="auswahl" />
		{/if}
		{#if !v.allTenants || ziel !== 'alle'}
			<div class={ziel === 'alle' ? 'einzug' : ''}>
				{#each waehlbar as m (m.id)}
					<label class="option">
						<input
							type="checkbox"
							name="mandanten"
							value={m.id}
							checked={v.tenantIds.includes(m.id)}
							onchange={(ev) =>
								(v.tenantIds = ev.currentTarget.checked
									? [...v.tenantIds, m.id]
									: v.tenantIds.filter((t) => t !== m.id))}
						/>
						{m.name}
					</label>
				{/each}
			</div>
		{/if}
		{#if fehler.tenants}<span class="feldfehler">{fehler.tenants}</span>{/if}
	</fieldset>
{:else}
	<p class="hinweis">Wer sieht das? Alle Personen deines Mandanten.</p>
{/if}

<div class="zeile">
	<label class="feld">
		<span>
			Freigabe
			<Info
				thema="Freigabe"
				text="Ab diesem Zeitpunkt sehen alle den Beitrag. Liegt er in der Zukunft, ist der Beitrag geplant: Bis dahin sehen ihn nur die Schreibenden deiner Einheit und die Redaktion."
			/>
		</span>
		<input
			type="datetime-local"
			name="freigabe"
			bind:value={v.publishAt}
			required
			aria-describedby={fid('publishAt')}
		/>
		{#if fehler.publishAt}<span id="f-publishAt" class="feldfehler">{fehler.publishAt}</span>{/if}
	</label>
	<label class="feld">
		<span>
			Ablauf (optional)
			<Info
				thema="Ablauf"
				text="Nach diesem Tag verschwindet der Beitrag aus den Neuigkeiten. Ohne Ablauf bleibt er stehen."
			/>
		</span>
		<input type="date" name="ablauf" bind:value={v.expiresAt} aria-describedby={fid('expiresAt')} />
		{#if fehler.expiresAt}<span id="f-expiresAt" class="feldfehler">{fehler.expiresAt}</span>{/if}
	</label>
</div>

{#if !einheit?.isHub && !team}
	<fieldset class="gruppe">
		<legend>
			Anheften
			<Info
				thema="Anheften"
				text="Angeheftete Beiträge stehen oben in den Neuigkeiten, bis zum Datum unter „Angeheftet bis“. Jeder Absender kann nur eine begrenzte Zahl gleichzeitig anheften."
			/>
		</legend>
		<label class="option">
			<input type="checkbox" name="anheften" bind:checked={v.pin} /> Oben in den Neuigkeiten anheften
		</label>
		{#if v.pin}
			<label class="feld einzug">
				<span>Angeheftet bis (höchstens {regeln.pinMaxDays} Tage)</span>
				<input
					type="date"
					name="angeheftet_bis"
					bind:value={v.pinnedUntil}
					required
					aria-describedby={fid('pinnedUntil')}
				/>
				{#if fehler.pinnedUntil}<span id="f-pinnedUntil" class="feldfehler">
						{fehler.pinnedUntil}
					</span>{/if}
			</label>
			{#if pinKonflikt}
				<label class="option einzug">
					<input type="checkbox" name="ersetzen" bind:checked={v.replacePin} />
					„{pinKonflikt.title}“ lösen und diesen Beitrag anheften
				</label>
			{/if}
		{/if}
	</fieldset>
{/if}

{#if einheit?.mayUrgent && !team}
	<fieldset class="gruppe dringend">
		<legend>
			Dringende Meldung
			<Info
				thema="Dringende Meldung"
				text="Nur für Wichtiges, das alle sofort wissen müssen. Die Meldung erscheint als rotes Banner auf der Startseite und kommt immer als Push, auch in Ruhezeiten, wenn die Person das nicht ausgeschaltet hat. Nach „Dringend bis“ wird sie zum normalen Beitrag."
			/>
		</legend>
		<label class="option">
			<input type="checkbox" name="dringend" bind:checked={v.urgent} /> Als rotes Banner oben auf der
			Startseite zeigen
		</label>
		{#if v.urgent}
			<p class="hinweis einzug">
				Nur für Dinge, die alle heute wissen müssen. Jede Person kann das Banner zuklappen.
			</p>
			<label class="feld einzug">
				<span>Dringend bis (höchstens {regeln.urgentMaxDays} Tage)</span>
				<input
					type="datetime-local"
					name="dringend_bis"
					bind:value={v.urgentUntil}
					required
					aria-describedby={fid('urgentUntil')}
				/>
				{#if fehler.urgentUntil}<span id="f-urgentUntil" class="feldfehler">
						{fehler.urgentUntil}
					</span>{/if}
			</label>
			<label class="feld einzug">
				<span>Text im Banner</span>
				<textarea
					name="bannertext"
					rows="2"
					maxlength="280"
					bind:value={v.urgentText}
					required
					aria-describedby={fid('urgentText')}></textarea>
				{#if fehler.urgentText}<span id="f-urgentText" class="feldfehler">
						{fehler.urgentText}
					</span>{/if}
			</label>
			<div class="vorschau einzug" aria-hidden="true">
				<strong>Dringend · {einheit.name}</strong>
				<span>{v.urgentText || 'Hier erscheint dein Bannertext.'}</span>
			</div>
		{/if}
	</fieldset>
{/if}

{#if einheit?.mayUmfrage && ((regeln.surveys && einheit.umfrageFrei) || hatUmfrage)}
	<UmfrageEditor
		json={v.umfrage ?? ''}
		einheit={einheit?.name ?? ''}
		gesperrt={umfrageGesperrt}
		fehler={fehler.umfrage}
	/>
{/if}

<section class="karte ablauf" aria-label="So läuft der Beitrag ab">
	<strong>So läuft der Beitrag ab</strong>
	<ul aria-live="polite">
		{#each ablauf as satz (satz)}<li>{satz}</li>{/each}
	</ul>
</section>

<div class="aktionen">
	<button class="knopf" type="submit" bind:this={knopfEl} onclick={absenden}>{knopf}</button>
	{@render zusatz?.()}
</div>

<style>
	.gruppe {
		border: 1px solid var(--bd);
		border-radius: var(--radius);
		padding: 10px 16px 14px;
		margin: 0;
		display: grid;
		gap: 6px;
	}
	.gruppe.dringend {
		border-color: var(--err-bd);
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
	.einzug {
		margin-left: 30px;
	}
	.zeile {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
		gap: 14px;
	}
	.feldfehler {
		color: var(--err-tx);
		font-size: 0.93rem;
		font-weight: 600;
	}
	.vorschau {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--err-bg);
		border: 2px solid var(--err-bd);
		color: var(--err-tx);
	}
	.ablauf ul {
		margin: 6px 0 0;
		padding-left: 1.2rem;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 12px;
	}
</style>
