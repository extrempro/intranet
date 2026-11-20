<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Ziele kommen aus dem festen Register in nav.ts */
	/**
	 * Liste der Unterseiten einer Bereichsübersicht (Entwurf „aktHome“):
	 * Symbol, Titel, Kurztext, ggf. Zähler, Pfeil.
	 */
	import Icon from './Icon.svelte';

	interface Zeile {
		key: string;
		label: string;
		href: string;
		icon: string;
		text: string;
		zahl?: number;
	}
	let { zeilen }: { zeilen: Zeile[] } = $props();
	const PFEIL = 'M9 6l6 6l-6 6';
</script>

<ul class="liste">
	{#each zeilen as z (z.key)}
		<li>
			<a href={z.href}>
				<span class="symbol" aria-hidden="true"><Icon d={z.icon} size={20} stroke={1.8} /></span>
				<span class="text">
					<strong>{z.label}</strong>
					<span class="unter">{z.text}</span>
				</span>
				{#if z.zahl}<span class="zahl" aria-label="{z.zahl} neu">{z.zahl}</span>{/if}
				<span class="pfeil" aria-hidden="true"><Icon d={PFEIL} size={18} stroke={2} /></span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		background: var(--sf);
		border: 1px solid var(--bd);
		border-radius: 16px;
		overflow: hidden;
	}
	li + li {
		border-top: 1px solid var(--bd);
	}
	a {
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: 68px;
		padding: 12px 16px;
		box-sizing: border-box;
		color: var(--tx);
		text-decoration: none;
	}
	a:hover {
		background: var(--bg);
	}
	.symbol {
		flex: none;
		width: 40px;
		height: 40px;
		border-radius: 12px;
		background: var(--tint);
		color: var(--ac);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	strong {
		font-size: 15px;
		font-weight: 600;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
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
	.pfeil {
		flex: none;
		display: inline-flex;
		color: var(--mu);
	}
</style>
