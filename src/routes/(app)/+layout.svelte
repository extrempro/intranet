<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Ziele kommen aus dem festen Register in nav.ts, kein Base-Pfad */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import BestaetigenDialog from '#lib/components/BestaetigenDialog.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Kontomenue from '#lib/components/Kontomenue.svelte';
	import Hauptmenue from '#lib/components/Hauptmenue.svelte';
	import Kopfsuche from '#lib/components/Kopfsuche.svelte';
	import NeueVersion from '#lib/components/NeueVersion.svelte';
	import OfflineHinweis from '#lib/components/OfflineHinweis.svelte';
	import Tour from '#lib/components/Tour.svelte';
	import { hilfe } from '#lib/hilfe.svelte.ts';
	import { FUEHRUNG } from '#lib/tours.ts';
	import { currentNav, navAreas } from '#lib/nav.ts';

	let { data, children } = $props();

	const areas = navAreas();
	const aktuell = $derived(currentNav(areas, page.url.pathname));
	const seitentitel = $derived(aktuell.page?.label ?? aktuell.area?.label ?? 'Intranet');
	let wechselnOffen = $state(false);
	/** Hauptmenü ein-/ausgeklappt und offene Bereiche (je Gerät gemerkt) */
	let menue = $state(untrack(() => data.menue));

	/** Handy: Zurück zur übergeordneten Seite (Unterseite → Bereich, Detail → Unterseite). */
	const zurueck = $derived.by(() => {
		const a = aktuell.area;
		const p = aktuell.page;
		if (!a || !p) return null;
		if (page.url.pathname !== p.href) return { href: p.href, label: p.label };
		return { href: a.href, label: a.label };
	});

	/** Zähler „neu“ an Bereich und Unterseite (bisher: neue Neuigkeiten). */
	function zahl(key: string): number {
		return key === 'aktuelles' || key === 'neuigkeiten' ? (data.neueBeitraege ?? 0) : 0;
	}

	/** Tablet: drei Unterseiten sichtbar (plus die aktuelle), der Rest unter „Mehr“. */
	const reiter = $derived.by(() => {
		const alle = aktuell.area?.pages ?? [];
		if (alle.length <= 4) return { sichtbar: alle, mehr: [] };
		const sichtbar = alle.slice(0, 3);
		const cur = aktuell.page;
		if (cur && !sichtbar.some((p) => p.key === cur.key)) sichtbar.push(cur);
		return { sichtbar, mehr: alle.filter((p) => !sichtbar.includes(p)) };
	});
	let mehrOffen = $state(false);
	const PFEIL_RUNTER = 'M6 9l6 6l6 -6';

	/** Brotkrumen wie im Entwurf: Bereich › Unterseite (auf dem Handy ausgeblendet). */
	const krumen = $derived.by(() => {
		const a = aktuell.area;
		const p = aktuell.page;
		if (!a || !p || a.pages.length < 2) return [];
		const tiefer = page.url.pathname !== p.href;
		return [
			{ label: a.label, href: a.href, aktuell: false },
			{ label: p.label, href: p.href, aktuell: !tiefer }
		];
	});

	let theme = $derived(data.theme);

	/** Wirksame Darstellung: bei „auto“ entscheidet das System. */
	function istDunkel(t: string): boolean {
		if (t === 'dunkel') return true;
		if (t === 'hell') return false;
		return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
	}

	const SONNE =
		'M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0 -8M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7';
	const MOND = 'M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z';
	const BRIEF =
		'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2zM3 7l9 6l9 -6';
	const GLOCKE =
		'M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6M9 17v1a3 3 0 0 0 6 0v-1';
	const dunkel = $derived(istDunkel(theme));

	// Neu im Intranet, Datenschutz, Impressum: als Symbole unten im Hauptmenü
	const FUNKELN =
		'M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2zm-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z';
	const SCHILD =
		'M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3M11 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M12 12v2.5';
	const INFO = 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0M12 9h.01M11 12h1v4h1';

	// Führung beim ersten Start bzw. auf Wunsch (?fuehrung=1) – Kap. 13
	$effect.pre(() => {
		hilfe.setzeGesehen(data.hilfeGesehen);
	});
	let gestartetFuer = '';
	$effect(() => {
		const href = page.url.href;
		if (page.url.pathname !== '/' || gestartetFuer === href) return;
		const gewuenscht = page.url.searchParams.get('fuehrung') === '1';
		if (gewuenscht || !untrack(() => hilfe.istGesehen(FUEHRUNG.key))) {
			gestartetFuer = href;
			// Erst wenn die Startseite steht
			setTimeout(() => hilfe.starten(FUEHRUNG), 300);
		}
	});
	// Rückmeldung geben: Daumen hoch und runter (wie im Ausbildungsportal, für etwa 26–30 px)
	const RUECKMELDUNG =
		'M1 8.5h2.2V14H1zM3.2 9l2.4-4.6a1.4 1.4 0 0 1 1.5 1.4v2.4h2.6a1.3 1.3 0 0 1 1.3 1.6l-.7 3.2a1.5 1.5 0 0 1-1.5 1.2H3.2M23 15.5h-2.2V10H23zM20.8 15l-2.4 4.6a1.4 1.4 0 0 1-1.5-1.4v-2.4h-2.6a1.3 1.3 0 0 1-1.3-1.6l.7-3.2a1.5 1.5 0 0 1 1.5-1.2h5.6';
