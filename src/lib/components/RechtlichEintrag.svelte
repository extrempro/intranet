<script lang="ts">
	/** Formular für einen Eintrag unter „Gesetze und Tarifverträge“ (Link oder Datei). */
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { untrack } from 'svelte';
	import { LEGAL_KINDS, type LegalLinkErrors } from '#lib/legal.ts';
	import Anhaenge from './Anhaenge.svelte';

	let {
		werte,
		mandant,
		fehler = {},
		praefix,
		nachSpeichern
	}: {
		werte: {
			id: string | null;
			kind: string;
			title: string;
			description: string;
			url: string;
			datei: { id: string; name: string; size: number } | null;
		};
		mandant: string;
		fehler?: LegalLinkErrors;
		praefix: string;
		nachSpeichern?: () => void;
	} = $props();

	let w = $state(untrack(() => ({ ...werte })));
	const id = (k: string) => `${praefix}-${k}`;
	const absenden: SubmitFunction =
		() =>
		async ({ update, result }) => {
			await update({ reset: false });
			if (result.type === 'success') nachSpeichern?.();
		};
</script>

<form method="POST" action="?/eintrag" class="stapel" use:enhance={absenden}>
	{#if werte.id}<input type="hidden" name="id" value={werte.id} />{/if}
	<input type="hidden" name="mandant" value={mandant} />
	<div class="zwei">
		<label class="feld">
			<span>Art</span>
			<select name="art" bind:value={w.kind}>
				{#each LEGAL_KINDS as k (k.key)}<option value={k.key}>
						{k.label.replace(/e$/, '')}
					</option>{/each}
			</select>
		</label>
		<label class="feld">
			<span>Titel</span>
			<input
				name="titel"
				required
				maxlength="200"
				bind:value={w.title}
				placeholder="z. B. Arbeitszeitgesetz"
				aria-invalid={fehler.title ? 'true' : undefined}
				aria-describedby={fehler.title ? id('titel') : undefined}
			/>
			{#if fehler.title}<span id={id('titel')} class="feldfehler">{fehler.title}</span>{/if}
		</label>
	</div>
	<label class="feld">
		<span>Beschreibung (optional)</span>
		<input name="beschreibung" maxlength="500" bind:value={w.description} />
	</label>
	<label class="feld">
		<span>Link</span>
		<input
			name="adresse"
			type="url"
			maxlength="500"
			bind:value={w.url}
			placeholder="https://www.gesetze-im-internet.de/…"
			aria-invalid={fehler.url ? 'true' : undefined}
			aria-describedby={fehler.url ? id('adresse') : undefined}
		/>
		{#if fehler.url}<span id={id('adresse')} class="feldfehler">{fehler.url}</span>{/if}
	</label>
	<Anhaenge
		start={werte.datei ? [werte.datei] : []}
		max={1}
		fehler={fehler.file}
		legende="Oder Datei (statt Link)"
	/>
	<button class="knopf" type="submit">{werte.id ? 'Speichern' : 'Hinzufügen'}</button>
</form>

<style>
	.zwei {
		display: grid;
		grid-template-columns: minmax(160px, 1fr) minmax(220px, 3fr);
		gap: 12px;
	}
	@media (max-width: 600px) {
		.zwei {
			grid-template-columns: 1fr;
		}
	}
	.feldfehler {
		color: var(--err-tx);
		font-size: 0.93rem;
		font-weight: 600;
	}
</style>
