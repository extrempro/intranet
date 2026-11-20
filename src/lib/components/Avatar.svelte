<script lang="ts">
	/** Profilfoto oder Kürzel (dekorativ, der Name steht daneben). */
	import { initials } from '#lib/format.ts';

	let {
		name,
		foto = null,
		groesse = 40
	}: { name: string; foto?: string | null; groesse?: number } = $props();
</script>

<span
	class="avatar"
	style:width="{groesse}px"
	style:height="{groesse}px"
	style:font-size="{Math.round(groesse * 0.36)}px"
	aria-hidden="true"
>
	{#if foto}<img src={foto} alt="" loading="lazy" />{:else}{initials(name)}{/if}
</span>

<style>
	.avatar {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		overflow: hidden;
		background: var(--tint);
		color: var(--ac);
		font-weight: 700;
		border: 1px solid var(--bd);
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