</script>

<a class="skip" href="#inhalt">Zum Inhalt springen</a>

<BestaetigenDialog />

{#if hilfe.aktiv}
	{#key hilfe.aktiv.key}<Tour tour={hilfe.aktiv} />{/key}
{/if}

{#snippet werkzeuge(links: boolean)}
	<form
		class="ohne-xs"
		method="POST"
		action="/konto/darstellung?/umschalten"
		use:enhance={({ formData }) => {
			const neu = dunkel ? 'hell' : 'dunkel';
			formData.set('wert', neu);
			theme = neu;
			document.documentElement.dataset.theme = neu;
			return async () => {};
		}}
	>
		<button
			type="submit"
			class="symbolknopf"
			aria-label={dunkel ? 'Helle Darstellung' : 'Dunkle Darstellung'}
			title={dunkel ? 'Helle Darstellung' : 'Dunkle Darstellung'}
		>
			<Icon d={dunkel ? SONNE : MOND} size={20} stroke={1.8} />
		</button>
	</form>

	<a
		class="symbolknopf"
		data-tour="rueckmeldung"
		href="{resolve('/(app)/rueckmeldung/neu')}?von={encodeURIComponent(
			page.url.pathname + page.url.search
		)}"
		aria-label="Rückmeldung geben"
		title="Rückmeldung: Fehler oder Idee"
	>
		<Icon d={RUECKMELDUNG} size={28} stroke={1.8} />
	</a>

	<a
		class="symbolknopf glocke"
		data-tour="nachrichten"
		href={resolve('/(app)/nachrichten')}
		aria-label={data.nachrichten
			? `Nachrichten, ${data.nachrichten} mit neuen Antworten`
			: 'Nachrichten'}
		title="Nachrichten"
		aria-current={page.url.pathname.startsWith('/nachrichten') ? 'page' : undefined}
	>
		<Icon d={BRIEF} size={20} stroke={1.8} />
		{#if data.nachrichten}<span class="zaehler akzentzahl" aria-hidden="true">
				{data.nachrichten > 99 ? '99+' : data.nachrichten}
			</span>{/if}
	</a>

	<a
		class="symbolknopf glocke umrandet"
		data-tour="glocke"
		href={resolve('/(app)/benachrichtigungen')}
		aria-label={data.ungelesen
			? `Benachrichtigungen, ${data.ungelesen} ungelesen`
			: 'Benachrichtigungen'}
		title="Benachrichtigungen"
		aria-current={page.url.pathname === '/benachrichtigungen' ? 'page' : undefined}
	>
		<Icon d={GLOCKE} size={20} stroke={1.8} />
		{#if data.ungelesen}<span class="zaehler" aria-hidden="true">
				{data.ungelesen > 99 ? '99+' : data.ungelesen}
			</span>{/if}
	</a>

	<span class="nur-gross-flex">
		<Kontomenue
			{links}
			name={data.ich.name}
			kuerzel={data.ich.kuerzel}
			foto={data.ich.foto}
			mandant={data.ich.mandant}
			darfVerwaltung={data.darfVerwaltung}
			darfRedaktion={data.darfRedaktion}
		/>
	</span>
{/snippet}

{#snippet infoSymbole(schmal: boolean)}
	<div class={['infosymbole', schmal && 'schmal']}>
		<a
			href={resolve('/(app)/neu-im-intranet')}
			class="infosymbol"
			aria-label="Neu im Intranet (Version {data.version})"
			data-tipp="Neu im Intranet · Version {data.version}"
			aria-current={page.url.pathname === '/neu-im-intranet' ? 'page' : undefined}
		>
			<Icon d={FUNKELN} size={20} stroke={1.7} />
		</a>
		{#if data.rechtliches.datenschutz}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- externer Link -->
			<a
				href={data.rechtliches.datenschutz}
				target="_blank"
				rel="noopener"
				class="infosymbol"
				aria-label="Datenschutz (öffnet in neuem Fenster)"
				data-tipp="Datenschutz"
			>
				<Icon d={SCHILD} size={20} stroke={1.7} />
			</a>
		{/if}
		{#if data.rechtliches.impressum}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- externer Link -->
			<a
				href={data.rechtliches.impressum}
				target="_blank"
				rel="noopener"
				class="infosymbol"
				aria-label="Impressum (öffnet in neuem Fenster)"
				data-tipp="Impressum"
			>
				<Icon d={INFO} size={20} stroke={1.7} />
			</a>
		{/if}
	</div>
{/snippet}

<div
	class="app akzent"
	class:teams={data.inTeams}
	style={data.akzent}
	data-menue={menue.zu === null ? 'auto' : menue.zu ? 'zu' : 'auf'}
>
	<header class="kopf">
		{#if zurueck}
			<a
				class="symbolknopf nur-handy-flex"
				href={zurueck.href}
				aria-label="Zurück zu {zurueck.label}"
			>
				<Icon d="M15 6l-6 6l6 6" size={22} stroke={2} />
			</a>
		{/if}
		<a
			class="marke"
			class:ohne-handy={zurueck}
			href={resolve('/(app)')}
			aria-label="Intranet, zur Startseite"
		>
			{#if data.logo.hell}
				<img class="logobild logo-hell" src={data.logo.hell} alt="" />
				<img class="logobild logo-dunkel" src={data.logo.dunkel} alt="" />
			{:else}
				<span class="logo" aria-hidden="true">{data.ich.mandantKurz}</span>
			{/if}
			<span class="name nur-gross">Intranet</span>
		</a>
		<span class="titel nur-handy" aria-hidden="true">{seitentitel}</span>

		<Kopfsuche ort="kopf" />
		<span class="luecke nur-gross"></span>

		{@render werkzeuge(false)}
	</header>

	<div class="rumpf">
		<!-- PC und Tablet: Hauptmenü, aus- oder eingeklappt -->
		<Hauptmenue
			{areas}
			{aktuell}
			{zahl}
			bind:stand={menue}
			inTeams={data.inTeams}
			werkzeuge={data.inTeams ? werkzeuge : undefined}
			unten={infoSymbole}
		/>

		<div class="spalte">
			{#if aktuell.area && aktuell.area.pages.length > 1}
				<!-- Handy: Unterseite wechseln -->
				<div class="wechseln">
					<button
						type="button"
						class="wechselkarte"
						aria-expanded={wechselnOffen}
						aria-controls="unterseiten"
						onclick={() => (wechselnOffen = !wechselnOffen)}
					>
						<span class="wk-text">
							<span class="wk-bereich">{aktuell.area.label}</span>
							<strong>{aktuell.page?.label ?? aktuell.area.label}</strong>
						</span>
						<span class="wk-aktion">
							Wechseln <Icon d={PFEIL_RUNTER} size={16} stroke={2} />
						</span>
					</button>
					{#if wechselnOffen}
						<ul id="unterseiten" class="blatt">
							{#each aktuell.area.pages as p (p.key)}
								<li>
									<a
										href={p.href}
										aria-current={aktuell.page?.key === p.key ? 'page' : undefined}
										onclick={() => (wechselnOffen = false)}
									>
										{p.label}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}

			<main id="inhalt" tabindex="-1">
				{#if krumen.length}
					<nav class="krumen" aria-label="Pfad">
						{#each krumen as k, i (i)}
							{#if i}<span aria-hidden="true">›</span>{/if}
							{#if k.aktuell}
								<span aria-current="page">{k.label}</span>
							{:else}
								<a href={k.href}>{k.label}</a>
							{/if}
						{/each}
					</nav>
				{/if}
				{#if aktuell.area && aktuell.area.pages.length > 1}
					<!-- Tablet: Unterseiten als Pillen, der Rest unter „Mehr“ -->
					<nav class="reiter" aria-label="Unterseiten von {aktuell.area.label}">
						{#each reiter.sichtbar as p (p.key)}
							<a
								class="pille"
								href={p.href}
								aria-current={aktuell.page?.key === p.key ? 'page' : undefined}
							>
								{p.label}
							</a>
						{/each}
						{#if reiter.mehr.length}
							<details class="mehr" bind:open={mehrOffen}>
								<summary class="pille"> Mehr </summary>
								<ul class="mehrliste">
									{#each reiter.mehr as p (p.key)}
										<li>
											<a href={p.href} onclick={() => (mehrOffen = false)}>{p.label}</a>
										</li>
									{/each}
								</ul>
							</details>
						{/if}
					</nav>
				{/if}
				<NeueVersion neu={data.neuInVersion} />
				<OfflineHinweis />
				{#if data.meldung}<p class="meldung oben" role="status">{data.meldung}</p>{/if}
				{@render children()}
			</main>
		</div>
	</div>

	<!-- Handy: Leiste unten -->
	<nav class="unten" aria-label="Hauptnavigation" data-tour="navigation">
		{#each areas as area (area.key)}
			{@const an = aktuell.area?.key === area.key}
			<a href={area.href} class:an aria-current={an ? 'page' : undefined}>
				<span class="symbol">
					<Icon d={area.icon} />{#if zahl(area.key)}<span
							class="zahl klein"
							aria-label="{zahl(area.key)} neu"
						>
							{zahl(area.key)}
						</span>{/if}
				</span>
				<span>{area.kurz ?? area.label}</span>
			</a>
		{/each}
		<a
			href={resolve('/(app)/konto')}
			data-tour="konto"
			class:an={page.url.pathname.startsWith('/konto')}
			aria-current={page.url.pathname === '/konto' ? 'page' : undefined}
		>
			<span class="symbol konto-symbol">
				{#if data.ich.foto}<img src={data.ich.foto} alt="" />{:else}{data.ich.kuerzel}{/if}
			</span>
			<span>Konto</span>
		</a>
	</nav>
</div>

<style>
	.app {
		min-height: 100vh;
		background: var(--bg);
		display: flex;
		flex-direction: column;
	}

	/* ---- Kopfzeile ---- */
	.kopf {
		position: sticky;
		top: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: max(8px, env(safe-area-inset-top)) 12px 8px;
		background: var(--sf);
		border-bottom: 1px solid var(--bd);
	}
	.marke {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--tx);
		text-decoration: none;
		min-height: 44px;
	}
	.logo {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: var(--fill);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 13px;
	}
	.name {
		font-weight: 700;
		font-size: 17px;
	}
	.logobild {
		height: 34px;
		width: auto;
		max-width: 160px;
		object-fit: contain;
	}
	.logo-dunkel {
		display: none;
	}
	:global([data-theme='dunkel']) .logo-hell {
		display: none;
	}
	:global([data-theme='dunkel']) .logo-dunkel {
		display: block;
	}
	@media (prefers-color-scheme: dark) {
		:global([data-theme='auto']) .logo-hell {
			display: none;
		}
		:global([data-theme='auto']) .logo-dunkel {
			display: block;
		}
	}
	.titel {
		font-weight: 700;
		font-size: 17px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.luecke {
		flex: 1;
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
	.symbolknopf:hover {
		background: var(--bg);
	}
	.umrandet {
		border: 1px solid var(--bd);
	}

	.glocke {
		position: relative;
		text-decoration: none;
	}
	.zaehler {
		position: absolute;
		top: -5px;
		right: -5px;
		min-width: 20px;
		height: 20px;
		padding: 0 5px;
		box-sizing: border-box;
		border-radius: 999px;
		background: #c0392b;
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		line-height: 20px;
		text-align: center;
	}

	.akzentzahl {
		top: -3px;
		right: -3px;
		background: var(--fill);
	}

	/* ---- Rumpf ---- */
	.rumpf {
		display: flex;
		flex: 1;
		min-width: 0;
	}
	.spalte {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	main {
		width: 100%;
		max-width: 1120px;
		box-sizing: border-box;
		margin: 0 auto;
		padding: 24px 24px 48px;
	}
	main:focus {
		outline: none;
	}

	.infosymbole {
		display: flex;
		gap: 4px;
		margin-top: auto;
		padding-top: 16px;
	}
	.infosymbole.schmal {
		flex-direction: column;
		align-items: center;
		margin-top: 8px;
		padding-top: 12px;
		border-top: 1px solid var(--bd);
		width: 100%;
	}
	.infosymbol {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 10px;
		color: var(--mu);
	}
	.infosymbol:hover,
	.infosymbol[aria-current='page'] {
		background: var(--bg);
		color: var(--tx);
	}
	/* Beschriftung beim Überfahren und bei Tastaturfokus */
	.infosymbol::after {
		content: attr(data-tipp);
		position: absolute;
		left: 50%;
		bottom: calc(100% + 6px);
		transform: translateX(-50%);
		padding: 4px 8px;
		border-radius: 6px;
		background: var(--tx);
		color: var(--sf);
		font-size: 12px;
		white-space: nowrap;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.12s;
		z-index: 30;
	}
	.schmal .infosymbol::after {
		left: calc(100% + 6px);
		bottom: auto;
		top: 50%;
		transform: translateY(-50%);
	}
	.infosymbol:hover::after,
	.infosymbol:focus-visible::after {
		opacity: 1;
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
	.symbol {
		position: relative;
		display: inline-flex;
	}
	.zahl.klein {
		position: absolute;
		top: -6px;
		right: -10px;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		font-size: 11px;
		line-height: 18px;
	}

	/* Brotkrumen */
	.krumen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--mu);
		margin-bottom: 12px;
	}
	.krumen a {
		color: var(--mu);
		text-decoration: none;
	}
	.krumen a:hover {
		text-decoration: underline;
	}
	.krumen [aria-current='page'] {
		color: var(--tx);
	}

	/* Tablet-Leiste */
	.unten a {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 6px 4px;
		min-height: 52px;
		box-sizing: border-box;
		width: 100%;
		border-radius: 14px;
		color: var(--tx);
		text-decoration: none;
		font-size: 12px;
		font-weight: 600;
	}
	.unten a.an :global(svg) {
		background: var(--tint);
		color: var(--ac);
		border-radius: 999px;
		padding: 4px 14px;
	}
	.unten a.an {
		color: var(--ac);
	}

	.reiter {
		display: none;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
	}
	.mehr {
		position: relative;
	}
	.mehrliste {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 30;
		min-width: 220px;
		list-style: none;
		margin: 0;
		padding: 6px;
		background: var(--sf);
		border: 1px solid var(--bd);
		border-radius: 14px;
		box-shadow: var(--shadow);
	}
	.mehrliste a {
		display: flex;
		align-items: center;
		min-height: 44px;
		padding: 0 12px;
		border-radius: 10px;
		color: var(--tx);
		text-decoration: none;
	}
	.mehrliste a:hover {
		background: var(--bg);
	}

	.wechseln {
		display: none;
		padding: 12px 14px 0;
	}
	.wechselkarte {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		min-height: 56px;
		padding: 10px 14px;
		box-sizing: border-box;
		border: 1px solid var(--bd);
		border-radius: 14px;
		background: var(--sf);
		color: var(--tx);
		font: inherit;
		text-align: left;
		cursor: pointer;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.06);
	}
	.wk-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.wk-bereich {
		font-size: 12px;
		color: var(--mu);
		font-weight: 600;
	}
	.wk-text strong {
		font-size: 17px;
	}
	.wk-aktion {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--ac);
		font-weight: 600;
		font-size: 14px;
	}
	.blatt {
		list-style: none;
		margin: 8px 0 0;
		padding: 8px;
		background: var(--sf);
		border: 1px solid var(--bd);
		border-radius: 14px;
		box-shadow: var(--shadow);
	}
	.blatt a {
		display: flex;
		align-items: center;
		min-height: 44px;
		padding: 0 12px;
		color: var(--tx);
		text-decoration: none;
		border-radius: 10px;
	}
	.blatt a[aria-current='page'] {
		background: var(--tint);
		color: var(--ac);
		font-weight: 600;
	}

	/* Handy-Leiste unten */
	.unten {
		display: none;
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 30;
		padding: 6px 8px max(6px, env(safe-area-inset-bottom));
		background: var(--sf);
		border-top: 1px solid var(--bd);
		justify-content: space-around;
	}
	.unten a {
		flex: 1;
		max-width: 120px;
	}

	.nur-handy,
	.nur-handy-flex {
		display: none;
	}
	.nur-gross-flex {
		display: inline-flex;
	}
	.konto-symbol {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		background: var(--tint);
		color: var(--ac);
		font-size: 11px;
		font-weight: 700;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.konto-symbol img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.unten a.an .konto-symbol {
		outline: 2px solid var(--ac);
		outline-offset: 1px;
	}

	/* ---- Geräte ---- */
	@media (max-width: 419px) {
		.ohne-xs {
			display: none;
		}
	}
	@media (min-width: 1024px) {
		/* Teams zeigt oben schon App-Name und Symbol: keine eigene Kopfzeile */
		.app.teams .kopf {
			display: none;
		}
	}
	/* Unterseiten als Pillen, wenn das Hauptmenü eingeklappt ist */
	@media (min-width: 600px) {
		.app[data-menue='zu'] .reiter {
			display: flex;
		}
	}
	@media (min-width: 600px) and (max-width: 1023px) {
		.app[data-menue='auto'] .reiter {
			display: flex;
		}
	}
	/* In Teams auf Tablet und Handy: Kopfzeile ohne Logo (Teams zeigt den App-Namen) */
	.app.teams .marke {
		display: none;
	}
	@media (max-width: 599px) {
		.unten {
			display: flex;
		}
		.wechseln {
			display: block;
		}
		.nur-gross {
			display: none;
		}
		.nur-handy {
			display: block;
		}
		.nur-handy-flex {
			display: inline-flex;
		}
		.nur-gross-flex,
		.marke.ohne-handy {
			display: none;
		}
		.titel {
			flex: 1;
		}
		.krumen {
			display: none;
		}
		.kopf {
			padding-left: 8px;
			padding-right: 8px;
		}
		main {
			padding: 16px 14px 160px;
		}
	}
</style>
