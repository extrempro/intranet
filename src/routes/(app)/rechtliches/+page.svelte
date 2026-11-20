<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Links von Einträgen (geprüft: https/http oder eigene Pfade) und Suchparameter */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import RechtlichEintrag from '#lib/components/RechtlichEintrag.svelte';
	import { matchesSearch } from '#lib/departments.ts';
	import { formatIsoDate } from '#lib/format.ts';
	import { AGREEMENT_KINDS, LEGAL_KINDS, type LegalLinkErrors } from '#lib/legal.ts';

	let { data, form } = $props();
	let suche = $state('');
	let neuZaehler = $state(0);
	let neuOffen = $state(false);
	// Bei Fehlern im neuen Eintrag bleibt das Formular offen
	$effect(() => {
		if (form && 'eintrag' in form && form.eintrag === 'neu' && 'felder' in form) neuOffen = true;
	});

	const vereinbarungen = $derived(
		data.vereinbarungen.filter((v) =>
			matchesSearch(suche, [v.title, v.description, ...v.attachments.map((a) => a.name)])
		)
	);
	const links = $derived(data.links.filter((l) => matchesSearch(suche, [l.title, l.description])));
	const fehlerFuer = (id: string): LegalLinkErrors =>
		form && 'eintrag' in form && form.eintrag === id && 'felder' in form
			? (form.felder as LegalLinkErrors)
			: {};
	const extern = (url: string) => !url.startsWith('/');
	const heute = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
	const KLAMMER =
		'M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5';
	const sprungziele = $derived(
		[
			...AGREEMENT_KINDS.map((k) => ({
				id: `h-${k.key}`,
				label: k.label,
				n: data.vereinbarungen.filter((v) => v.kind === k.key).length
			})),
			{ id: 'h-gesetze', label: 'Gesetze und Tarifverträge', n: data.links.length }
		].filter((z) => z.n > 0)
	);
</script>

