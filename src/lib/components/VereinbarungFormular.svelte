<script lang="ts">
	/** Felder einer Betriebs- oder Dienstvereinbarung (Kap. 8.10). */
	import { AGREEMENT_KINDS, type AgreementErrors } from '#lib/legal.ts';
	import Anhaenge from './Anhaenge.svelte';

	let {
		werte,
		mandanten,
		fehler = {},
		neu
	}: {
		werte: {
			tenantId: string;
			kind: string;
			title: string;
			description: string;
			versionDate: string;
			validFrom: string;
			attachments: { id: string; name: string; size: number }[];
		};
		mandanten: { id: string; name: string }[];
		fehler?: AgreementErrors;
		neu: boolean;
	} = $props();
</script>

{#if neu && mandanten.length > 1}
	<label class="feld">
		<span>Mandant</span>
		<select name="mandant" value={werte.tenantId}>
			{#each mandanten as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
		</select>
		{#if fehler.tenantId}<span class="feldfehler">{fehler.tenantId}</span>{/if}
	</label>
{:else}
	<input type="hidden" name="mandant" value={werte.tenantId} />
	{#if fehler.tenantId}<p class="feldfehler">{fehler.tenantId}</p>{/if}
{/if}

<fieldset class="feld">
	<legend>Art</legend>
	<div class="optionen">
		{#each AGREEMENT_KINDS as k (k.key)}
			<label class="option">
				<input type="radio" name="art" value={k.key} checked={werte.kind === k.key} required />
				{k.single}
			</label>
		{/each}
	</div>
	{#if fehler.kind}<span class="feldfehler">{fehler.kind}</span>{/if}
</fieldset>

<label class="feld">
	<span>Titel</span>
	<input
		name="titel"
		required
		maxlength="200"
		value={werte.title}
		placeholder="z. B. Mobiles Arbeiten"
		aria-invalid={fehler.title ? 'true' : undefined}
		aria-describedby={fehler.title ? 'f-titel' : undefined}
	/>
	{#if fehler.title}<span id="f-titel" class="feldfehler">{fehler.title}</span>{/if}
</label>

<label class="feld">
	<span>Kurzbeschreibung (optional)</span>
	<textarea name="beschreibung" rows="3" maxlength="1000" value={werte.description}></textarea>
	{#if fehler.description}<span class="feldfehler">{fehler.description}</span>{/if}
</label>

<div class="zwei">
	<label class="feld">
		<span>Stand</span>
		<input
			name="stand"
			type="date"
			required
			value={werte.versionDate}
			aria-invalid={fehler.versionDate ? 'true' : undefined}
			aria-describedby={fehler.versionDate ? 'f-stand' : undefined}
		/>
		{#if fehler.versionDate}<span id="f-stand" class="feldfehler">{fehler.versionDate}</span>{/if}
	</label>
	<label class="feld">
		<span>Gilt ab</span>
		<input
			name="gilt_ab"
			type="date"
			required
			value={werte.validFrom}
			aria-invalid={fehler.validFrom ? 'true' : undefined}
			aria-describedby={fehler.validFrom ? 'f-gilt' : undefined}
		/>
		{#if fehler.validFrom}<span id="f-gilt" class="feldfehler">{fehler.validFrom}</span>{/if}
	</label>
</div>

<Anhaenge start={werte.attachments} fehler={fehler.attachments} legende="Dokumente" />

<style>
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.optionen {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 20px;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
	}
	.option input {
		width: 20px;
		height: 20px;
		accent-color: var(--fill);
	}
	.zwei {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
	}
	.feldfehler {
		color: var(--err-tx);
		font-size: 0.93rem;
		font-weight: 600;
	}
</style>
