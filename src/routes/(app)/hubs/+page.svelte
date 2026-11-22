<script lang="ts">
	/**
	 * Hubs (Kap. 8.12): oben „Deine Hubs“ mit neuen Beiträgen, darunter alle
	 * aktiven Hubs zum Entdecken (Suche, Sortierung, Mandant), ruhende
	 * eingeklappt, am Ende „Hub beantragen“. Lange Liste nach Kap. 6.7.
	 */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { actionUrl } from '#lib/action-url.ts';
	import Icon from '#lib/components/Icon.svelte';
	import { matchesSearch } from '#lib/departments.ts';
	import { mitZahl } from '#lib/lange-liste.ts';

	let { data, form } = $props();
	type Hub = (typeof data.hubs)[number];

	const SCHRITT = 9;
	let suche = $state('');
	let fuer = $state('');
	let sortierung = $state<'aktiv' | 'beliebt' | 'az'>('aktiv');
	let anzahl = $state(SCHRITT);
	let ruhendeOffen = $state(false);
	let ansage = $state('');

	const mandanten = $derived(
		[...new Set(data.hubs.filter((h) => !h.isCentral).map((h) => h.tenantShort))].sort()
	);
	const passt = (h: Hub) =>
		matchesSearch(suche, [h.name, h.about]) &&
		(!fuer || (fuer === 'alle' ? h.isCentral : !h.isCentral && h.tenantShort === fuer));
	const meine = $derived(
		data.hubs
			.filter((h) => h.subscribed)
			.sort((a, b) => b.neu - a.neu || a.name.localeCompare(b.name, 'de'))
	);
	const aktive = $derived(
		data.hubs
			.filter((h) => !h.resting && passt(h))
			.sort((a, b) =>
				sortierung === 'az'
					? a.name.localeCompare(b.name, 'de')
					: sortierung === 'beliebt'
						? b.abos - a.abos || a.name.localeCompare(b.name, 'de')
						: b.proMonat - a.proMonat || a.name.localeCompare(b.name, 'de')
			)
	);
	const sichtbar = $derived(aktive.slice(0, anzahl));
	const rest = $derived(aktive.length - sichtbar.length);
	const ruhende = $derived(data.hubs.filter((h) => h.resting && passt(h)));

	let raster = $state<HTMLUListElement>();
	async function weitere() {
		const vorher = sichtbar.length;
		const dazu = Math.min(SCHRITT, rest);
		anzahl += SCHRITT;
		await tick();
		raster?.querySelectorAll<HTMLElement>('li')[vorher]?.querySelector<HTMLElement>('a')?.focus();
		ansage = `${mitZahl(dazu, 'weiterer Hub', 'weitere Hubs')} angezeigt.`;
	}
	function filtern(f: () => void) {
		f();
		anzahl = SCHRITT;
	}

	const tag = new Intl.DateTimeFormat('de-DE', {
		day: '2-digit',
		month: '2-digit',
		timeZone: 'Europe/Berlin'
	});
	function zuletzt(d: Date | null): string {
		if (!d) return 'Noch keine Beiträge';
		const tage = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
		if (tage < 1) return 'Letzter Beitrag heute';
		if (tage < 2) return 'Letzter Beitrag gestern';
		if (tage < 7) return `Letzter Beitrag vor ${tage} Tagen`;
		return `Letzter Beitrag am ${tag.format(new Date(d))}`;
	}
	const FARBEN = ['ton1', 'ton2', 'ton3', 'ton4', 'ton5', 'ton6'];
	const ton = (name: string) =>
		FARBEN[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % FARBEN.length];
	const href = (h: Hub) => resolve('/(app)/hubs/[slug]', { slug: h.slug });

	const PLUS = 'M12 5v14M5 12h14';
	const GLOCKE =
		'M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6M9 17v1a3 3 0 0 0 6 0v-1';
	const SCHLOSS =
		'M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2zM8 11v-4a4 4 0 1 1 8 0v4';
	const PFEIL = 'M9 6l6 6l-6 6';
</script>

<svelte:head><title>Hubs · Intranet</title></svelte:head>

