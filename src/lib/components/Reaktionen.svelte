<script lang="ts">
	import { enhance } from '$app/forms';

	let {
		newsId,
		reaktionen
	}: { newsId: string; reaktionen: { emoji: string; n: number; mine: boolean }[] } = $props();

	const NAMEN: Record<string, string> = {
		'👍': 'Daumen hoch',
		'❤️': 'Herz',
		'👏': 'Applaus',
		'😂': 'Lachen',
		'😮': 'Staunen'
	};
</script>

<form
	method="POST"
	action="/neuigkeiten/{newsId}?/reagieren"
	use:enhance={() =>
		async ({ update }) =>
			update({ reset: false, invalidateAll: true })}
	class="reaktionen"
>
	<span class="sr-only">Reaktionen</span>
	{#each reaktionen as r (r.emoji)}
		<button
			type="submit"
			name="emoji"
			value={r.emoji}
			class:mine={r.mine}
			aria-pressed={r.mine}
			aria-label="{NAMEN[r.emoji] ?? r.emoji}, {r.n}{r.mine ? ', deine Reaktion' : ''}"
		>
			<span aria-hidden="true">{r.emoji}</span>{#if r.n}<span aria-hidden="true">{r.n}</span>{/if}
		</button>
	{/each}
</form>

<style>
	.reaktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		position: relative;
		z-index: 1;
	}
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		min-height: 40px;
		min-width: 48px;
		padding: 4px 12px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		font: inherit;
		cursor: pointer;
	}
	button.mine {
		background: var(--tint);
		border: 2px solid var(--ac);
		color: var(--ac);
	}
</style>
