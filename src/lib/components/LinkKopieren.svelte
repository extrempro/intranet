<script lang="ts">
	/** Runder Knopf, der den Link zu einer Seite in die Zwischenablage kopiert. */
	import Icon from './Icon.svelte';

	let { href = '' }: { href?: string } = $props();
	let kopiert = $state(false);

	async function kopieren() {
		try {
			const ziel = href ? new URL(href, location.origin).href : location.href;
			await navigator.clipboard.writeText(ziel);
			kopiert = true;
			setTimeout(() => (kopiert = false), 2000);
		} catch {
			// ohne Zwischenablage: nichts tun
		}
	}

	const LINK =
		'M9 15l6 -6M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463';
</script>

<button
	type="button"
	class="rund"
	onclick={kopieren}
	aria-label={kopiert ? 'Link kopiert' : 'Link kopieren'}
	title={kopiert ? 'Link kopiert' : 'Link kopieren'}
>
	<Icon d={LINK} size={18} stroke={1.9} />
</button>
<span class="sr-only" aria-live="polite">{kopiert ? 'Link kopiert' : ''}</span>

<style>
	.rund {
		flex: none;
		width: 38px;
		height: 38px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--bd);
		border-radius: 999px;
		background: var(--sf);
		color: var(--tx);
		cursor: pointer;
	}
</style>
