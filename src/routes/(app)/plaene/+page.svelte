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
	import { matchesSearch } from '#lib/departments.ts';
	import { offlineMoeglich, offlinePlaene, planOfflineSpeichern } from '#lib/offline.ts';

	let { data, form } = $props();
	const ZUSTAND = { aktuell: 'aktuell', kuenftig: 'kommt', abgelaufen: 'abgelaufen' } as const;
	let suche = $state('');
	const sichtbar = $derived(data.plaene.filter((p) => matchesSearch(suche, [p.title])));

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
		data.plaene.filter((p) => offline.has(p.id) && offline.get(p.id) !== p.fileId)
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
						· dein Mandant{:else}
						· {k.tenantName}{/if}
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

		<div class="suchfeld">
			<label class="sr-only" for="suche-plaene">In Plänen suchen</label>
			<input
				id="suche-plaene"
				type="search"
				bind:value={suche}
				placeholder="In Plänen suchen …"
				autocomplete="off"
				maxlength="100"
			/>
		</div>

		{#if data.plaene.length === 0}
			<p class="hinweis" role="status">Für dieses KBB gibt es gerade keine Pläne.</p>
		{:else if sichtbar.length === 0}
			<p class="karte hinweis" role="status">Keine Pläne zu „{suche}“.</p>
		{:else}
			<ul class="liste karte">
				{#each sichtbar as plan (plan.id)}
					{@const z = planState(plan, data.heute)}
					{@const href = resolve('/(app)/plaene/[id]', { id: plan.id })}
					<li class:alt={z === 'abgelaufen'}>
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
				{/each}
			</ul>
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
