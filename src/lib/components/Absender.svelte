<script lang="ts">
	/** Absenderzeile eines Beitrags: Kürzel, Einheit (verlinkt), Art und Zeitpunkt. */
	import { resolve } from '$app/paths';

	let {
		name,
		label,
		slug = null,
		hub = false,
		wann
	}: { name: string; label: string; slug?: string | null; hub?: boolean; wann: string } = $props();

	const kuerzel = $derived(name.length <= 3 ? name : name.charAt(0));
	const href = $derived(
		slug
			? hub
				? resolve('/(app)/hubs/[slug]', { slug })
				: resolve('/(app)/abteilungen/[slug]', { slug })
			: null
	);
</script>

<div class="absender">
	<span class="kuerzel" aria-hidden="true">{kuerzel}</span>
	{#if href}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- oben mit resolve() gebaut -->
		<a class="einheit" {href} title="Zur Seite {name}">{name}</a>
	{:else}
		<strong class="einheit">{name}</strong>
	{/if}
	<span>{label} · {wann}</span>
</div>

<style>
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
		color: var(--tx);
		font-weight: 700;
		text-decoration: underline;
		text-decoration-color: var(--bd);
		text-underline-offset: 3px;
	}
	strong.einheit {
		text-decoration: none;
	}
</style>
