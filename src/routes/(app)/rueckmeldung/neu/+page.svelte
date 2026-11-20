<script lang="ts">
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { FEEDBACK_KINDS, FEEDBACK_MAX } from '#lib/feedback.ts';

	let { data, form } = $props();
	let w = $state(
		untrack(() => ({
			kind: form?.eingabe?.kind ?? 'fehler',
			text: form?.eingabe?.text ?? ''
		}))
	);
	const f = $derived(form?.fehler ?? {});
</script>

<svelte:head><title>Rückmeldung · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={data.von}>← Zurück</a>
	<div>
		<h1>Rückmeldung</h1>
		<p class="hinweis">
			Etwas funktioniert nicht oder du hast eine Idee? Die Verwaltung deines Mandanten liest mit und
			meldet sich bei Rückfragen über Nachrichten. Den Stand siehst du unter
			<a href={resolve('/(app)/rueckmeldung')}>Meine Meldungen</a>.
		</p>
	</div>
	<form method="POST" class="karte stapel">
		<input type="hidden" name="seite" value={data.von} />
		<fieldset class="feld">
			<legend>Was möchtest du melden?</legend>
			<div class="optionen">
				{#each FEEDBACK_KINDS as k (k.key)}
					<label class="option">
						<input type="radio" name="art" value={k.key} bind:group={w.kind} />
						<span><strong>{k.label}</strong> <span class="hinweis">· {k.hint}</span></span>
					</label>
				{/each}
			</div>
			{#if f.kind}<span class="feldfehler">{f.kind}</span>{/if}
		</fieldset>
		<label class="feld">
			<span>{w.kind === 'fehler' ? 'Was ist passiert?' : 'Deine Idee'}</span>
			<textarea
				name="text"
				rows="6"
				maxlength={FEEDBACK_MAX}
				required
				bind:value={w.text}
				placeholder={w.kind === 'fehler'
					? 'Was hast du gemacht, was hast du erwartet, was ist stattdessen passiert?'
					: 'Was würde dir die Arbeit leichter machen?'}
				aria-invalid={f.text ? 'true' : undefined}
				aria-describedby={f.text ? 'f-text' : 'h-text'}></textarea>
			{#if f.text}<span id="f-text" class="feldfehler">{f.text}</span>{:else}<span
					id="h-text"
					class="hinweis"
				>
					{w.text.length} / {FEEDBACK_MAX}
				</span>{/if}
		</label>
		<p class="hinweis">
			Mitgeschickt wird die Seite, von der du kommst: <code>{data.von}</code>
		</p>
		<button class="knopf" type="submit">Senden</button>
	</form>
</div>

<style>
	.seite {
		max-width: 40rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h1 {
		margin: 0;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.optionen {
		display: grid;
		gap: 2px;
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
	.feldfehler {
		color: var(--err-tx);
		font-size: 0.93rem;
		font-weight: 600;
	}
	code {
		overflow-wrap: anywhere;
	}
</style>
