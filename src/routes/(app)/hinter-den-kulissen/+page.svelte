<script lang="ts">
	import { imFenster } from '#lib/imFenster.ts';
	import { livesuche } from '#lib/livesuche.ts';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Absender from '#lib/components/Absender.svelte';
	import Info from '#lib/components/Info.svelte';
	import Karussell from '#lib/components/Karussell.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { actionUrl } from '#lib/action-url.ts';
	import MehrLaden from '#lib/components/MehrLaden.svelte';
	import { mitZahl } from '#lib/lange-liste.ts';

	let { data, form } = $props();
	const mehrHref = $derived.by(() => {
		const u = new URL(page.url.href);
		u.searchParams.set('anzahl', String(data.anzahl + data.schritt));
		return u.search;
	});
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeZone: 'Europe/Berlin'
	});
	let diashowsAus = $state(false);
	let sogehtsOffen = $state(false);
	const mehrereFotos = $derived(data.beitraege.some((b) => b.images.length > 1));
	function reaktionen(r: { emoji: string; n: number }[]) {
		const mit = r.filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
		return { summe: mit.reduce((s, x) => s + x.n, 0), oben: mit.slice(0, 3).map((x) => x.emoji) };
	}
	const PFEIL = 'M5 12h14M13 18l6 -6M13 6l6 6';
	const weitere = $derived(data.mandanten.filter((m) => m.an && !m.eigener));
	const ausLabel = $derived(
		weitere.length
			? `Aus: dein Mandant + ${weitere.map((m) => m.short).join(', ')}`
			: 'Aus: dein Mandant'
	);
</script>

