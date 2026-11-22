<script lang="ts">
	import MitFrage from '#lib/components/MitFrage.svelte';
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { actionUrl } from '#lib/action-url.ts';
	import { page } from '$app/state';
	import { formatSize as groesse } from '#lib/format.ts';
	import { formatRange, planState } from '#lib/plans.ts';

	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import Icon from '#lib/components/Icon.svelte';
	import LinkKopieren from '#lib/components/LinkKopieren.svelte';
	import MehrLaden from '#lib/components/MehrLaden.svelte';
	import { livesuche } from '#lib/livesuche.ts';
	import { mitZahl, nachMonat } from '#lib/lange-liste.ts';
	import { offlineMoeglich, offlinePlaene, planOfflineSpeichern } from '#lib/offline.ts';

	let { data, form } = $props();
	const ZUSTAND = { aktuell: 'aktuell', kuenftig: 'kommt', abgelaufen: 'abgelaufen' } as const;
	const alle = $derived([...data.aktuelle, ...data.archiv]);
	const aktuell = $derived(data.aktuelle.filter((p) => planState(p, data.heute) === 'aktuell'));
	const demnaechst = $derived(data.aktuelle.filter((p) => planState(p, data.heute) === 'kuenftig'));
	const monate = $derived(nachMonat(data.archiv, (p) => new Date(`${p.validFrom}T12:00:00Z`)));
	function adresse(o: { jahr?: number | null; anzahl?: number }) {
		const jahr = o.jahr === undefined ? data.jahr : o.jahr;
		const teile = [
			data.gewaehlt ? `kbb=${data.gewaehlt.unitId}` : '',
			data.q ? `q=${encodeURIComponent(data.q)}` : '',
			jahr ? `jahr=${jahr}` : '',
			o.anzahl ? `anzahl=${o.anzahl}` : ''
		].filter(Boolean);
		return `?${teile.join('&')}`;
	}

	// Neu: in den letzten 3 Tagen hochgeladen oder ersetzt
	const NEU_MS = 3 * 86400000;
	const neu = (d: Date) => Date.now() - new Date(d).getTime() < NEU_MS;
	const datum = new Intl.DateTimeFormat('de-DE', {
		day: '2-digit',
		month: '2-digit',
		timeZone: 'Europe/Berlin'
	});

	// Offline gespeicherte Fassungen (nur in diesem Browser)
	const offline = new SvelteMap<string, string>();
	let laedt = $state(false);
	async function offlineLesen() {
		offline.clear();
		for (const o of await offlinePlaene()) offline.set(o.id, o.fileId);
	}
	onMount(() => {
		if (offlineMoeglich()) void offlineLesen();
	});
	const veraltet = $derived(
		alle.filter((p) => offline.has(p.id) && offline.get(p.id) !== p.fileId)
	);
	async function neueFassungen() {
		laedt = true;
		try {
			for (const p of veraltet)
				await planOfflineSpeichern({
					id: p.id,
					fileId: p.fileId,
					title: p.title,
					kbb: data.gewaehlt?.unitName ?? '',
					validUntil: p.validUntil
				});
			await offlineLesen();
		} finally {
			laedt = false;
		}
	}
	const PAPIERKORB =
		'M4 7l16 0M10 11l0 6M14 11l0 6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3';
</script>

