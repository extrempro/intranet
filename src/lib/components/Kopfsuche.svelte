<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Vorschlagslinks kommen vom Server (eigene Pfade) */
	/**
	 * Suche in der Kopfzeile (Kap. 8.14): Vorschläge beim Tippen als Combobox,
	 * Enter führt zur Ergebnisseite. Tastenkürzel „/“ öffnet die Suche.
	 * ort „seite“: Feld oben in der Seitenleiste (PC); „kopf“: Feld in der
	 * Kopfzeile (Tablet) bzw. Lupe mit eingeblendetem Feld (Handy).
	 */
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';

	interface Vorschlag {
		kind: string;
		label: string;
		title: string;
		href: string;
		meta: string;
		foto?: string | null;
	}

	let { ort = 'kopf' }: { ort?: 'kopf' | 'seite' } = $props();
	const uid = $props.id();
	const fid = `suche-${uid}`;

	const LUPE = 'M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M21 21l-6 -6';

	let offen = $state(false);
	let q = $state('');
	let vorschlaege = $state<Vorschlag[]>([]);
	let aktiv = $state(-1);
	let laedt = $state(false);
	let feld: HTMLInputElement | undefined = $state();
	let box: HTMLDivElement | undefined = $state();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let abbruch: AbortController | undefined;

	afterNavigate(() => schliessen());

	function oeffnen() {
		offen = true;
		queueMicrotask(() => feld?.focus());
	}

	function schliessen() {
		offen = false;
		aktiv = -1;
		vorschlaege = [];
	}

	function eingabe() {
		aktiv = -1;
		clearTimeout(timer);
		abbruch?.abort();
		const text = q.trim();
		if (text.length < 2) {
			vorschlaege = [];
			return;
		}
		timer = setTimeout(async () => {
			abbruch = new AbortController();
			laedt = true;
			try {
				const r = await fetch(`/suche/vorschlag?q=${encodeURIComponent(text)}`, {
					signal: abbruch.signal
				});
				if (r.ok) vorschlaege = (await r.json()).treffer;
			} catch {
				// abgebrochen oder offline: keine Vorschläge
			} finally {
				laedt = false;
			}
		}, 200);
	}

	function alleTreffer() {
		const text = q.trim();
		if (!text) return;
		goto(`${resolve('/(app)/suche')}?q=${encodeURIComponent(text)}`);
	}

	function taste(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' && vorschlaege.length) {
			e.preventDefault();
			aktiv = (aktiv + 1) % (vorschlaege.length + 1);
		} else if (e.key === 'ArrowUp' && vorschlaege.length) {
			e.preventDefault();
			aktiv = aktiv <= 0 ? vorschlaege.length : aktiv - 1;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (aktiv >= 0 && aktiv < vorschlaege.length) goto(vorschlaege[aktiv].href);
			else alleTreffer();
		} else if (e.key === 'Escape') {
			if (q) {
				q = '';
				vorschlaege = [];
			} else schliessen();
		}
	}

	function global(e: KeyboardEvent) {
		const ziel = e.target as HTMLElement | null;
		const tippt =
			ziel && (ziel.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(ziel.tagName));
		// Nur die gerade sichtbare Suche reagiert (Kopf oder Seitenleiste)
		if (!box?.getClientRects().length) return;
		if (e.key === '/' && !tippt && !e.ctrlKey && !e.metaKey && !e.altKey) {
			e.preventDefault();
			oeffnen();
		}
	}

	function klick(e: MouseEvent) {
		if (offen && box && !box.contains(e.target as Node)) schliessen();
	}
</script>

<svelte:window onkeydown={global} onclick={klick} />

