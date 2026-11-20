<script lang="ts">
	/** Formular für eine FAQ (Kap. 8.9): Einheit, Frage, Antwort im Editor, Anhänge. */
	import Anhaenge from './Anhaenge.svelte';
	import Editor from './Editor.svelte';

	let {
		einheiten,
		werte,
		fehler = {}
	}: {
		einheiten: { id: string; name: string; label: string }[];
		werte: {
			unitId: string;
			question: string;
			answerHtml: string;
			attachments: { id: string; name: string; size: number }[];
		};
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

<Anhaenge start={werte.attachments} fehler={fehler.attachments} />

<style>
	.feldfehler {
		color: var(--err-tx);
		font-size: 0.93rem;
		font-weight: 600;
	}
</style>
