<script lang="ts">
	/** Abteilungsseite wie bei Hubs: Kopf, Kontakt, Hinweise und Reiter; die Reiter sind eigene Unterseiten. */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { abteilungReiter } from '#lib/abteilung-seite.ts';

	let { data, children } = $props();
	const e = $derived(data.einheit);
	const form = $derived(page.form as { fehler?: string; ok?: string } | null);
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeZone: 'Europe/Berlin'
	});
	const STERN =
		'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z';
	const LINK =
		'M9 15l6 -6M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463';
	const BRIEF =
		'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2zM3 7l9 6l9 -6';
	const TELEFON =
		'M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2';
	const UHR = 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M12 7v5l3 3';
	const ORT =
		'M12 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M17.66 16.66l-4.24 4.24a2 2 0 0 1 -2.83 0l-4.25 -4.24a8 8 0 1 1 11.31 0z';

	const basis = $derived(resolve('/(app)/abteilungen/[slug]', { slug: e.slug }));
	const pfad = $derived(page.url.pathname.replace(/\/$/, ''));
	const reiter = $derived(
		[
			{ key: 'ueberblick', label: 'Überblick', href: basis, anzahl: null, leer: false },
			...abteilungReiter(data)
				.map((r) => ({ ...r, href: `${basis}/${r.pfad}` }))
				.filter((r) => !r.leer || r.pflegbar || pfad === r.href)
		].map((r) => ({ ...r, aktiv: pfad === r.href }))
	);
	const leitung = $derived(
		[
			e.leitung && { rolle: 'Leitung', p: e.leitung },
			e.zweiteLeitung && { rolle: 'Leitung', p: e.zweiteLeitung },
			e.stellvertretung && { rolle: 'Stellvertretung', p: e.stellvertretung }
		].filter(Boolean) as { rolle: string; p: { id: string; name: string } }[]
	);
	const pflegen = $derived(e.canManage || e.canAdminister);

	let kopiert = $state(false);
	async function linkKopieren() {
		try {
			await navigator.clipboard.writeText(location.href.split('#')[0].split('?')[0]);
			kopiert = true;
			setTimeout(() => (kopiert = false), 2000);
		} catch {
			// ohne Zwischenablage: nichts tun
		}
	}
</script>