<div class="kopfsuche {ort}" class:offen bind:this={box} data-tour="suche">
	<button
		type="button"
		class="symbolknopf lupe"
		aria-label="Suche öffnen"
		title="Suche (Taste /)"
		aria-expanded={offen}
		onclick={(e) => {
			e.stopPropagation();
			if (offen) schliessen();
			else oeffnen();
		}}
	>
		<Icon d={LUPE} size={20} stroke={1.8} />
	</button>

	<div class="feldbox" role="search">
		<span class="feldlupe" aria-hidden="true"><Icon d={LUPE} size={18} stroke={1.8} /></span>
		<label class="sr-only" for={fid}>Intranet durchsuchen</label>
		<input
			bind:this={feld}
			bind:value={q}
			id={fid}
			type="search"
			role="combobox"
			autocomplete="off"
			maxlength="100"
			placeholder={ort === 'seite' ? 'Suchen' : 'Personen, Themen, Beiträge, FAQs suchen'}
			aria-autocomplete="list"
			aria-controls="{fid}-liste"
			aria-expanded={vorschlaege.length > 0}
			aria-activedescendant={aktiv >= 0 ? `${fid}-${aktiv}` : undefined}
			onfocus={() => (offen = true)}
			oninput={eingabe}
			onkeydown={taste}
		/>
		{#if offen && q.trim().length >= 2}
			<ul id="{fid}-liste" class="liste" role="listbox" aria-label="Vorschläge">
				{#each vorschlaege as v, i (v.href + i)}
					<li id="{fid}-{i}" role="option" aria-selected={aktiv === i} class:aktiv={aktiv === i}>
						<a href={v.href} tabindex="-1">
							{#if v.kind === 'personen'}<Avatar name={v.title} foto={v.foto} groesse={28} />{/if}
							<span class="text">
								<strong>{v.title}</strong>
								<span class="meta">{v.label}{v.meta ? ` · ${v.meta}` : ''}</span>
							</span>
						</a>
					</li>
				{/each}
				{#if !laedt && vorschlaege.length === 0}
					<li class="leer" role="presentation">Keine Vorschläge</li>
				{/if}
				<li
					id="{fid}-{vorschlaege.length}"
					role="option"
					aria-selected={aktiv === vorschlaege.length}
					class="alle"
					class:aktiv={aktiv === vorschlaege.length}
				>
					<a href="{resolve('/(app)/suche')}?q={encodeURIComponent(q.trim())}" tabindex="-1">
						Alle Treffer für „{q.trim()}“
					</a>
				</li>
			</ul>
		{/if}
	</div>
</div>

<style>
	.kopfsuche {
		position: relative;
		display: flex;
		align-items: center;
	}
	.symbolknopf {
		width: 44px;
		height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		color: var(--tx);
		border: 0;
		border-radius: 10px;
		cursor: pointer;
		padding: 0;
	}
	.feldbox {
		display: none;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		box-sizing: border-box;
		border: 1px solid var(--bd);
		border-radius: 10px;
		background: var(--bg);
	}
	.feldlupe {
		display: inline-flex;
		color: var(--mu);
	}
	.feldbox input {
		flex: 1;
		min-width: 0;
		min-height: 42px;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--tx);
		font: inherit;
	}
	.feldbox input:focus-visible {
		outline: none;
	}
	.feldbox:focus-within {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}

	/* Kopf, Handy: Lupe blendet das Feld oben ein */
	.kopf.offen .feldbox {
		display: flex;
		position: fixed;
		top: 8px;
		left: 8px;
		right: 8px;
		z-index: 50;
		background: var(--sf);
		box-shadow: var(--shadow);
	}
	/* Kopf, Tablet: Feld direkt in der Kopfzeile */
	@media (min-width: 600px) {
		.kopf {
			flex: 1 1 200px;
			min-width: 160px;
			max-width: 560px;
		}
		.kopf .lupe {
			display: none;
		}
		.kopf .feldbox,
		.kopf.offen .feldbox {
			display: flex;
			position: relative;
			inset: auto;
			width: 100%;
			background: var(--bg);
			box-shadow: none;
		}
	}
	/* PC: die Suche steht in der Seitenleiste */
	@media (min-width: 1024px) {
		.kopf {
			display: none;
		}
	}

	/* Seitenleiste */
	.seite .lupe {
		display: none;
	}
	.seite .feldbox {
		display: flex;
		width: 100%;
		gap: 10px;
		padding: 0 14px;
		border: 0;
	}
	.seite .feldbox input {
		min-height: 46px;
		font-size: 15px;
	}
	.liste {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		right: 0;
		z-index: 50;
		list-style: none;
		margin: 0;
		padding: 6px;
		background: var(--sf);
		border: 1px solid var(--bd);
		border-radius: 14px;
		box-shadow: var(--shadow);
		max-height: 70vh;
		overflow: auto;
		min-width: 300px;
	}
	.liste a {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		min-height: 44px;
		box-sizing: border-box;
		border-radius: 10px;
		color: var(--tx);
		text-decoration: none;
	}
	.liste li.aktiv a,
	.liste a:hover {
		background: var(--tint);
	}
	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.text strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta {
		font-size: 13px;
		color: var(--mu);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.leer {
		padding: 10px;
		color: var(--mu);
	}
	.alle {
		border-top: 1px solid var(--bd);
		margin-top: 4px;
		padding-top: 4px;
	}
	.alle a {
		font-weight: 600;
		color: var(--ac);
	}
</style>
