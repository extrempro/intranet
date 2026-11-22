<script lang="ts">
	/** Formular für eine FAQ (Kap. 8.9): Einheit, Frage, Antwort im Editor, Anhänge. */
	import Anhaenge from './Anhaenge.svelte';
	import Editor from './Editor.svelte';

	let {
		einheiten,
		werte,
		themen = [],
		fehler = {}
	}: {
		einheiten: { id: string; name: string; label: string }[];
		werte: {
			unitId: string;
			question: string;
			answerHtml: string;
			attachments: { id: string; name: string; size: number }[];
			themen?: string[];
		};
		/** Feste Themenliste (Kap. 8.15) */
		themen?: { id: string; name: string }[];
		fehler?: Partial<Record<'unitId' | 'question' | 'answer' | 'attachments', string>>;
	} = $props();
</script>

{#if einheiten.length > 1}
	<label class="feld">
		<span>Einheit</span>
		<select name="einheit" value={werte.unitId} aria-describedby="f-einheit">
			{#each einheiten as e (e.id)}<option value={e.id}>{e.name} ({e.label})</option>{/each}
		</select>
		{#if fehler.unitId}<span id="f-einheit" class="feldfehler">{fehler.unitId}</span>{/if}
	</label>
{:else}
	<input type="hidden" name="einheit" value={einheiten[0]?.id} />
	<p class="hinweis">Einheit: {einheiten[0]?.name}</p>
{/if}

<label class="feld">
	<span>Frage</span>
	<input
		name="frage"
		required
		maxlength="200"
		value={werte.question}
		placeholder="z. B. Wie beantrage ich einen neuen Laptop?"
		aria-invalid={fehler.question ? 'true' : undefined}
		aria-describedby={fehler.question ? 'f-frage' : undefined}
	/>
	{#if fehler.question}<span id="f-frage" class="feldfehler">{fehler.question}</span>{/if}
</label>

<div class="feld">
	<span>Antwort</span>
	<Editor
		name="antwort"
		value={werte.answerHtml}
		label="Antwort"
		describedby={fehler.answer ? 'f-antwort' : undefined}
	/>
	{#if fehler.answer}<span id="f-antwort" class="feldfehler">{fehler.answer}</span>{/if}
</div>

{#if themen.length}
	<fieldset class="feld themen">
		<legend>Themen</legend>
		<div class="auswahl">
			{#each themen as t (t.id)}
				<label class="haken">
					<input
						type="checkbox"
						name="thema"
						value={t.id}
						checked={werte.themen?.includes(t.id) ?? false}
					/>
					{t.name}
				</label>
			{/each}
		</div>
	</fieldset>
{/if}

<Anhaenge start={werte.attachments} fehler={fehler.attachments} />

<style>
	.themen {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.themen legend {
		font-weight: 600;
		margin-bottom: 6px;
	}
	.auswahl {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 16px;
	}
	.haken {
		display: inline-flex;
		gap: 6px;
		align-items: center;
		min-height: 32px;
	}
	.feldfehler {
		color: var(--err-tx);
		font-size: 0.93rem;
		font-weight: 600;
	}
</style>
