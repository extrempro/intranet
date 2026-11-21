<script lang="ts">
	/** Formular „Hinter den Kulissen“ (Kap. 8.4): Absender, Titel, Text, Fotos, Ziel-Mandanten, Einwilligung. */
	import Anhaenge from './Anhaenge.svelte';
	import Editor from './Editor.svelte';

	let {
		einheiten,
		mandanten,
		werte,
		fehler = {}
	}: {
		einheiten: { id: string; name: string; label: string; tenantId: string }[];
		mandanten: { id: string; name: string }[];
		werte: {
			unitId: string;
			title: string;
			bodyHtml: string;
			tenantIds: string[];
			attachments: { id: string; name: string; size: number }[];
			consent: boolean;
		};
		fehler?: Partial<Record<'unitId' | 'title' | 'body' | 'attachments' | 'consent', string>>;
	} = $props();

	let unitId = $state('');
	let titel = $state('');
	$effect.pre(() => {
		unitId = werte.unitId;
		titel = werte.title;
	});
	const eigenerMandant = $derived(einheiten.find((e) => e.id === unitId)?.tenantId);
</script>

{#if einheiten.length > 1}
	<label class="feld">
		<span>Absender</span>
		<select name="absender" bind:value={unitId}>
			{#each einheiten as e (e.id)}<option value={e.id}>{e.name} ({e.label})</option>{/each}
		</select>
		{#if fehler.unitId}<span class="feldfehler">{fehler.unitId}</span>{/if}
	</label>
{:else}
	<input type="hidden" name="absender" value={unitId} />
	<p class="hinweis">Absender: <strong>{einheiten[0]?.name}</strong>. Dein Name erscheint nicht.</p>
{/if}

<label class="feld">
	<span>Titel</span>
	<input
		name="titel"
		required
		maxlength="160"
		bind:value={titel}
		placeholder="z. B. So entsteht ein Bühnenbild"
	/>
	{#if fehler.title}<span class="feldfehler">{fehler.title}</span>{/if}
</label>

<div class="feld">
	<span>Text</span>
	<Editor name="text" value={werte.bodyHtml} label="Text des Beitrags" />
	{#if fehler.body}<span class="feldfehler">{fehler.body}</span>{/if}
</div>

<Anhaenge start={werte.attachments} fehler={fehler.attachments} beschreibungen />

<fieldset class="gruppe">
	<legend>Wer sieht das?</legend>
	<p class="hinweis">
		Dein Mandant ist immer dabei. Andere Mandanten können den Beitrag auch über „Aus: …“ einblenden.
	</p>
	{#each mandanten as m (m.id)}
		<label class="option">
			<input
				type="checkbox"
				name="mandanten"
				value={m.id}
				checked={m.id === eigenerMandant || werte.tenantIds.includes(m.id)}
				disabled={m.id === eigenerMandant}
			/>
			{m.name}
		</label>
	{/each}
</fieldset>

<label class="option einwilligung">
	<input type="checkbox" name="einwilligung" checked={werte.consent} required />
	<span>
		Alle Personen, die auf den Fotos zu erkennen sind, haben der Veröffentlichung zugestimmt.
		<span class="hinweis">Der Beitrag geht ohne Freigabe sofort online.</span>
	</span>
</label>
{#if fehler.consent}<span class="feldfehler">{fehler.consent}</span>{/if}

<style>
	.gruppe {
		border: 0;
		margin: 0;
		padding: 0;
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
		flex: none;
		accent-color: var(--fill);
	}
	.einwilligung {
		align-items: flex-start;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--tint);
	}
	.einwilligung > span {
		display: flex;
		flex-direction: column;
	}
	.feldfehler {
		color: var(--err-tx);
		font-size: 0.93rem;
		font-weight: 600;
	}
</style>
