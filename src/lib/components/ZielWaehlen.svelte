<script module lang="ts">
	export interface Ziel {
		gruppe: string;
		label: string;
		url: string;
	}
</script>

<script lang="ts">
	/**
	 * „Ziel wählen“ für eine Schnellzugriff-Kachel: Seite im Intranet, ein
	 * Dokument des Hubs oder eine Adresse (https, mailto, tel), dazu ein Symbol.
	 * Fenster wie die Rückfragen: PC/Tablet in der Mitte, Handy von unten.
	 */
	import { tick } from 'svelte';
	import { LINK_SYMBOLE, linkAdresse } from '#lib/hubs.ts';
	import Icon from './Icon.svelte';

	let {
		ziele,
		onwahl
	}: {
		ziele: Ziel[];
		onwahl: (w: { url: string; icon: string }) => void;
	} = $props();

	const uid = $props.id();
	let dialog: HTMLDialogElement | undefined = $state();
	let auswahl = $state('');
	let adresse = $state('');
	let symbol = $state('link');
	let fehler = $state('');
	const gruppen = $derived([...new Set(ziele.map((z) => z.gruppe))]);
	const symbole = Object.entries(LINK_SYMBOLE) as [string, { name: string; d: string }][];

	export async function oeffnen(start: { url: string; icon: string }) {
		const bekannt = ziele.some((z) => z.url === start.url);
		auswahl = bekannt ? start.url : '';
		adresse = bekannt ? '' : start.url;
		symbol = start.icon || 'link';
		fehler = '';
		await tick();
		dialog?.showModal();
	}

	function uebernehmen() {
		const url = auswahl || linkAdresse(adresse);
		if (!url) {
			fehler = 'Bitte wähl eine Seite oder gib eine Adresse ein (https://…, mailto:…, tel:…).';
			return;
		}
		onwahl({ url, icon: symbol });
		dialog?.close();
	}
</script>

<dialog bind:this={dialog} class="zieldialog" aria-labelledby="{uid}-titel">
	<form
		class="innen"
		method="dialog"
		onsubmit={(e) => {
			e.preventDefault();
			uebernehmen();
		}}
	>
		<h2 id="{uid}-titel">Ziel wählen</h2>
		<label class="feld">
			<span>Seite im Intranet oder Dokument</span>
			<select bind:value={auswahl}>
				<option value="">– eigene Adresse unten –</option>
				{#each gruppen as g (g)}
					<optgroup label={g}>
						{#each ziele.filter((z) => z.gruppe === g) as z (z.url)}
							<option value={z.url}>{z.label}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</label>
		{#if !auswahl}
			<label class="feld">
				<span>Adresse</span>
				<input
					bind:value={adresse}
					inputmode="url"
					placeholder="https://… oder mailto:…"
					autocomplete="off"
				/>
				<span class="hinweis">Externe Seiten öffnen in einem neuen Fenster.</span>
			</label>
		{/if}
		<fieldset class="symbole">
			<legend>Symbol</legend>
			{#each symbole as [key, s] (key)}
				<label class="symbol" title={s.name}>
					<input type="radio" name="{uid}-symbol" value={key} bind:group={symbol} />
					<span class="kachel" aria-hidden="true"><Icon d={s.d} size={20} /></span>
					<span class="sr-only">{s.name}</span>
				</label>
			{/each}
		</fieldset>
		{#if fehler}<p class="meldung fehler" role="alert">{fehler}</p>{/if}
		<div class="knoepfe">
			<button class="knopf zweit" type="button" onclick={() => dialog?.close()}>Abbrechen</button>
			<button class="knopf" type="submit">Übernehmen</button>
		</div>
	</form>
</dialog>

<style>
	.zieldialog {
		width: min(32rem, calc(100vw - 32px));
		padding: 0;
		border: 1px solid var(--bd);
		border-radius: 14px;
		background: var(--sf);
		color: var(--tx);
		box-shadow: var(--shadow);
	}
	.zieldialog::backdrop {
		background: rgb(0 0 0 / 0.4);
	}
	.innen {
		padding: 22px;
		display: grid;
		gap: 14px;
	}
	h2 {
		margin: 0;
		font-size: 1.2rem;
	}
	.symbole {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.symbole legend {
		font-weight: 600;
		margin-bottom: 6px;
	}
	.symbol input {
		position: absolute;
		opacity: 0;
	}
	.symbol .kachel {
		display: inline-grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 12px;
		border: 1px solid var(--bd);
		color: var(--ac);
		cursor: pointer;
	}
	.symbol input:checked + .kachel {
		background: var(--tint);
		border-color: var(--ac);
		box-shadow: inset 0 0 0 1px var(--ac);
	}
	.symbol input:focus-visible + .kachel {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.knoepfe {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 8px;
	}
	@media (max-width: 599px) {
		.zieldialog {
			width: 100%;
			max-width: 100%;
			margin: auto 0 0;
			border-radius: 16px 16px 0 0;
		}
		.knoepfe {
			flex-direction: column-reverse;
		}
		.knoepfe .knopf {
			width: 100%;
		}
	}
</style>
