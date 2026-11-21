<script lang="ts">
	/** Formular für einen Termin (Kap. 8.8). */
	import { untrack } from 'svelte';
	import Info from './Info.svelte';
	import { DESCRIPTION_MAX, PLACE_MAX, TITLE_MAX } from '#lib/calendar.ts';

	interface Werte {
		unitId: string;
		title: string;
		date: string;
		allDay: boolean;
		startTime: string;
		endTime: string;
		place: string;
		description: string;
		allTenants: boolean;
		tenantIds: string[];
	}

	let {
		einheiten,
		mandanten,
		werte,
		fehler = {}
	}: {
		einheiten: { id: string; name: string; label: string; isCentral: boolean }[];
		mandanten: { id: string; name: string }[];
		werte: Werte;
		fehler?: Partial<Record<keyof Werte | 'targets', string>>;
	} = $props();

	let v = $state(untrack(() => structuredClone(werte)));
	const einheit = $derived(einheiten.find((e) => e.id === v.unitId));
</script>

{#if einheiten.length > 1}
	<label class="feld">
		<span>Absender</span>
		<select name="absender" bind:value={v.unitId}>
			{#each einheiten as e (e.id)}<option value={e.id}>{e.name} ({e.label})</option>{/each}
		</select>
		{#if fehler.unitId}<span class="feldfehler">{fehler.unitId}</span>{/if}
	</label>
{:else}
	<input type="hidden" name="absender" value={v.unitId} />
	<p class="hinweis">Absender: <strong>{einheit?.name}</strong></p>
{/if}

<label class="feld">
	<span>Titel</span>
	<input
		name="titel"
		required
		maxlength={TITLE_MAX}
		bind:value={v.title}
		placeholder="z. B. Erste-Hilfe-Kurs"
		aria-invalid={fehler.title ? 'true' : undefined}
	/>
	{#if fehler.title}<span class="feldfehler">{fehler.title}</span>{/if}
</label>

<div class="zeile">
	<label class="feld">
		<span>Datum</span>
		<input type="date" name="datum" required bind:value={v.date} />
		{#if fehler.date}<span class="feldfehler">{fehler.date}</span>{/if}
	</label>
	<label class="feld">
		<span>Von</span>
		<input
			type="time"
			name="von"
			bind:value={v.startTime}
			disabled={v.allDay}
			required={!v.allDay}
		/>
		{#if fehler.startTime}<span class="feldfehler">{fehler.startTime}</span>{/if}
	</label>
	<label class="feld">
		<span>Bis <span class="optional">(optional)</span></span>
		<input type="time" name="bis" bind:value={v.endTime} disabled={v.allDay} />
		{#if fehler.endTime}<span class="feldfehler">{fehler.endTime}</span>{/if}
	</label>
</div>
<label class="option">
	<input type="checkbox" name="ganztaegig" bind:checked={v.allDay} /> Ganztägig
</label>

<label class="feld">
	<span>Ort <span class="optional">(optional)</span></span>
	<input
		name="ort"
		maxlength={PLACE_MAX}
		bind:value={v.place}
		placeholder="z. B. Probebühne 1 oder online"
	/>
	{#if fehler.place}<span class="feldfehler">{fehler.place}</span>{/if}
</label>

<label class="feld">
	<span>Beschreibung <span class="optional">(optional)</span></span>
	<textarea
		name="beschreibung"
		rows="4"
		maxlength={DESCRIPTION_MAX}
		bind:value={v.description}
		placeholder="z. B. Bitte bis Freitag anmelden."></textarea>
	<span class="hinweis">Die Beschreibung steht nicht im Kalender-Abo, nur im Intranet.</span>
	{#if fehler.description}<span class="feldfehler">{fehler.description}</span>{/if}
</label>

{#if einheit?.isCentral}
	<fieldset class="gruppe">
		<legend>
			Wer sieht das?
			<Info
				thema="Wer sieht das?"
				text="Der Termin steht im Kalender der gewählten Mandanten. Wer nicht dazugehört, sieht ihn nicht, auch nicht im Kalender-Abo."
			/>
		</legend>
		<label class="option">
			<input
				type="radio"
				name="zielgruppe"
				value="alle"
				checked={v.allTenants}
				onchange={() => (v.allTenants = true)}
			/> Alle Mandanten
		</label>
		<label class="option">
			<input
				type="radio"
				name="zielgruppe"
				value="auswahl"
				checked={!v.allTenants}
				onchange={() => (v.allTenants = false)}
			/> Nur ausgewählte Mandanten
		</label>
		{#if !v.allTenants}
			<div class="einzug">
				{#each mandanten as m (m.id)}
					<label class="option">
						<input
							type="checkbox"
							name="mandanten"
							value={m.id}
							checked={v.tenantIds.includes(m.id)}
						/>
						{m.name}
					</label>
				{/each}
			</div>
		{/if}
		{#if fehler.targets}<span class="feldfehler">{fehler.targets}</span>{/if}
	</fieldset>
{:else}
	<p class="hinweis">
		Wer sieht das? Dein Mandant. Andere Mandanten können den Termin über „Aus: …“ einblenden.
	</p>
{/if}

<style>
	.zeile {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
		gap: 14px;
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
		accent-color: var(--fill);
	}
	.gruppe {
		border: 0;
		margin: 0;
		padding: 0;
	}
	.einzug {
		padding-left: 30px;
	}
	.optional {
		font-weight: 400;
		color: var(--mu);
	}
	.feldfehler {
		color: var(--err-tx);
		font-size: 0.93rem;
		font-weight: 600;
	}
</style>
