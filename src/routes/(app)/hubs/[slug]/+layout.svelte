<script lang="ts">
	/** Hub-Seite: Kopf, Hinweise und Reiter; die Reiter sind eigene Unterseiten. */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Avatar from '#lib/components/Avatar.svelte';
	import HubGlocke from '#lib/components/HubGlocke.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { reiterStand } from '#lib/hub-seite.ts';

	let { data, children } = $props();
	const h = $derived(data.hub);
	const form = $derived(page.form as { fehler?: string; ok?: string } | null);
	const zeit = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeZone: 'Europe/Berlin' });
	const STERN =
		'M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z';
	const LINK =
		'M9 15l6 -6M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463';
	const INFO = 'M12 9h.01M11 12h1v4h1M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18';

	const basis = $derived(resolve('/(app)/hubs/[slug]', { slug: h.slug }));
	const pfad = $derived(page.url.pathname.replace(/\/$/, ''));
	const reiter = $derived(
		[
			{ key: 'ueberblick', label: 'Überblick', href: basis, anzahl: null, leer: false },
			...reiterStand(data)
				.map((r) => ({ ...r, href: `${basis}/${r.pfad}` }))
				.filter((r) => !r.leer || r.pflegbar || pfad === r.href)
		].map((r) => ({ ...r, aktiv: pfad === r.href }))
	);

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
	<section
		class="kopf"
		class:mitbild={Boolean(h.coverUrl)}
		style:--titelbild={h.coverUrl ? `url("${h.coverUrl}")` : undefined}
		aria-labelledby="h-h"
	>
		{#if !h.coverUrl}
			<span class="kreis eins" aria-hidden="true"></span>
			<span class="kreis zwei" aria-hidden="true"></span>
		{/if}
		<div class="kopfzeile">
			{#if h.iconUrl}<img class="hubsymbol" src={h.iconUrl} alt="" />{/if}
			<span class="chip">
				Hub&nbsp;· {h.isCentral ? 'Thema für alle Mandanten' : h.tenantName}{#if h.mandatory}&nbsp;·
					Pflicht-Abo{/if}
			</span>
		</div>
		<h1 id="h-h">{h.name}</h1>
		{#if h.about}<p class="intro">{h.about}</p>{/if}
		<div class="aktionen">
			<HubGlocke
				aufFarbe
				hub={{ id: h.id, name: h.name, subscribed: h.subscribed, mandatory: h.mandatory }}
			/>
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
			{#if h.canManage || h.canDocs}
				<a class="knopf weiss" href={resolve('/(app)/hubs/[slug]/bearbeiten', { slug: h.slug })}>
					{h.canManage ? 'Bearbeiten' : 'Dokumente pflegen'}
				</a>
			{/if}
			{#if h.team.length}
				<a class="gesichter" href={resolve('/(app)/hubs/[slug]/team', { slug: h.slug })}>
					<span class="stapelbild" aria-hidden="true">
						{#each h.team.slice(0, 4) as m (m.id)}<Avatar
								name={m.name}
								foto={m.foto}
								groesse={32}
							/>{/each}
					</span>
					<span>
						Hub-Team{#if h.teamAbteilungen}&nbsp;aus {h.teamAbteilungen === 1
								? '1 Abteilung'
								: `${h.teamAbteilungen} Abteilungen`}{/if}
					</span>
				</a>
				{#if h.abonnierende !== null}
					<span class="abos">{h.abonnierende} {h.abonnierende === 1 ? 'Abo' : 'Abos'}</span>
				{/if}
			{/if}
		</div>
	</section>

	<nav class="reiter" aria-label="Bereiche von {h.name}">
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
	{#if h.resting}
		<p class="status" role="status">
			<strong>Ruht</strong><span>
				Dieser Hub ruht seit {zeit.format(h.resting)}. Es erscheinen keine neuen Beiträge, alles
				bleibt lesbar.
			</span>
		</p>
	{/if}
	{#if h.notice}
		<div class="banner" role="note">
			<Icon d={INFO} size={20} stroke={2} />
			<span class="bannertext">{h.notice}</span>
			{#if h.noticeUntil}<span class="bis">
					bis {zeit.format(new Date(`${h.noticeUntil}T12:00:00Z`))}
				</span>{/if}
		</div>
	{/if}

	{@render children()}
</div>

<style>
	/* Kopf: Akzentfarbe mit Kreisen, oder das Titelbild abgedunkelt */
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
	.kopf.mitbild {
		background:
			linear-gradient(90deg, rgb(0 0 0 / 0.72), rgb(0 0 0 / 0.35)),
			var(--titelbild) center / cover;
		min-height: 200px;
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
	.kopfzeile {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.hubsymbol {
		width: 56px;
		height: 56px;
		border-radius: 14px;
		border: 2px solid rgb(255 255 255 / 0.85);
		background: #fff;
	}
	.chip {
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
	.abos {
		font-size: 13px;
		color: rgb(255 255 255 / 0.9);
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

	.status {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		margin: 0;
		padding: 12px 16px;
		border-radius: 14px;
		background: var(--bg);
		border: 1px dashed var(--bd);
	}
	.status span {
		color: var(--mu);
	}
	.banner {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 12px 16px;
		border-radius: 14px;
		background: var(--warn-bg);
		border: 1px solid var(--warn-bd);
		color: var(--warn-tx);
	}
	.bannertext {
		flex: 1;
		white-space: pre-line;
	}
	.bis {
		font-size: 13px;
		opacity: 0.85;
	}
</style>
