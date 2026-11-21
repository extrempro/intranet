<script lang="ts">
	/**
	 * Hauptmenü auf PC und Tablet (Kap. 6): ausgeklappt mit aufklappbaren
	 * Bereichen oder eingeklappt als Symbolleiste mit Ausklappliste. Der Stand
	 * wird je Gerät gemerkt (Cookie, src/lib/menue.ts). Ohne gemerkten Stand:
	 * Tablet eingeklappt, PC ausgeklappt (per CSS, über data-menue an .app).
	 */
	/* eslint-disable svelte/no-navigation-without-resolve -- Ziele kommen aus dem festen Register in nav.ts */
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import Kopfsuche from './Kopfsuche.svelte';
	import { menueSpeichern, type Menuestand } from '#lib/menue.ts';
	import type { NavArea, NavPage } from '#lib/nav.ts';

	let {
		areas,
		aktuell,
		zahl,
		stand = $bindable(),
		inTeams,
		werkzeuge,
		unten
	}: {
		areas: NavArea[];
		aktuell: { area: NavArea | null; page: NavPage | null };
		zahl: (key: string) => number;
		stand: Menuestand;
		inTeams: boolean;
		/** In Teams (PC) ohne Kopfzeile: Werkzeuge oben im Menü; schmal = untereinander */
		werkzeuge?: Snippet<[boolean]>;
		/** Symbole unten (Neu im Intranet, Datenschutz, Impressum); schmal = untereinander */
		unten: Snippet<[boolean]>;
	} = $props();

	const PFEIL = 'M9 6l6 6l-6 6';
	const EINKLAPPEN = 'M11 7l-5 5l5 5M17 7l-5 5l5 5';
	const AUSKLAPPEN = 'M7 7l5 5l-5 5M13 7l5 5l-5 5';
	const LUPE = 'M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M21 21l-6 -6';

	function speichern() {
		menueSpeichern(stand, inTeams);
	}

	/** Gerade sichtbar eingeklappt? Ohne gemerkten Stand entscheidet die Breite. */
	function istZu(): boolean {
		if (stand.zu !== null) return stand.zu;
		return !matchMedia('(min-width: 1024px)').matches;
	}

	function umschalten() {
		stand.zu = !istZu();
		flyout = null;
		speichern();
	}

	const offen = (a: NavArea) => aktuell.area?.key === a.key || stand.offen.includes(a.key);

	function bereichUmschalten(a: NavArea) {
		stand.offen = stand.offen.includes(a.key)
			? stand.offen.filter((k) => k !== a.key)
			: [...stand.offen, a.key];
		speichern();
	}

	// Eingeklappt: Ausklappliste neben dem Symbol
	let flyout = $state<{ key: string; top: number } | null>(null);
	let leiste: HTMLDivElement | undefined = $state();
	let liste: HTMLDivElement | undefined = $state();

	function flyoutUmschalten(a: NavArea, e: MouseEvent) {
		if (flyout?.key === a.key) {
			flyout = null;
			return;
		}
		const knopf = e.currentTarget as HTMLElement;
		const oben = leiste?.getBoundingClientRect().top ?? 0;
		flyout = { key: a.key, top: knopf.getBoundingClientRect().top - oben };
	}

	afterNavigate(() => (flyout = null));

	function aufTaste(e: KeyboardEvent) {
		if (flyout && e.key === 'Escape') {
			const key = flyout.key;
			flyout = null;
			leiste?.querySelector<HTMLElement>(`[data-bereich="${key}"]`)?.focus();
		}
	}
	function aufKlick(e: MouseEvent) {
		if (!flyout) return;
		const ziel = e.target as Node;
		if (!liste?.contains(ziel) && !leiste?.contains(ziel)) flyout = null;
	}

	const flyoutBereich = $derived(flyout ? areas.find((a) => a.key === flyout!.key) : null);
</script>

<svelte:window onkeydown={aufTaste} onclick={aufKlick} />

