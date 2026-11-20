<script lang="ts">
	/** Strich-Symbol 24×24; rein dekorativ (aria-hidden). */
	let { d, size = 22, stroke = 1.7 }: { d: string; size?: number; stroke?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	style="flex: none"
>
	<path {d} />
</svg>