<svelte:head><title>Pläne (KBB) · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<div class="titel">
			<h1>Pläne (KBB)</h1>
			<form method="POST" action={actionUrl(page.url.search, 'favorit')} use:enhance>
				<button
					class="stern"
					type="submit"
					aria-pressed={data.favorit}
					aria-label={data.favorit ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten hinzufügen'}
				>
					{data.favorit ? '★' : '☆'}
				</button>
			</form>
		</div>
		{#if data.gewaehlt?.darfPflegen}
			<a class="knopf" href="{resolve('/(app)/plaene/neu')}?kbb={data.gewaehlt.unitId}">
				PDF hochladen
			</a>
		{/if}
	</div>
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	{#if data.kbbs.length === 0}
		<p class="hinweis">
			Es ist noch kein KBB eingerichtet. Das geht unter Verwaltung → Abteilungen und Hubs („KBB
			dieses Mandanten“).
		</p>
	{:else}
		<nav class="pillen" aria-label="KBB wählen">
			{#each data.kbbs as k (k.unitId)}
				<a
					href="?kbb={k.unitId}"
					class="pille"
					aria-current={data.gewaehlt?.unitId === k.unitId ? 'true' : undefined}
				>
					{k.unitName}{#if k.eigener}
						&nbsp;· dein Mandant{:else}
						&nbsp;· {k.tenantName}{/if}
				</a>
			{/each}
		</nav>

		<p class="hinweis klein">
			Bei neuen Plänen deines KBB wirst du benachrichtigt, wenn „Pläne (KBB)“ unter Konto →
			Benachrichtigungen eingeschaltet ist.
		</p>

		{#if veraltet.length}
			<div class="veraltet" role="status">
				<span>
					{veraltet.length === 1
						? `„${veraltet[0].title}“ wurde geändert. Deine Offline-Fassung ist veraltet.`
						: `${veraltet.length} Pläne wurden geändert. Deine Offline-Fassungen sind veraltet.`}
				</span>
				<button class="knopf rot klein" type="button" disabled={laedt} onclick={neueFassungen}>
					Neue Fassung laden
				</button>
			</div>
		{/if}

		<form
			method="GET"
			class="suchfeld"
			role="search"
			data-sveltekit-reset="false"
			data-sveltekit-replacestate
		>
			{#if data.gewaehlt}<input type="hidden" name="kbb" value={data.gewaehlt.unitId} />{/if}
			<label class="sr-only" for="suche-plaene">In Plänen suchen</label>
			<input
				id="suche-plaene"
				use:livesuche
				type="search"
				name="q"
				value={data.q}
				placeholder="In Plänen suchen …"
				autocomplete="off"
				maxlength="100"
			/>
		</form>

		{#snippet zeile(plan: (typeof alle)[number])}
			{@const z = planState(plan, data.heute)}
			{@const href = resolve('/(app)/plaene/[id]', { id: plan.id })}
			<li class:alt={z === 'abgelaufen'} data-eintrag>
				<span class="pdf" aria-hidden="true">PDF</span>
				<span class="text">
					<a class="titellink" {href}>{plan.title}</a>
					<span class="hinweis">
						{data.gewaehlt?.unitName} · {formatRange(plan.validFrom, plan.validUntil)} ·
						{groesse(plan.size)} · hochgeladen am {datum.format(new Date(plan.updatedAt))}
					</span>
				</span>
				<span class="werkzeuge">
					{#if offline.has(plan.id) && offline.get(plan.id) !== plan.fileId}
						<span class="schild rot-schild">Offline veraltet</span>
					{:else if offline.has(plan.id)}
						<span class="schild rand">Offline</span>
					{/if}
					{#if neu(plan.updatedAt) && z !== 'abgelaufen'}
						<span class="schild">Neu</span>
					{:else if z !== 'aktuell'}
						<span class="schild rand">{ZUSTAND[z]}</span>
					{/if}
					<LinkKopieren {href} />
					<a class="knopf zweit klein" {href}>
						Öffnen<span class="sr-only">: {plan.title}</span>
					</a>
					{#if data.gewaehlt?.darfPflegen}
						<MitFrage
							action="{href}?/loeschen"
							frage={{
								titel: `„${plan.title}“ löschen?`,
								text: 'Der Plan verschwindet endgültig für alle, auch für andere Mandanten.',
								ja: 'Löschen',
								gefahr: true
							}}
						>
							{#snippet ausloeser(klick: () => void)}
								<button
									type="button"
									class="rund rot-text"
									aria-label="{plan.title} löschen"
									title="Löschen"
									onclick={klick}
								>
									<Icon d={PAPIERKORB} size={16} stroke={2} />
								</button>
							{/snippet}
						</MitFrage>
					{/if}
				</span>
			</li>
		{/snippet}

		{#if alle.length === 0 && data.jahre.length === 0}
			<p class="karte hinweis" role="status">
				{data.q ? `Keine Pläne zu „${data.q}“.` : 'Für dieses KBB gibt es gerade keine Pläne.'}
			</p>
		{/if}
		{#if aktuell.length}
			<section class="abschnitt" aria-labelledby="pl-aktuell">
				<h2 id="pl-aktuell">Aktuell</h2>
				<ul class="liste karte">
					{#each aktuell as plan (plan.id)}{@render zeile(plan)}{/each}
				</ul>
			</section>
		{/if}
		{#if demnaechst.length}
			<section class="abschnitt" aria-labelledby="pl-bald">
				<h2 id="pl-bald">Demnächst</h2>
				<ul class="liste karte">
					{#each demnaechst as plan (plan.id)}{@render zeile(plan)}{/each}
				</ul>
			</section>
		{/if}
		{#if data.jahre.length}
			<section class="abschnitt" aria-labelledby="pl-archiv">
				<div class="archivkopf">
					<h2 id="pl-archiv">Archiv</h2>
					<nav class="pillen" aria-label="Jahr">
						{#each data.jahre as j (j.jahr)}
							<a
								href={adresse({ jahr: j.jahr })}
								class="pille"
								aria-current={data.jahr === j.jahr ? 'true' : undefined}
								data-sveltekit-noscroll
							>
								{j.jahr} · {j.n}
							</a>
						{/each}
					</nav>
					<p class="zaehler">
						{data.archiv.length} von {mitZahl(data.archivGesamt, 'Plan', 'Plänen')}
					</p>
				</div>
				<div id="pl-archivliste" class="abschnitt">
					{#each monate as m (m.monat)}
						<section class="karte monat" aria-labelledby="pl-{m.monat}">
							<h3 id="pl-{m.monat}">{m.titel}</h3>
							<ul class="liste">
								{#each m.eintraege as plan (plan.id)}{@render zeile(plan)}{/each}
							</ul>
						</section>
					{/each}
				</div>
				<MehrLaden
					geladen={data.archiv.length}
					gesamt={data.archivGesamt}
					schritt={data.schritt}
					href={adresse({ anzahl: data.anzahl + data.schritt })}
					einheit={['Plan', 'Pläne']}
					bereich="pl-archivliste"
				/>
			</section>
		{/if}
	{/if}
</div>

<style>
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.titel {
		display: flex;
		align-items: center;
		gap: 6px;
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
	.pillen {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.klein {
		font-size: 14px;
		margin: 0;
	}
	.suchfeld {
		max-width: 560px;
	}
	.veraltet {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 16px;
		border-radius: 14px;
		background: var(--err-bg);
		border: 2px solid var(--err-bd);
		color: var(--err-tx);
	}
	.knopf.rot {
		background: var(--rot);
		border-color: var(--rot);
		color: #fff;
	}
	.knopf.klein {
		min-height: 36px;
		padding: 6px 12px;
		font-size: 13px;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 4px 16px;
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
	.archivkopf {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	.archivkopf h2 {
		margin: 0 6px 0 0;
	}
	.zaehler {
		margin: 0 0 0 auto;
		font-size: 14px;
		color: var(--mu);
	}
	.monat {
		padding: 0;
		overflow: hidden;
	}
	.monat h3 {
		margin: 0;
		padding: 10px 16px;
		font-size: 14px;
		background: var(--bg);
		border-bottom: 1px solid var(--bd);
	}
	@media (max-width: 599px) {
		.zaehler {
			flex: 1 1 100%;
			margin: 0;
		}
	}
	.liste li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 12px;
		padding: 12px 0;
	}
	.liste li + li {
		border-top: 1px solid var(--bd);
	}
	.liste li.alt {
		opacity: 0.75;
	}
	.pdf {
		flex: none;
		width: 30px;
		height: 36px;
		border-radius: 6px;
		border: 1px solid var(--bd);
		background: var(--bg);
		color: var(--err-tx);
		font-size: 9px;
		font-weight: 700;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 3px;
		box-sizing: border-box;
	}
	.text {
		flex: 1 1 220px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.text .titellink {
		font-weight: 700;
	}
	.text .hinweis {
		font-size: 13px;
	}
	.werkzeuge {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.rot-schild {
		background: var(--rot);
		color: #fff;
	}
	.rund {
		width: 38px;
		height: 38px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--bd);
		border-radius: 999px;
		background: var(--sf);
		cursor: pointer;
	}
	.rot-text {
		color: var(--err-tx);
	}
</style>