<div class="stapel">
	<section class="kopf" aria-labelledby="u-h">
		<span class="kreis eins" aria-hidden="true"></span>
		<span class="kreis zwei" aria-hidden="true"></span>
		<span class="chip">{e.label}&nbsp;· {e.isCentral ? 'für alle Mandanten' : e.tenantName}</span>
		<h1 id="u-h">{e.name}</h1>
		{#if e.tagline}<p class="intro">{e.tagline}</p>{/if}
		{#if leitung.length}
			<p class="leitung">
				{#each leitung as l, i (l.p.id)}
					{#if i}<span aria-hidden="true"> · </span>{/if}
					{l.rolle}:
					<a href={resolve('/(app)/personen/[id]', { id: l.p.id })}>{l.p.name}</a>
				{/each}
			</p>
		{/if}
		<div class="aktionen">
			<form method="POST" action="?/favorit" use:enhance>
				<button
					class="rund hell"
					class:an={data.favorit}
					type="submit"
					aria-pressed={data.favorit}
					aria-label={data.favorit ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten hinzufügen'}
					title={data.favorit ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten'}
				>
					<Icon d={STERN} size={20} stroke={1.8} />
				</button>
			</form>
			<button
				type="button"
				class="rund hell"
				onclick={linkKopieren}
				aria-label={kopiert ? 'Link kopiert' : 'Link kopieren'}
				title={kopiert ? 'Link kopiert' : 'Link kopieren'}
			>
				<Icon d={LINK} size={18} stroke={2} />
			</button>
			{#if pflegen || e.canDocs}
				<a
					class="knopf weiss"
					href={pflegen
						? resolve('/(app)/abteilungen/[slug]/bearbeiten', { slug: e.slug })
						: resolve('/(app)/abteilungen/[slug]/dokumente-pflegen', { slug: e.slug })}
				>
					{pflegen ? 'Bearbeiten' : 'Dokumente pflegen'}
				</a>
			{/if}
			{#if e.team.length}
				<a class="gesichter" href={resolve('/(app)/abteilungen/[slug]/team', { slug: e.slug })}>
					<span class="stapelbild" aria-hidden="true">
						{#each e.team.slice(0, 4) as m (m.id)}<Avatar
								name={m.name}
								foto={m.foto}
								groesse={32}
							/>{/each}
					</span>
					<span>{e.team.length === 1 ? '1 Person' : `${e.team.length} Personen`} im Team</span>
				</a>
			{/if}
		</div>
	</section>

	{#if e.kontakt.email || e.kontakt.telefon || e.kontakt.sprechzeiten || e.kontakt.raum}
		<ul class="chips" aria-label="Kontakt">
			{#if e.kontakt.email}<li>
					<a class="kontaktchip" href="mailto:{e.kontakt.email}">
						<Icon d={BRIEF} size={16} stroke={1.8} />{e.kontakt.email}
					</a>
				</li>{/if}
			{#if e.kontakt.telefon}<li>
					<a class="kontaktchip" href="tel:{e.kontakt.telefon.replace(/[^0-9+]/g, '')}">
						<Icon d={TELEFON} size={16} stroke={1.8} />{e.kontakt.telefon}
					</a>
				</li>{/if}
			{#if e.kontakt.sprechzeiten}<li>
					<span class="kontaktchip">
						<Icon d={UHR} size={16} stroke={1.8} />Sprechzeiten {e.kontakt.sprechzeiten}
					</span>
				</li>{/if}
			{#if e.kontakt.raum}<li>
					<span class="kontaktchip"><Icon d={ORT} size={16} stroke={1.8} />{e.kontakt.raum}</span>
				</li>{/if}
		</ul>
	{/if}

	<nav class="reiter" aria-label="Bereiche von {e.name}">
		<ul>
			{#each reiter as r (r.key)}
				<li>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- basis kommt aus resolve() -->
					<a href={r.href} aria-current={r.aktiv ? 'page' : undefined} data-sveltekit-noscroll>
						{r.label}
						{#if r.anzahl}<span class="zahl">{r.anzahl}</span>{/if}
						{#if r.leer}<span class="leer">leer</span>{/if}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form?.ok}<p class="meldung" role="status">{form.ok}</p>{/if}
	{#if pflegen && e.pruefung.ueberfaellig}
		<div class="meldung pruefen" role="status">
			<span>
				Die Zuständigkeiten wurden zuletzt am {datum.format(e.pruefung.geprueftAm!)} geprüft. Passt noch
				alles?
			</span>
			<form method="POST" action="?/geprueft" use:enhance>
				<button class="knopf klein" type="submit">Alles geprüft</button>
			</form>
		</div>
	{/if}

	{@render children()}
</div>

<style>
	/* Kopf wie bei Hubs: Akzentfarbe mit Kreisen */
	.kopf {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 24px 28px;
		border-radius: 28px;
		background: var(--fill);
		color: #fff;
	}
	.kopf > * {
		position: relative;
	}
	.kopf > .kreis {
		position: absolute;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.08);
	}
	.kreis.eins {
		right: -60px;
		top: -60px;
		width: 240px;
		height: 240px;
	}
	.kreis.zwei {
		right: 60px;
		bottom: -90px;
		width: 180px;
		height: 180px;
		background: rgb(255 255 255 / 0.06);
	}
	.chip {
		align-self: flex-start;
		font-size: 13px;
		font-weight: 600;
		padding: 4px 12px;
		border-radius: 999px;
		/* dunkler statt heller: Kontrast für weiße Schrift auf jeder Akzentfarbe */
		background: rgb(0 0 0 / 0.25);
	}
	h1 {
		margin: 0;
		font-size: 34px;
		line-height: 1.15;
		overflow-wrap: anywhere;
	}
	.intro {
		margin: 0;
		max-width: 620px;
		font-size: 1.08em;
		color: rgb(255 255 255 / 0.92);
	}
	.leitung {
		margin: 0;
		font-size: 14px;
		color: rgb(255 255 255 / 0.92);
	}
	.leitung a {
		color: #fff;
		font-weight: 600;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.rund {
		width: 44px;
		height: 44px;
		flex: none;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.rund.hell {
		background: transparent;
		border: 1px solid rgb(255 255 255 / 0.6);
		color: #fff;
	}
	.rund.hell.an {
		background: #fff;
		color: var(--fill);
	}
	.rund.hell.an :global(svg) {
		fill: currentColor;
	}
	.knopf.weiss {
		background: #fff;
		color: var(--fill);
		border-color: #fff;
	}
	.gesichter {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		margin-left: 6px;
		font-size: 13px;
		color: #fff;
	}
	.stapelbild {
		display: inline-flex;
	}
	.stapelbild :global(.avatar) {
		margin-left: -8px;
		border: 2px solid var(--fill);
	}
	.stapelbild :global(.avatar:first-child) {
		margin-left: 0;
	}

	.chips {
		list-style: none;
		margin: -6px 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.kontaktchip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 0 14px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		font-size: 14px;
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	a.kontaktchip:hover {
		border-color: var(--ac);
	}

	/* Reiter: auf schmalen Bildschirmen seitlich schiebbar */
	.reiter {
		margin-top: -8px;
		border-bottom: 1px solid var(--bd);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.reiter::-webkit-scrollbar {
		display: none;
	}
	.reiter ul {
		list-style: none;
		margin: 0;
		padding: 0 4px;
		display: flex;
		gap: 4px;
		white-space: nowrap;
	}
	.reiter a {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 48px;
		padding: 0 12px;
		color: var(--mu);
		font-weight: 500;
		text-decoration: none;
		border-bottom: 3px solid transparent;
	}
	.reiter a:hover {
		color: var(--tx);
	}
	.reiter a[aria-current='page'] {
		color: var(--ac);
		font-weight: 700;
		border-bottom-color: var(--ac);
	}
	.zahl,
	.leer {
		font-size: 12px;
		font-weight: 600;
		border-radius: 999px;
		padding: 1px 7px;
		background: var(--bg);
		color: var(--mu);
	}
	.leer {
		background: var(--warn-bg);
		color: var(--warn-tx);
	}
	.pruefen {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}
	@media (max-width: 599px) {
		.kopf {
			padding: 20px 18px;
			border-radius: 22px;
		}
		h1 {
			font-size: 28px;
		}
		.gesichter {
			margin-left: 0;
		}
	}
</style>
