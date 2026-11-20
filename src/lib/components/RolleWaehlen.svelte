<script lang="ts">
	/** Rolle, Geltungsbereich und Ziel wählen; Felder: rolle, bereich, ziel. */
	interface RollenOption {
		role: string;
		label: string;
		scopes: ('all' | 'tenant' | 'unit')[];
		unitTypes: string[];
	}

	let {
		rollen,
		mandanten,
		einheiten
	}: {
		rollen: RollenOption[];
		mandanten: { id: string; name: string }[];
		einheiten: { id: string; name: string; type: string; label: string; tenantName: string }[];
	} = $props();

	let rolle = $state('');
	let bereich = $state<'all' | 'tenant' | 'unit' | ''>('');
	const option = $derived(rollen.find((r) => r.role === rolle));
	const passendeEinheiten = $derived(
		option ? einheiten.filter((e) => option.unitTypes.includes(e.type)) : []
	);
	const BEREICHE = { all: 'Alle Mandanten', tenant: 'Ein Mandant', unit: 'Eine Einheit' };

	$effect(() => {
		// Bei Rollenwechsel ersten passenden Bereich vorwählen
		if (option && !option.scopes.includes(bereich as never)) bereich = option.scopes[0];
	});
</script>

<label class="feld">
	<span>Rolle</span>
	<select name="rolle" bind:value={rolle} required>
		<option value="" disabled>Bitte wählen</option>
		{#each rollen as r (r.role)}<option value={r.role}>{r.label}</option>{/each}
	</select>
</label>

{#if option}
	{#if option.scopes.length > 1}
		<fieldset class="gruppe">
			<legend>Gilt für</legend>
			{#each option.scopes as s (s)}
				<label class="option">
					<input type="radio" name="bereich" value={s} bind:group={bereich} />
					{BEREICHE[s]}
				</label>
			{/each}
		</fieldset>
	{:else}
		<input type="hidden" name="bereich" value={option.scopes[0]} />
		<p class="hinweis">Gilt für: {BEREICHE[option.scopes[0]]}</p>
	{/if}

	{#if bereich === 'tenant'}
		<label class="feld">
			<span>Mandant</span>
			<select name="ziel" required>
				{#each mandanten as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
			</select>
		</label>
	{:else if bereich === 'unit'}
		<label class="feld">
			<span>Einheit</span>
			<select name="ziel" required>
				{#if passendeEinheiten.length === 0}<option value="" disabled selected>
						Keine passende Einheit
					</option>{/if}
				{#each passendeEinheiten as e (e.id)}<option value={e.id}>
						{e.name} ({e.label}, {e.tenantName})
					</option>{/each}
			</select>
		</label>
	{:else}
		<input type="hidden" name="ziel" value="" />
	{/if}
{/if}

<style>
	.gruppe {
		border: 1px solid var(--bd);
		border-radius: var(--radius);
		padding: 8px 14px;
		margin: 0;
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
</style>
