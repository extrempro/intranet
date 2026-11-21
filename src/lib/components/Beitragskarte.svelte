<script lang="ts">
	/**
	 * Beitrag in Listen (Entwurf „newsList“): Schilder, Titel, Absender,
	 * Auszug, „Weiterlesen“, Fußzeile mit Anhängen, Reaktionen, Link und
	 * Bearbeiten (nur mit Schreibrecht).
	 */
	import { resolve } from '$app/paths';
	import { formatWhen, formatDay } from '#lib/news.ts';
	import Icon from './Icon.svelte';

	interface Item {
		id: string;
		title: string;
		excerpt: string;
		publishAt: Date;
		expiresAt: Date | null;
		urgentUntil: Date | null;
		planned: boolean;
		urgent: boolean;
		wasUrgent: boolean;
		pinned: boolean;
		audience: string;
		attachmentCount: number;
		canEdit?: boolean;
		sender: { name: string; label: string; slug?: string; hub?: boolean };
		reactions: { emoji: string; n: number; mine: boolean }[];
	}
	let {
		item,
		mitReaktionen = true,
		ebene = 2
	}: { item: Item; mitReaktionen?: boolean; ebene?: 2 | 3 } = $props();

	const kuerzel = $derived(
		item.sender.name.length <= 3 ? item.sender.name : item.sender.name.charAt(0)
	);
	const reaktionen = $derived.by(() => {
		const mit = item.reactions.filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
		const summe = mit.reduce((s, r) => s + r.n, 0);
		return { summe, oben: mit.slice(0, 3).map((r) => r.emoji) };
	});
	const absenderHref = $derived(
		item.sender.slug
			? item.sender.hub
				? resolve('/(app)/hubs/[slug]', { slug: item.sender.slug })
				: resolve('/(app)/abteilungen/[slug]', { slug: item.sender.slug })
			: null
	);
	const href = $derived(resolve('/(app)/neuigkeiten/[id]', { id: item.id }));

	let kopiert = $state(false);
	async function linkKopieren() {
		try {
			await navigator.clipboard.writeText(new URL(href, location.origin).href);
			kopiert = true;
			setTimeout(() => (kopiert = false), 2000);
		} catch {
			// ohne Zwischenablage: nichts tun
		}
	}

	const PIN = 'M15 4.5l-4 4l-4 1.5l-1.5 1.5l7 7l1.5 -1.5l1.5 -4l4 -4M9 15l-4.5 4.5M14.5 4l5.5 5.5';
	const PFEIL = 'M5 12h14M13 18l6 -6M13 6l6 6';
	const KLAMMER =
		'M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5';
	const LINK =
		'M9 15l6 -6M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463';
</script>

<article class="karte beitrag">
	<div class="schilder">
		{#if item.pinned}<span class="schild mit-symbol">
				<Icon d={PIN} size={12} stroke={2.2} />Angeheftet
			</span>{/if}
		{#if item.planned}<span class="schild warn">
				Geplant · erscheint {formatWhen(item.publishAt)}
			</span>{/if}
		{#if item.urgent && item.urgentUntil}<span class="schild rot">
				Dringend bis {formatWhen(item.urgentUntil)}
			</span>{/if}
		{#if item.wasUrgent}<span class="schild rand">War dringend</span>{/if}
		{#if item.audience}<span class="schild">{item.audience}</span>{/if}
	</div>
	<svelte:element this={`h${ebene}`} class="titel">
		<a class="dehnen titellink" {href}>{item.title}</a>
	</svelte:element>
	<div class="absender">
		<span class="kuerzel" aria-hidden="true">{kuerzel}</span>
		{#if absenderHref}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- oben mit resolve() gebaut -->
			<a class="einheit" href={absenderHref} title="Zur Seite {item.sender.name}">
				{item.sender.name}
			</a>
		{:else}
			<strong class="einheit">{item.sender.name}</strong>
		{/if}
		<span>{item.sender.label} · {formatDay(item.publishAt)}</span>
	</div>
	{#if item.excerpt}<p class="auszug">{item.excerpt}</p>{/if}
	<span class="weiter" aria-hidden="true">
		Weiterlesen <Icon d={PFEIL} size={16} stroke={2.2} />
	</span>
	<div class="fuss">
		<div class="infos">
			{#if item.attachmentCount}<span class="mit-symbol">
					<Icon d={KLAMMER} size={14} stroke={2} />
					{item.attachmentCount === 1 ? '1 Anhang' : `${item.attachmentCount} Anhänge`}
				</span>{/if}
			{#if item.expiresAt}<span>Sichtbar bis {formatDay(item.expiresAt)}</span>{/if}
			{#if mitReaktionen && reaktionen.summe}<span
					aria-label="{reaktionen.summe} {reaktionen.summe === 1 ? 'Reaktion' : 'Reaktionen'}"
				>
					<span aria-hidden="true">{reaktionen.oben.join('')}</span>
					{reaktionen.summe}
				</span>{/if}
		</div>
		<div class="werkzeuge">
			<button
				type="button"
				class="rund"
				onclick={linkKopieren}
				aria-label={kopiert ? 'Link kopiert' : 'Link kopieren'}
				title={kopiert ? 'Link kopiert' : 'Link kopieren'}
			>
				<Icon d={LINK} size={16} stroke={2} />
			</button>
			{#if item.canEdit}
				<a
					class="knopf zweit klein"
					href={resolve('/(app)/neuigkeiten/[id]/bearbeiten', { id: item.id })}
				>
					Bearbeiten
				</a>
			{/if}
		</div>
	</div>
</article>

<style>
	.beitrag {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
		transition:
			box-shadow 0.15s ease,
			transform 0.15s ease;
	}
	.beitrag:hover {
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.08);
	}
	@media (prefers-reduced-motion: no-preference) {
		.beitrag:hover {
			transform: translateY(-2px);
		}
	}
	.beitrag:has(.dehnen:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.schilder {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.schilder:empty {
		display: none;
	}
	.mit-symbol {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.schild.rot {
		background: var(--rot);
		color: #fff;
	}
	.schild.warn {
		background: var(--warn-bg);
		color: var(--warn-tx);
	}
	.titel {
		margin: 0;
		font-size: 19px;
		line-height: 1.3;
	}
	.dehnen:focus-visible {
		outline: none;
	}
	.dehnen::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
	}
	.absender {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 8px;
		font-size: 14px;
		color: var(--mu);
	}
	.kuerzel {
		flex: none;
		width: 22px;
		height: 22px;
		border-radius: 7px;
		background: var(--fill);
		color: #fff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 11px;
	}
	.einheit {
		position: relative;
		z-index: 1;
		color: var(--tx);
		font-weight: 700;
		text-decoration: underline;
		text-decoration-color: var(--bd);
		text-underline-offset: 3px;
	}
	strong.einheit {
		text-decoration: none;
	}
	.auszug {
		margin: 0;
		color: var(--mu);
	}
	.weiter {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--ac);
		font-weight: 600;
		font-size: 14px;
	}
	.fuss {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		font-size: 13px;
		color: var(--mu);
	}
	.infos {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
	}
	.werkzeuge {
		position: relative;
		z-index: 1;
		display: flex;
		gap: 8px;
	}
	.rund {
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--bd);
		border-radius: 999px;
		background: transparent;
		color: var(--tx);
		cursor: pointer;
	}
	.klein {
		min-height: 36px;
		padding: 6px 12px;
		font-size: 13px;
	}
</style>
