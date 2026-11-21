<script module lang="ts">
	export interface Treffer {
		id: string;
		name: string;
		email: string;
		position: string | null;
		abteilung: string | null;
		mandant: string;
		foto: string | null;
	}
</script>

<script lang="ts">
	/**
	 * Person suchen und auswählen (Kombinationsfeld mit Vorschlägen).
	 * Tastatur: Pfeil runter/hoch wählt, Enter übernimmt, Escape schließt.
	 */

	let {
		quelle,
		beschriftung = 'Person suchen',
		knopf = 'Hinzufügen',
		ausschliessen = [],
		deaktiviert = false,
		mandantZeigen = false,
		onwahl
	}: {
		/** Adresse der Suche, z. B. /hubs/chor/personen */
		quelle: string;
		beschriftung?: string;
		knopf?: string;
		/** Schon gewählte Personen erscheinen nicht */
		ausschliessen?: string[];
		deaktiviert?: boolean;
		mandantZeigen?: boolean;
		onwahl: (p: Treffer) => void;
	} = $props();

	const uid = $props.id();
	let text = $state('');
	let treffer = $state<Treffer[]>([]);
	let offen = $state(false);
	let aktiv = $state(-1);
	let gewaehlt = $state<Treffer | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let anfrage = 0;
	const sichtbar = $derived(treffer.filter((t) => !ausschliessen.includes(t.id)));

	function suchen() {
		gewaehlt = null;
		clearTimeout(timer);
		const q = text.trim();
		if (q.length < 2) {
			treffer = [];
			offen = false;
			return;
		}
		timer = setTimeout(async () => {
			const nr = ++anfrage;
			const res = await fetch(`${quelle}?q=${encodeURIComponent(q)}`).catch(() => null);
			const liste = res?.ok ? ((await res.json()) as Treffer[]) : [];
			if (nr !== anfrage) return;
			treffer = liste;
			aktiv = -1;
			offen = true;
		}, 200);
	}

	function waehlen(t: Treffer) {
		gewaehlt = t;
		text = t.name;
		offen = false;
	}

	function uebernehmen() {
		const t = gewaehlt ?? (sichtbar.length === 1 ? sichtbar[0] : null);
		if (!t) return;
		onwahl(t);
		text = '';
		gewaehlt = null;
		treffer = [];
	}

	function taste(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' && sichtbar.length) {
			e.preventDefault();
			offen = true;
			aktiv = (aktiv + 1) % sichtbar.length;
		} else if (e.key === 'ArrowUp' && sichtbar.length) {
			e.preventDefault();
			aktiv = (aktiv - 1 + sichtbar.length) % sichtbar.length;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (offen && aktiv >= 0) waehlen(sichtbar[aktiv]);
			else uebernehmen();
		} else if (e.key === 'Escape') offen = false;
	}
</script>

<div class="suche">
	<div class="zeile">
		<input
			type="search"
			role="combobox"
			aria-label={beschriftung}
			aria-expanded={offen && sichtbar.length > 0}
			aria-controls="{uid}-liste"
			aria-autocomplete="list"
			aria-activedescendant={aktiv >= 0 ? `${uid}-${aktiv}` : undefined}
			placeholder={beschriftung}
			autocomplete="off"
			disabled={deaktiviert}
			bind:value={text}
			oninput={suchen}
			onkeydown={taste}
			onblur={() => setTimeout(() => (offen = false), 150)}
		/>
		<button
			class="knopf zweit"
			type="button"
			disabled={deaktiviert || !(gewaehlt || sichtbar.length === 1)}
			onclick={uebernehmen}
		>
			{knopf}
		</button>
	</div>
	{#if offen}
		<ul class="vorschlaege" id="{uid}-liste" role="listbox" aria-label="Vorschläge">
			{#each sichtbar as t, i (t.id)}
				<li
					id="{uid}-{i}"
					role="option"
					aria-selected={i === aktiv}
					class:aktiv={i === aktiv}
					onmousedown={(e) => {
						e.preventDefault();
						waehlen(t);
					}}
				>
					<strong>{t.name}</strong>
					<span>
						{[t.abteilung ?? t.position, mandantZeigen ? t.mandant : null, t.email]
							.filter(Boolean)
							.join(' · ')}
					</span>
				</li>
			{:else}
				<li class="leer" role="option" aria-selected="false" aria-disabled="true">
					Niemand gefunden.
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.suche {
		position: relative;
	}
	.zeile {
		display: flex;
		gap: 8px;
	}
	.zeile input {
		flex: 1;
		min-width: 0;
	}
	.vorschlaege {
		position: absolute;
		z-index: 5;
		left: 0;
		right: 0;
		top: calc(100% + 4px);
		margin: 0;
		padding: 4px;
		list-style: none;
		background: var(--sf);
		border: 1px solid var(--bd);
		border-radius: 12px;
		box-shadow: var(--shadow);
		max-height: 300px;
		overflow: auto;
	}
	.vorschlaege li {
		display: flex;
		flex-direction: column;
		padding: 8px 10px;
		border-radius: 8px;
		cursor: pointer;
	}
	.vorschlaege li span {
		font-size: 13px;
		color: var(--mu);
		overflow-wrap: anywhere;
	}
	.vorschlaege li.aktiv,
	.vorschlaege li:hover {
		background: var(--tint);
	}
	.vorschlaege li.leer {
		cursor: default;
		color: var(--mu);
	}
</style>
