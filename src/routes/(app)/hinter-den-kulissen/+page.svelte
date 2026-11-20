<script lang="ts">
	import { livesuche } from '#lib/livesuche.ts';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Reaktionen from '#lib/components/Reaktionen.svelte';
	import { actionUrl } from '#lib/action-url.ts';

	let { data, form } = $props();
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeZone: 'Europe/Berlin'
	});
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
	<p class="hinweis">
		Einblicke aus den Abteilungen – ohne Freigabe, mit Einwilligung der Abgebildeten.
	</p>
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
			<summary class="pille">{ausLabel} ▾</summary>
			<form method="POST" action="?/aus" class="liste-auf">
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
	</div>

	{#if data.beitraege.length === 0}
		<p class="karte hinweis" role="status">
			{data.q ? `Nichts zu „${data.q}“ gefunden.` : 'Noch keine Beiträge.'}
		</p>
	{:else}
		<div class="raster">
			{#each data.beitraege as b (b.id)}
				<article class="karte beitrag" aria-labelledby="k-{b.id}">
					{#if b.cover}
						<img
							src={resolve('/(app)/dateien/[id]', { id: b.cover.id })}
							alt=""
							loading="lazy"
							class="cover"
						/>
					{/if}
					<div class="schilder">
						<span class="schild">{b.sender}</span>
						{#if b.otherTenant}<span class="schild rand">{b.tenantShort}</span>{/if}
					</div>
					<h2 id="k-{b.id}">
						<a href={resolve('/(app)/hinter-den-kulissen/[id]', { id: b.id })}>{b.title}</a>
					</h2>
					<p class="text">{b.excerpt}</p>
					<span class="hinweis">{datum.format(b.publishAt)}</span>
					<Reaktionen newsId={b.id} reaktionen={b.reactions} basis="/hinter-den-kulissen" />
				</article>
			{/each}
		</div>
	{/if}

	<details class="karte sogehts">
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
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;
		align-items: start;
	}
	.beitrag {
		display: grid;
		gap: 8px;
	}
	.cover {
		width: 100%;
		height: 180px;
		object-fit: cover;
		border-radius: 12px;
	}
	.beitrag h2 {
		margin: 0;
		font-size: 18px;
		line-height: 1.3;
	}
	.beitrag h2 a {
		color: var(--tx);
	}
	.text {
		margin: 0;
	}
	.schilder {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
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
