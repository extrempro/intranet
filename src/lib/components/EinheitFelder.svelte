<script lang="ts">
	import type { UnitType } from '#lib/roles.ts';

	interface Werte {
		tenantId: string;
		type: UnitType;
		name: string;
		title: string | null;
		isCentral: boolean;
		hidden: boolean;
		mayPostUrgent: boolean | null;
		mayCreateEvents: boolean | null;
		mandatorySubscription?: boolean;
		behindScenes?: boolean;
		surveys?: boolean;
		isKbb: boolean;
	}

	let {
		werte,
		mandanten,
		neu
	}: { werte: Werte; mandanten: { id: string; name: string; isMain: boolean }[]; neu: boolean } =
		$props();

	let typ = $state<UnitType>('abteilung');
	let mandant = $state('');
	$effect.pre(() => {
		typ = werte.type;
		mandant = werte.tenantId || (mandanten[0]?.id ?? '');
	});
	const hauptmandant = $derived(mandanten.find((m) => m.id === mandant)?.isMain ?? false);
	const mitTitel = $derived(typ === 'geschaeftsfuehrung' || typ === 'stabsstelle');
</script>

{#if neu}
	<label class="feld">
		<span>Typ</span>
		<select name="typ" bind:value={typ}>
			<option value="geschaeftsfuehrung">Geschäftsführung</option>
			<option value="stabsstelle">Stabsstelle</option>
			<option value="abteilung">Abteilung</option>
			<option value="hub">Hub</option>
		</select>
	</label>
	<label class="feld">
		<span>Mandant</span>
		<select name="mandant" bind:value={mandant}>
			{#each mandanten as m (m.id)}<option value={m.id}>
					{m.name}{m.isMain ? ' (Hauptmandant)' : ''}
				</option>{/each}
		</select>
	</label>
{:else}
	<input type="hidden" name="typ" value={werte.type} />
	<input type="hidden" name="mandant" value={werte.tenantId} />
{/if}

<label class="feld">
	<span>Name</span>
	<input name="name" required minlength="2" maxlength="120" value={werte.name} />
</label>

{#if mitTitel}
	<label class="feld">
		<span>Titel (optional)</span>
		<input
			name="titel"
			maxlength="80"
			value={werte.title ?? ''}
			placeholder="z. B. Intendanz, Kaufmännische Leitung, Datenschutzbeauftragte"
		/>
		<span class="hinweis">
			Erscheint statt „Geschäftsführung“ bzw. „Stabsstelle“ auf der Seite und in Listen.
		</span>
	</label>
{/if}

{#if typ === 'stabsstelle'}
	<p class="hinweis">Stabsstellen sind immer für alle Mandanten zuständig.</p>
{:else if hauptmandant}
	<label class="option">
		<input type="checkbox" name="zentral" checked={werte.isCentral} />
		<span>Zentral – für alle Mandanten zuständig</span>
	</label>
{/if}

{#if typ === 'abteilung'}
	<label class="option">
		<input type="checkbox" name="kbb" checked={werte.isKbb} />
		<span>KBB dieses Mandanten</span>
	</label>
{/if}

{#if typ !== 'hub'}
	<fieldset class="gruppe">
		<legend>Dringende Meldungen</legend>
		{#each [['standard', 'Standard nach Typ (Geschäftsführung und KBB ja)'], ['ja', 'Erlaubt'], ['nein', 'Nicht erlaubt']] as [wert, text] (wert)}
			<label class="option">
				<input
					type="radio"
					name="dringend"
					value={wert}
					checked={(werte.mayPostUrgent === null && wert === 'standard') ||
						(werte.mayPostUrgent === true && wert === 'ja') ||
						(werte.mayPostUrgent === false && wert === 'nein')}
				/>
				<span>{text}</span>
			</label>
		{/each}
	</fieldset>
{/if}

{#if typ !== 'hub'}
	<label class="option">
		<input type="checkbox" name="kulissen" checked={werte.behindScenes ?? false} />
		<span>„Hinter den Kulissen“ freigeschaltet</span>
	</label>
{/if}

<label class="option">
	<input type="checkbox" name="umfragen" checked={werte.surveys ?? false} />
	<span>
		Umfragen freigeschaltet – wirkt nur, wenn Umfragen unter „Regeln für Inhalte“ eingeschaltet sind
	</span>
</label>

{#if typ === 'hub'}
	<label class="option">
		<input type="checkbox" name="pflichtabo" checked={werte.mandatorySubscription ?? false} />
		<span>
			Pflicht-Abo – alle im Zuständigkeitsbereich bekommen die Beiträge, Abmelden geht nicht
		</span>
	</label>
{/if}

<fieldset class="gruppe">
	<legend>Termine im Kalender</legend>
	{#each [['standard', 'Nach der Regel (Verwaltung → Regeln, Standard: erlaubt)'], ['ja', 'Erlaubt'], ['nein', 'Nicht erlaubt']] as [wert, text] (wert)}
		<label class="option">
			<input
				type="radio"
				name="termine"
				value={wert}
				checked={(werte.mayCreateEvents === null && wert === 'standard') ||
					(werte.mayCreateEvents === true && wert === 'ja') ||
					(werte.mayCreateEvents === false && wert === 'nein')}
			/>
			<span>{text}</span>
		</label>
	{/each}
</fieldset>

<label class="option">
	<input type="checkbox" name="ausgeblendet" checked={werte.hidden} />
	<span>Ausgeblendet – erscheint nicht in Listen und Suche</span>
</label>

<style>
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
	.gruppe {
		border: 1px solid var(--bd);
		border-radius: var(--radius);
		padding: 8px 14px;
		margin: 0;
	}
</style>