{#snippet symbol(h: Hub, gross: boolean)}
	{#if h.iconUrl}
		<img class="symbol" class:gross src={h.iconUrl} alt="" />
	{:else}
		<span class="symbol buchstabe {ton(h.name)}" class:gross aria-hidden="true">
			{h.name.charAt(0)}
		</span>
	{/if}
{/snippet}

<div class="stapel">
	<div class="kopfzeile">
		<div class="kopftext">
			<div class="titel">
				<h1>Hubs</h1>
				<form method="POST" action={actionUrl(page.url.search, 'favorit')} use:enhance>
					<button
						class="stern"
						type="submit"
						aria-pressed={data.favorit}
						aria-label={data.favorit
							? 'Aus den Favoriten entfernen'
							: 'Zu den Favoriten hinzufügen'}
					>
						{data.favorit ? '★' : '☆'}
					</button>
				</form>
			</div>
			<p class="hinweis">
				Themen über Abteilungen hinweg. Abonnierst du einen Hub, erscheinen seine Beiträge unter
				„Aus den Hubs“.
			</p>
		</div>
		<div class="aktionen">
			{#if data.antraegePruefen}
				<a class="knopf zweit" href={resolve('/(app)/hubs/antraege')}>Anträge prüfen</a>
			{/if}
			<a class="knopf zweit" href={resolve('/(app)/hubs/beantragen')}>
				<Icon d={PLUS} size={18} stroke={2} />Hub beantragen
			</a>
		</div>
	</div>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}
	{#if data.offeneAntraege}
		<p class="meldung" role="status">
			Dein Antrag wird geprüft. Rückfragen kommen als <a href={resolve('/(app)/nachrichten')}>
				Nachricht
			</a>.
		</p>
	{/if}

	<section class="abschnitt" aria-labelledby="h-meine">
		<div class="abschnittkopf">
			<h2 id="h-meine">Deine Hubs <span class="anzahl">{meine.length}</span></h2>
			<a class="aktionslink" href={resolve('/(app)/aus-den-hubs')}>
				Alle Beiträge aus deinen Hubs →
			</a>
		</div>
		{#if meine.length === 0}
			<p class="leer">
				Du hast noch keinen Hub abonniert. Unten findest du alle Themen; tipp auf „Abonnieren“.
			</p>
		{:else}
			<ul class="meine">
				{#each meine as h (h.id)}
					<li>
						<a class="karte zeile" href={href(h)}>
							{@render symbol(h, false)}
							<span class="text">
								<strong>{h.name}</strong>
								<span class="unter">{zuletzt(h.zuletzt)}</span>
							</span>
							{#if h.neu}<span class="neu">{h.neu} neu</span>{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="abschnitt" aria-labelledby="h-alle">
		<h2 id="h-alle">Alle Hubs entdecken</h2>
		<div class="werkzeuge">
			<label class="feld suche">
				<span class="sr-only">Hubs durchsuchen</span>
				<input
					type="search"
					bind:value={suche}
					oninput={() => (anzahl = SCHRITT)}
					placeholder="Thema oder Stichwort"
				/>
			</label>
			<div class="segment" role="group" aria-label="Sortieren">
				{#each [['aktiv', 'Aktiv'], ['beliebt', 'Beliebt'], ['az', 'A–Z']] as const as [wert, text] (wert)}
					<button
						type="button"
						aria-pressed={sortierung === wert}
						onclick={() => (sortierung = wert)}
					>
						{text}
					</button>
				{/each}
			</div>
		</div>
		{#if mandanten.length}
			<div class="filterzeile">
				<div class="pillen" role="group" aria-label="Für wen">
					{#each [['', 'Alle'], ['alle', 'Für alle Mandanten'], ...mandanten.map( (m) => [m, m] )] as [wert, text] (wert)}
						<button
							type="button"
							class="pille"
							aria-pressed={fuer === wert}
							onclick={() => filtern(() => (fuer = wert))}
						>
							{text}
						</button>
					{/each}
				</div>
				<p class="zaehler" role="status">
					{sichtbar.length < aktive.length
						? `${sichtbar.length} von ${aktive.length} Hubs`
						: mitZahl(aktive.length, 'Hub', 'Hubs')}
				</p>
			</div>
		{/if}

		{#if data.hubs.length === 0}
			<p class="karte hinweis">Es gibt noch keine Hubs. Beantrag doch den ersten!</p>
		{:else if aktive.length === 0 && ruhende.length === 0}
			<p class="leer">Kein Hub passt. Vielleicht willst du einen beantragen?</p>
		{/if}

		<ul class="raster" bind:this={raster}>
			{#each sichtbar as h (h.id)}
				<li class="karte hub">
					<div class="hubkopf">
						{@render symbol(h, true)}
						<span class="text">
							<a class="name dehnen" href={href(h)}>{h.name}</a>
							<span class="unter">
								{mitZahl(h.abos, 'Abo', 'Abos')} · {h.proMonat
									? mitZahl(h.proMonat, 'Beitrag', 'Beiträge') + ' im Monat'
									: 'zurzeit ruhig'}
							</span>
						</span>
					</div>
					{#if h.about}<p class="about">{h.about}</p>{/if}
					<div class="fuss">
						<span class="schild">{h.isCentral ? 'Alle Mandanten' : h.tenantShort}</span>
						<span class="platz"></span>
						{#if h.mandatory}
							<span class="pflicht"><Icon d={SCHLOSS} size={16} stroke={2} />Pflicht-Abo</span>
						{:else}
							<form
								method="POST"
								action={actionUrl(page.url.search, h.subscribed ? 'abbestellen' : 'abonnieren')}
								use:enhance={() =>
									async ({ update }) =>
										update({ reset: false })}
							>
								<input type="hidden" name="hub" value={h.id} />
								<button
									type="submit"
									class="abo"
									class:an={h.subscribed}
									aria-pressed={h.subscribed}
									aria-label={h.subscribed ? `Abo beenden: ${h.name}` : `Abonnieren: ${h.name}`}
								>
									<Icon d={GLOCKE} size={16} stroke={2} />
									{h.subscribed ? 'Abonniert' : 'Abonnieren'}
								</button>
							</form>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
		{#if rest > 0}
			<button type="button" class="knopf zweit weiter" onclick={weitere}>
				{Math.min(SCHRITT, rest)} weitere anzeigen · noch {rest}
			</button>
		{/if}
		<p class="sr-only" role="status">{ansage}</p>

		{#if ruhende.length}
			<section class="karte ruhende">
				<h3>
					<button
						type="button"
						aria-expanded={ruhendeOffen}
						onclick={() => (ruhendeOffen = !ruhendeOffen)}
					>
						<span class="pfeil" class:offen={ruhendeOffen}>
							<Icon d={PFEIL} size={18} stroke={2} />
						</span>
						Ruhende Hubs <span class="anzahl">{ruhende.length}</span>
						<span class="erklaerung">Gerade ohne neue Beiträge, Inhalte bleiben lesbar</span>
					</button>
				</h3>
				{#if ruhendeOffen}
					<ul>
						{#each ruhende as h (h.id)}
							<li>
								<a class="zeile" href={href(h)}>
									{@render symbol(h, false)}
									<span class="text">
										<strong>{h.name}</strong>
										<span class="unter">{zuletzt(h.zuletzt)}</span>
									</span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	</section>

	<section class="beantragen" aria-labelledby="h-beantragen">
		<span class="plus" aria-hidden="true"><Icon d={PLUS} size={24} stroke={2} /></span>
		<div class="text">
			<strong id="h-beantragen">Dir fehlt ein Thema?</strong>
			<span>
				Beantrag einen Hub. Die Verwaltung prüft den Antrag und meldet sich per Nachricht.
			</span>
		</div>
		<a class="knopf" href={resolve('/(app)/hubs/beantragen')}>Hub beantragen</a>
	</section>
</div>

<style>
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	.kopftext {
		flex: 1 1 320px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.kopftext .hinweis {
		margin: 0;
	}
	.titel {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	h1 {
		margin: 0;
	}
	.stern {
		width: 44px;
		height: 44px;
		border: 0;
		background: transparent;
		color: var(--ac);
		font-size: 24px;
		cursor: pointer;
	}
	.aktionen,
	.pillen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.aktionen .knopf {
		gap: 6px;
	}
	.abschnitt {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.abschnitt h2 {
		margin: 6px 0 0;
		font-size: 18px;
	}
	.abschnittkopf {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
	}
	.abschnittkopf h2 {
		margin: 0;
	}
	.anzahl {
		font-weight: 500;
		color: var(--mu);
	}
	.leer {
		margin: 0;
		padding: 16px;
		border: 1px dashed var(--bd);
		border-radius: 14px;
		color: var(--mu);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.meine,
	.raster {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}
	.raster {
		gap: 14px;
	}
	.zeile {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		color: var(--tx);
		text-decoration: none;
		min-height: 44px;
	}
	.karte.zeile:hover,
	.ruhende .zeile:hover {
		background: color-mix(in srgb, var(--tint) 50%, var(--sf));
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.text strong {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
	}
	.neu {
		flex: none;
		font-size: 12px;
		font-weight: 700;
		color: #fff;
		background: var(--fill);
		border-radius: 999px;
		padding: 2px 8px;
	}
	.symbol {
		width: 40px;
		height: 40px;
		flex: none;
		border-radius: 12px;
		object-fit: cover;
	}
	.symbol.gross {
		width: 48px;
		height: 48px;
		border-radius: 14px;
	}
	.buchstabe {
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 18px;
	}
	.ton1 {
		background: #e6f3ee;
		color: #0b5e49;
	}
	.ton2 {
		background: #e3edf7;
		color: #1f4f7a;
	}
	.ton3 {
		background: #fbe6d8;
		color: #8a4316;
	}
	.ton4 {
		background: #e8e4f6;
		color: #4a3d8f;
	}
	.ton5 {
		background: #f6e3ea;
		color: #7f2846;
	}
	.ton6 {
		background: #eef0e0;
		color: #4d5a14;
	}
	.werkzeuge,
	.filterzeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	.suche {
		flex: 1 1 280px;
		max-width: 460px;
	}
	.segment {
		display: flex;
		gap: 2px;
		padding: 3px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--mu) 14%, transparent);
		margin-left: auto;
	}
	.segment button {
		height: 38px;
		padding: 0 12px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--mu);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}
	.segment button[aria-pressed='true'] {
		background: var(--sf);
		color: var(--ac);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.12);
	}
	.pille[aria-pressed='true'] {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
	}
	.zaehler {
		margin: 0 0 0 auto;
		font-size: 14px;
		color: var(--mu);
	}
	.hub {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px;
		transition: box-shadow 0.15s ease;
	}
	.hub:hover {
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.08);
	}
	.hub:has(.dehnen:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.hubkopf {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.name {
		color: var(--tx);
		font-weight: 700;
		font-size: 17px;
		text-decoration: none;
	}
	.dehnen::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.about {
		margin: 0;
		font-size: 14px;
		color: var(--mu);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	.fuss {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-top: auto;
	}
	.platz {
		flex: 1;
	}
	.fuss form {
		position: relative;
		z-index: 1;
	}
	.abo {
		min-height: 40px;
		padding: 0 14px;
		border-radius: 999px;
		border: 0;
		background: var(--fill);
		color: #fff;
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}
	.abo.an {
		background: var(--tint);
		color: var(--ac);
		box-shadow: inset 0 0 0 1px var(--ac);
	}
	.pflicht {
		min-height: 40px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		color: var(--mu);
	}
	.weiter {
		align-self: center;
		min-width: 260px;
		min-height: 48px;
		justify-content: center;
	}
	.ruhende {
		padding: 0;
		overflow: hidden;
	}
	.ruhende h3 {
		margin: 0;
	}
	.ruhende h3 button {
		width: 100%;
		min-height: 52px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 0 16px;
		border: 0;
		background: transparent;
		color: var(--tx);
		font: inherit;
		font-weight: 700;
		text-align: left;
		cursor: pointer;
	}
	.pfeil {
		display: inline-flex;
		color: var(--mu);
		transition: transform 0.15s;
	}
	.pfeil.offen {
		transform: rotate(90deg);
	}
	.erklaerung {
		margin-left: auto;
		font-size: 13px;
		font-weight: 500;
		color: var(--mu);
	}
	.ruhende ul {
		border-top: 1px solid var(--bd);
	}
	.ruhende li + li {
		border-top: 1px solid var(--bd);
	}
	.ruhende .zeile {
		padding: 8px 16px;
	}
	.beantragen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 14px;
		padding: 18px;
		border-radius: var(--radius);
		background: var(--tint);
	}
	.plus {
		width: 48px;
		height: 48px;
		flex: none;
		border-radius: 14px;
		background: var(--sf);
		color: var(--ac);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.beantragen .text {
		flex: 1 1 240px;
	}
	.beantragen .text span {
		font-size: 14px;
	}
	@media (max-width: 1023px) {
		.meine,
		.raster {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 599px) {
		.meine,
		.raster {
			grid-template-columns: minmax(0, 1fr);
		}
		.suche {
			flex: 1 1 100%;
			max-width: none;
		}
		.segment {
			flex: 1 1 100%;
			margin-left: 0;
		}
		.segment button {
			flex: 1;
		}
		.zaehler {
			flex: 1 1 100%;
			margin: 0;
		}
		.erklaerung {
			display: none;
		}
		.weiter {
			align-self: stretch;
			min-width: 0;
		}
	}
</style>