<svelte:head><title>Hinter den Kulissen · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<div class="titel">
			<h1>Hinter den Kulissen</h1>
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
		{#if data.darfSchreiben}
			<a class="knopf" href={resolve('/(app)/hinter-den-kulissen/neu')}>Beitrag erstellen</a>
		{/if}
	</div>

	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}

	<div class="filter">
		<form
			method="GET"
			class="suche"
			role="search"
			data-sveltekit-reset="false"
			data-sveltekit-replacestate
		>
			<label class="feld">
				<span class="sr-only">Hinter den Kulissen durchsuchen</span>
				<input
					use:livesuche
					type="search"
					name="q"
					value={data.q}
					maxlength="100"
					placeholder="Suchen …"
				/>
			</label>
		</form>
		<details class="auf">
			<summary class="pille">{ausLabel}</summary>
			<form method="POST" action="?/aus" class="liste-auf" use:imFenster>
				<input type="hidden" name="zurueck" value={page.url.search} />
				{#each data.mandanten as m (m.id)}
					<label>
						<input type="checkbox" name="aus" value={m.id} checked={m.an} disabled={m.eigener} />
						<span>{m.name}</span>
						{#if m.eigener}<span class="hinweis">immer dabei</span>{/if}
					</label>
				{/each}
				<button class="knopf klein" type="submit">Übernehmen</button>
			</form>
		</details>
		<Info
			thema="Hinter den Kulissen"
			text="Einblicke aus den Abteilungen – ohne Freigabe, mit Einwilligung der Abgebildeten. Über „Aus“ holst du Beiträge anderer Mandanten dazu."
		/>
		{#if mehrereFotos}
			<button
				type="button"
				class="pille diashow"
				aria-pressed={diashowsAus}
				onclick={() => (diashowsAus = !diashowsAus)}
			>
				{diashowsAus ? '▶ Diashows abspielen' : '❚❚ Diashows anhalten'}
			</button>
		{/if}
	</div>
	{#if data.freischalten.length || data.soGehts}
		<p class="hinweis klein-text">
			Deine Abteilung möchte hier auch etwas zeigen?
			<a href="#sogehts" onclick={() => (sogehtsOffen = true)}>So geht’s</a>
		</p>
	{/if}

	{#if data.beitraege.length === 0}
		<p class="karte hinweis" role="status">
			{data.q ? `Nichts zu „${data.q}“ gefunden.` : 'Noch keine Beiträge.'}
		</p>
	{:else}
		<p class="hinweis zaehler">
			{data.beitraege.length} von {mitZahl(data.gesamt, 'Beitrag', 'Beiträgen')}
		</p>
		<div class="raster" id="kulissenraster">
			{#each data.beitraege as b (b.id)}
				{@const r = reaktionen(b.reactions)}
				{@const href = resolve('/(app)/hinter-den-kulissen/[id]', { id: b.id })}
				<article class="karte beitrag" aria-labelledby="k-{b.id}" data-eintrag>
					{#if b.images.length}
						<Karussell bilder={b.images} titel={b.title} kompakt angehalten={diashowsAus} />
					{/if}
					{#if b.otherTenant}<div><span class="schild rand">{b.tenantShort}</span></div>{/if}
					<h2 id="k-{b.id}"><a class="titellink" {href}>{b.title}</a></h2>
					<Absender
						name={b.sender}
						label={b.senderLabel}
						slug={b.senderSlug}
						hub={b.senderHub}
						wann={datum.format(b.publishAt)}
					/>
					<p class="text">{b.excerpt}</p>
					<a class="weiter" {href} aria-hidden="true" tabindex="-1">
						Beitrag ansehen <Icon d={PFEIL} size={16} stroke={2.2} />
					</a>
					{#if r.summe}
						<span
							class="reaktionen"
							aria-label="{r.summe} {r.summe === 1 ? 'Reaktion' : 'Reaktionen'}"
						>
							<span aria-hidden="true">{r.oben.join('')}</span>
							{r.summe}
						</span>
					{/if}
				</article>
			{/each}
		</div>
		<MehrLaden
			geladen={data.beitraege.length}
			gesamt={data.gesamt}
			schritt={data.schritt}
			href={mehrHref}
			einheit={['Beitrag', 'Beiträge']}
			verb="weitere anzeigen"
			bereich="kulissenraster"
		/>
	{/if}

	<details class="karte sogehts" id="sogehts" bind:open={sogehtsOffen}>
		<summary><strong>So geht’s</strong></summary>
		<p>{data.soGehts}</p>
		{#if data.freischalten.length}
			<div class="stapel">
				<span class="hinweis">Für deine Einheiten:</span>
				{#each data.freischalten as e (e.id)}
					<form method="POST" action="?/freischalten" class="zeile" use:enhance>
						<input type="hidden" name="einheit" value={e.id} />
						<span>{e.name}: {e.enabled ? 'freigeschaltet' : 'nicht freigeschaltet'}</span>
						<button class="knopf zweit klein" name="an" value={e.enabled ? 'nein' : 'ja'}>
							{e.enabled ? 'Abschalten' : 'Freischalten'}
						</button>
					</form>
				{/each}
			</div>
		{/if}
	</details>
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
	.filter {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.suche {
		display: flex;
		gap: 10px;
		flex: 1 1 360px;
		max-width: 640px;
	}
	.suche .feld {
		flex: 1;
	}
	.auf {
		position: relative;
	}
	.liste-auf {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 30;
		min-width: 260px;
		display: grid;
		gap: 2px;
		padding: 8px;
		background: var(--sf);
		border: 1px solid var(--bd);
		border-radius: 14px;
		box-shadow: 0 10px 30px rgb(0 0 0 / 0.18);
	}
	.liste-auf label {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 0 8px;
	}
	.liste-auf input {
		width: 18px;
		height: 18px;
		accent-color: var(--fill);
	}
	.raster {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
		gap: 16px;
		align-items: start;
	}
	.beitrag {
		display: grid;
		gap: 8px;
	}
	.diashow {
		margin-left: auto;
		font-size: 14px;
	}
	.klein-text {
		margin: 0;
		font-size: 14px;
	}
	.weiter {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--ac);
		font-weight: 600;
		font-size: 14px;
		text-decoration: none;
	}
	.reaktionen {
		font-size: 13px;
		color: var(--mu);
	}
	.beitrag h2 {
		margin: 0;
		font-size: 18px;
		line-height: 1.3;
	}

	.text {
		margin: 0;
	}

	.sogehts summary {
		cursor: pointer;
		min-height: 44px;
		display: flex;
		align-items: center;
	}
	.sogehts p {
		white-space: pre-line;
	}
	.zeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	.klein {
		min-height: 38px;
		padding: 6px 12px;
	}
</style>