<svelte:head><title>Rechtliches · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<div class="titel">
			<h1>Rechtliches</h1>
			<form method="POST" action="?/favorit" use:enhance>
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
		{#if data.canWrite}
			<a
				class="knopf hauptaktion"
				href="{resolve('/(app)/rechtliches/neu')}?mandant={data.tenantId}"
			>
				Vereinbarung einstellen
			</a>
		{/if}
	</div>

	{#if data.mandanten.some((m) => m.id !== data.eigenerMandant)}
		<nav class="pillen" aria-label="Mandant">
			{#if !data.mandanten.some((m) => m.id === data.eigenerMandant)}
				<a
					class="pille"
					href="?"
					aria-current={data.tenantId === data.eigenerMandant ? 'true' : undefined}
				>
					Mein Mandant
				</a>
			{/if}
			{#each data.mandanten as m (m.id)}
				<a
					class="pille"
					href="?mandant={m.id}"
					aria-current={m.id === data.tenantId ? 'true' : undefined}
				>
					{m.short}
				</a>
			{/each}
		</nav>
	{/if}

	{#if form && 'fehler' in form && !('felder' in form)}
		<p class="meldung fehler" role="alert">{form.fehler}</p>
	{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}

	{#if sprungziele.length > 1}
		<nav class="pillen" aria-label="Abschnitte">
			{#each sprungziele as z (z.id)}
				<a class="pille" href="#{z.id}">{z.label} <span class="anzahl">{z.n}</span></a>
			{/each}
		</nav>
	{/if}

	<div class="suchfeld">
		<label class="sr-only" for="suche-recht">Rechtliches durchsuchen</label>
		<input
			id="suche-recht"
			type="search"
			bind:value={suche}
			placeholder="Titel, Inhalt oder Anlage suchen …"
			autocomplete="off"
			maxlength="100"
		/>
	</div>

	{#each AGREEMENT_KINDS as k (k.key)}
		{@const liste = vereinbarungen.filter((v) => v.kind === k.key)}
		{#if liste.length || (!suche && data.canWrite)}
			<section class="stapel" aria-labelledby="h-{k.key}">
				<h2 id="h-{k.key}">{k.label}</h2>
				{#if liste.length === 0}<p class="karte hinweis">Noch keine eingestellt.</p>{/if}
				{#if liste.length}
					<ul class="vliste">
						{#each liste as v (v.id)}
							<li>
								<a href={resolve('/(app)/rechtliches/[id]', { id: v.id })}>
									<span class="vtext">
										<span class="vtitel">
											<strong>{v.title}</strong>
											{#if v.validFrom > heute}<span class="schild warn">
													Gilt ab {formatIsoDate(v.validFrom)}
												</span>{/if}
										</span>
										<span class="unter">
											Gilt ab {formatIsoDate(v.validFrom)} · Stand {formatIsoDate(v.versionDate)}
										</span>
									</span>
									{#if v.attachments.length}
										<span class="anlagen" aria-label="{v.attachments.length} Dateien">
											<Icon d={KLAMMER} size={14} stroke={2} />{v.attachments.length}
										</span>
									{/if}
									<Icon d="M9 6l6 6l-6 6" size={18} stroke={2} />
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}
	{/each}

	<section class="stapel" aria-labelledby="h-gesetze">
		<h2 id="h-gesetze">Gesetze und Tarifverträge</h2>
		{#each LEGAL_KINDS as k (k.key)}
			{@const liste = links.filter((l) => l.kind === k.key)}
			{#if liste.length}
				<div class="karte">
					<h3>{k.label}</h3>
					<ul class="eintraege">
						{#each liste as l, i (l.id)}
							<li id="eintrag-{l.id}">
								<div class="zeile">
									<span class="stapel eng">
										{#if l.url}
											<a
												href={l.url}
												target={extern(l.url) ? '_blank' : undefined}
												rel={extern(l.url) ? 'noopener noreferrer' : undefined}
											>
												{l.title}
											</a>
										{:else if l.fileId}
											<a href="/dateien/{l.fileId}" target="_blank" rel="noopener">{l.title}</a>
										{:else}<strong>{l.title}</strong>{/if}
										{#if l.description}<span class="hinweis">{l.description}</span>{/if}
										{#if l.url && l.fileId}
											<a
												class="klein-link"
												href="/dateien/{l.fileId}"
												target="_blank"
												rel="noopener"
											>
												{l.fileName}
											</a>
										{/if}
									</span>
									{#if data.canWrite}
										<span class="werkzeuge">
											<form method="POST" action="?/eintragVerschieben" use:enhance>
												<input type="hidden" name="id" value={l.id} />
												<button
													class="mini"
													name="richtung"
													value="hoch"
													disabled={i === 0}
													aria-label="{l.title} nach oben"
												>
													↑
												</button>
												<button
													class="mini"
													name="richtung"
													value="runter"
													disabled={i === liste.length - 1}
													aria-label="{l.title} nach unten"
												>
													↓
												</button>
											</form>
										</span>
									{/if}
								</div>
								{#if data.canWrite}
									<details
										class="bearbeiten"
										open={(form &&
											'eintrag' in form &&
											form.eintrag === l.id &&
											'felder' in form) ||
											undefined}
									>
										<summary>Bearbeiten</summary>
										<RechtlichEintrag
											praefix="e{l.id.slice(0, 8)}"
											mandant={data.tenantId}
											fehler={fehlerFuer(l.id)}
											werte={{
												id: l.id,
												kind: l.kind,
												title: l.title,
												description: l.description ?? '',
												url: l.url ?? '',
												datei:
													l.fileId && l.fileName
														? { id: l.fileId, name: l.fileName, size: l.fileSize ?? 0 }
														: null
											}}
										/>
										<form method="POST" action="?/eintragLoeschen" use:enhance>
											<input type="hidden" name="id" value={l.id} />
											<button class="linkknopf" type="submit">Eintrag löschen</button>
										</form>
									</details>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/each}
		{#if links.length === 0}
			<p class="karte hinweis">{suche ? 'Nichts gefunden.' : 'Noch keine Einträge.'}</p>
		{/if}
		{#if data.canWrite}
			<details class="karte" bind:open={neuOffen}>
				<summary><strong>Eintrag hinzufügen</strong></summary>
				{#key neuZaehler}
					<RechtlichEintrag
						praefix="neu"
						mandant={data.tenantId}
						fehler={fehlerFuer('neu')}
						nachSpeichern={() => neuZaehler++}
						werte={{ id: null, kind: 'gesetz', title: '', description: '', url: '', datei: null }}
					/>
				{/key}
			</details>
		{/if}
	</section>
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
		gap: 10px;
	}
	h1,
	h2,
	h3 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	h3 {
		font-size: 1rem;
	}
	.eng {
		gap: 4px;
	}
	.hinweis {
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
	input[type='search'] {
		width: 100%;
	}
	.suchfeld {
		max-width: 560px;
	}
	.anzahl {
		font-size: 12px;
		font-weight: 700;
		opacity: 0.75;
	}
	.vliste {
		list-style: none;
		margin: 0;
		padding: 0;
		background: var(--sf);
		border: 1px solid var(--bd);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.vliste li + li {
		border-top: 1px solid var(--bd);
	}
	.vliste a {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 56px;
		padding: 10px 14px;
		box-sizing: border-box;
		color: var(--tx);
		text-decoration: none;
	}
	.vliste a:hover {
		background: var(--bg);
	}
	.vliste a > :global(svg) {
		flex: none;
		color: var(--mu);
	}
	.vtext {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.vtitel {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
	}
	.vtitel strong {
		text-decoration: underline;
		text-decoration-color: var(--bd);
		text-underline-offset: 4px;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
	}
	.anlagen {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-size: 13px;
		color: var(--mu);
	}
	.schild.warn {
		background: var(--warn-bg);
		color: var(--warn-tx);
	}
	.pillen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.eintraege {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
	.eintraege li {
		padding: 10px 0;
		border-top: 1px solid var(--bd);
		scroll-margin-top: 80px;
	}
	.eintraege li:first-child {
		border-top: 0;
	}
	h3 + .eintraege {
		margin-top: 6px;
	}
	.zeile {
		display: flex;
		justify-content: space-between;
		gap: 10px;
	}
	.werkzeuge form {
		display: flex;
		gap: 6px;
	}
	.mini {
		min-width: 38px;
		min-height: 38px;
		border: 1px solid var(--bd);
		border-radius: 10px;
		background: var(--sf);
		color: var(--tx);
		cursor: pointer;
	}
	.mini:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.bearbeiten summary {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		cursor: pointer;
		font-weight: 600;
		color: var(--ac);
		font-size: 14px;
	}
	details.karte summary {
		min-height: 44px;
		display: flex;
		align-items: center;
		cursor: pointer;
	}
	details[open] > summary {
		margin-bottom: 10px;
	}
	.klein-link {
		font-size: 14px;
	}
</style>