<nav class="seitenleiste" aria-label="Hauptnavigation" data-tour="navigation">
	<!-- Ausgeklappt -->
	<div class="voll">
		{#if werkzeuge}
			<div class="werkzeuge">{@render werkzeuge(true)}</div>
		{/if}
		<Kopfsuche ort="seite" />
		<div class="trenner" aria-hidden="true"></div>
		<ul class="bereiche">
			{#each areas as area (area.key)}
				{@const an = aktuell.area?.key === area.key}
				{@const mitUnter = area.pages.length > 1}
				<li>
					<div class="zeile">
						<a
							class="bereich"
							class:an
							href={area.href}
							aria-current={an && !aktuell.page ? 'page' : undefined}
						>
							<Icon d={area.icon} size={22} stroke={1.6} />
							<span class="bereichsname">{area.label}</span>
							{#if zahl(area.key)}<span class="zahl" aria-label="{zahl(area.key)} neu">
									{zahl(area.key)}
								</span>{/if}
						</a>
						{#if mitUnter}
							{#if an}
								<span class="pfeil auf ruhig" aria-hidden="true">
									<Icon d={PFEIL} size={16} stroke={2} />
								</span>
							{:else}
								<button
									type="button"
									class="pfeil"
									class:auf={offen(area)}
									aria-expanded={offen(area)}
									aria-controls="unter-{area.key}"
									aria-label="{area.label}: Unterseiten {offen(area) ? 'zuklappen' : 'aufklappen'}"
									onclick={() => bereichUmschalten(area)}
								>
									<Icon d={PFEIL} size={16} stroke={2} />
								</button>
							{/if}
						{/if}
					</div>
					{#if mitUnter && offen(area)}
						<ul class="unter" id="unter-{area.key}">
							{#each area.pages as p (p.key)}
								<li>
									<a
										href={p.href}
										class:an={aktuell.page?.key === p.key}
										aria-current={aktuell.page?.key === p.key ? 'page' : undefined}
									>
										<span class="bereichsname">{p.label}</span>
										{#if zahl(p.key)}<span class="zahl" aria-label="{zahl(p.key)} neu">
												{zahl(p.key)}
											</span>{/if}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
		<div class="fuss">
			{@render unten(false)}
			<button
				type="button"
				class="umschalter"
				aria-label="Menü einklappen"
				data-tipp="Menü einklappen"
				onclick={umschalten}
			>
				<Icon d={EINKLAPPEN} size={20} stroke={1.8} />
			</button>
		</div>
	</div>

	<!-- Eingeklappt: nur Symbole -->
	<div class="schmal" bind:this={leiste}>
		{#if werkzeuge}
			<div class="werkzeuge untereinander">{@render werkzeuge(true)}</div>
		{/if}
		<a href={resolve('/(app)/suche')} class="symbol" aria-label="Suchen" data-tipp="Suchen">
			<Icon d={LUPE} size={22} stroke={1.6} />
		</a>
		<div class="trenner" aria-hidden="true"></div>
		<ul class="bereiche">
			{#each areas as area (area.key)}
				{@const an = aktuell.area?.key === area.key}
				<li>
					{#if area.pages.length > 1}
						<button
							type="button"
							class="symbol"
							class:an
							data-bereich={area.key}
							aria-expanded={flyout?.key === area.key}
							aria-controls="ausklapp"
							aria-label={area.label}
							data-tipp={flyout?.key === area.key ? null : area.label}
							onclick={(e) => flyoutUmschalten(area, e)}
						>
							<Icon d={area.icon} size={22} stroke={1.6} />
							{#if zahl(area.key)}<span class="punkt" aria-hidden="true"></span>{/if}
						</button>
					{:else}
						<a
							class="symbol"
							class:an
							href={area.href}
							aria-label={area.label}
							data-tipp={area.label}
							aria-current={an ? 'page' : undefined}
						>
							<Icon d={area.icon} size={22} stroke={1.6} />
						</a>
					{/if}
				</li>
			{/each}
		</ul>
		<div class="fuss">
			{@render unten(true)}
			<button
				type="button"
				class="symbol umschalter"
				aria-label="Menü ausklappen"
				data-tipp="Menü ausklappen"
				onclick={umschalten}
			>
				<Icon d={AUSKLAPPEN} size={20} stroke={1.8} />
			</button>
		</div>

		{#if flyout && flyoutBereich}
			<div
				id="ausklapp"
				class="ausklapp"
				bind:this={liste}
				style:top="{flyout.top}px"
				role="region"
				aria-label="Unterseiten von {flyoutBereich.label}"
			>
				<a class="kopfzeile" href={flyoutBereich.href}>{flyoutBereich.label}</a>
				<ul>
					{#each flyoutBereich.pages as p (p.key)}
						<li>
							<a
								href={p.href}
								class:an={aktuell.page?.key === p.key}
								aria-current={aktuell.page?.key === p.key ? 'page' : undefined}
							>
								<span class="bereichsname">{p.label}</span>
								{#if zahl(p.key)}<span class="zahl" aria-label="{zahl(p.key)} neu">
										{zahl(p.key)}
									</span>{/if}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</nav>

<style>
	.seitenleiste {
		display: none;
		flex: none;
		box-sizing: border-box;
		background: var(--sf);
		border-right: 1px solid var(--bd);
		/* Ausklappliste und Kontomenü liegen über dem Inhalt */
		position: relative;
		z-index: 25;
	}
	.voll,
	.schmal {
		display: none;
		position: sticky;
		top: var(--menue-oben, 61px);
		flex-direction: column;
		box-sizing: border-box;
		/* Feste Höhe: lange Listen scrollen, die Symbole unten bleiben sichtbar */
		height: calc(100dvh - var(--menue-oben, 61px));
	}
	.voll {
		width: 260px;
		padding: 20px 16px;
	}
	.schmal {
		width: 76px;
		padding: 16px 12px;
		align-items: center;
	}
	/* Nur in Teams auf dem PC (dort fehlt die Kopfzeile), siehe unten */
	.werkzeuge {
		display: none;
		align-items: center;
		gap: 4px;
		margin-bottom: 12px;
	}
	.werkzeuge.untereinander {
		flex-direction: column;
	}
	.werkzeuge :global(form.ohne-xs) {
		display: inline-flex;
	}
	.trenner {
		height: 1px;
		align-self: stretch;
		background: var(--bd);
		margin: 18px 4px 14px;
	}
	.bereiche {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	/* Ausgeklappt: lange Listen scrollen (Rand für den Fokusrahmen) */
	.voll .bereiche {
		flex: 0 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 4px;
		margin: -4px;
	}
	.zeile {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.bereich {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 48px;
		padding: 11px 14px;
		box-sizing: border-box;
		border-radius: 10px;
		color: var(--mu);
		text-decoration: none;
		font-size: 15px;
		font-weight: 500;
		transition:
			background 0.15s,
			color 0.15s;
	}
	.bereich:hover {
		background: var(--bg);
		color: var(--tx);
	}
	.bereich.an {
		background: var(--tint);
		color: var(--ac);
		font-weight: 600;
	}
	.pfeil {
		flex: none;
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--mu);
		cursor: pointer;
		padding: 0;
	}
	.pfeil :global(svg) {
		transition: transform 0.15s;
	}
	.pfeil.auf :global(svg) {
		transform: rotate(90deg);
	}
	button.pfeil:hover {
		background: var(--bg);
		color: var(--tx);
	}
	.pfeil.ruhig {
		cursor: default;
		opacity: 0.5;
	}
	.unter {
		list-style: none;
		margin: 2px 0 8px 25px;
		padding-left: 12px;
		border-left: 1px solid var(--bd);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.unter a,
	.ausklapp li a {
		display: flex;
		align-items: center;
		min-height: 40px;
		padding: 8px 12px;
		box-sizing: border-box;
		border-radius: 8px;
		color: var(--mu);
		text-decoration: none;
		font-size: 14px;
	}
	.unter a:hover,
	.ausklapp li a:hover {
		background: var(--bg);
		color: var(--tx);
	}
	.unter a.an,
	.ausklapp li a.an {
		color: var(--ac);
		font-weight: 600;
	}
	.bereichsname {
		flex: 1;
	}
	.zahl {
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		box-sizing: border-box;
		border-radius: 999px;
		background: #f5a524;
		color: #3a2300;
		font-size: 12px;
		font-weight: 700;
		line-height: 22px;
		text-align: center;
	}
	.fuss {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 4px;
		margin-top: auto;
		padding-top: 16px;
	}
	.schmal .fuss {
		flex-direction: column;
		align-self: stretch;
	}
	.fuss > :global(.infosymbole) {
		margin-top: 0;
		padding-top: 0;
	}
	.schmal .fuss > :global(.infosymbole) {
		border-top: 0;
		margin-top: 0;
	}

	/* Symbole (eingeklappt) und Umschalter */
	.symbol,
	.umschalter {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border: 0;
		border-radius: 12px;
		background: transparent;
		color: var(--mu);
		cursor: pointer;
		padding: 0;
		text-decoration: none;
	}
	.umschalter {
		width: 40px;
		height: 40px;
		border-radius: 10px;
	}
	.symbol:hover,
	.umschalter:hover,
	.symbol[aria-expanded='true'] {
		background: var(--bg);
		color: var(--tx);
	}
	.symbol.an {
		background: var(--tint);
		color: var(--ac);
	}
	.punkt {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 9px;
		height: 9px;
		border-radius: 999px;
		background: #f5a524;
	}
	/* Beschriftung beim Überfahren und bei Tastaturfokus */
	[data-tipp]::after {
		content: attr(data-tipp);
		position: absolute;
		left: calc(100% + 8px);
		top: 50%;
		transform: translateY(-50%);
		padding: 4px 8px;
		border-radius: 6px;
		background: var(--tx);
		color: var(--sf);
		font-size: 12px;
		font-weight: 500;
		white-space: nowrap;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.12s;
		z-index: 30;
	}
	.voll .umschalter::after {
		left: auto;
		right: 0;
		top: auto;
		bottom: calc(100% + 6px);
		transform: none;
	}
	[data-tipp]:hover::after,
	[data-tipp]:focus-visible::after {
		opacity: 1;
	}

	/* Ausklappliste neben der Symbolleiste */
	.ausklapp {
		position: absolute;
		left: calc(100% + 8px);
		min-width: 220px;
		padding: 8px;
		box-sizing: border-box;
		border: 1px solid var(--bd);
		border-radius: 12px;
		background: var(--sf);
		box-shadow: var(--shadow);
		z-index: 40;
	}
	.ausklapp .kopfzeile {
		display: block;
		padding: 8px 12px 6px;
		color: var(--tx);
		font-weight: 600;
		text-decoration: none;
	}
	.ausklapp .kopfzeile:hover {
		text-decoration: underline;
	}
	.ausklapp ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	/* Sichtbar ab Tablet; welcher Teil, entscheidet data-menue an .app */
	@media (min-width: 600px) {
		.seitenleiste {
			display: block;
		}
		:global(.app[data-menue='auf']) .voll,
		:global(.app[data-menue='zu']) .schmal {
			display: flex;
		}
	}
	@media (min-width: 600px) and (max-width: 1023px) {
		:global(.app[data-menue='auto']) .schmal {
			display: flex;
		}
	}
	@media (min-width: 1024px) {
		:global(.app[data-menue='auto']) .voll {
			display: flex;
		}
		.werkzeuge {
			display: flex;
		}
		/* In Teams gibt es auf dem PC keine eigene Kopfzeile */
		:global(.app.teams) .seitenleiste {
			--menue-oben: 0px;
		}
	}
</style>
