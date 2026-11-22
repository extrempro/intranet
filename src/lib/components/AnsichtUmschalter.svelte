<script lang="ts">
	/**
	 * Umschalter „Ausführlich / Kompakt“ für lange Listen mit Karten
	 * (Kap. 6.7). Speichert die Wahl je Person über die Aktion `?/ansicht`.
	 */
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { actionUrl } from '#lib/action-url.ts';
	import Icon from './Icon.svelte';

	type Ansicht = 'ausfuehrlich' | 'kompakt';
	let { ansicht = $bindable() }: { ansicht: Ansicht } = $props();

	const WAHL: { wert: Ansicht; label: string; d: string }[] = [
		{ wert: 'ausfuehrlich', label: 'Ansicht: ausführlich', d: 'M4 4h16v7h-16zM4 15h16v5h-16z' },
		{ wert: 'kompakt', label: 'Ansicht: kompakt', d: 'M4 5h16M4 10h16M4 15h16M4 20h16' }
	];
</script>

<form
	method="POST"
	action={actionUrl(page.url.search, 'ansicht')}
	class="ansicht"
	use:enhance={({ formData }) => {
		const wert = formData.get('ansicht');
		if (wert === 'ausfuehrlich' || wert === 'kompakt') ansicht = wert;
		return async ({ update }) => update({ reset: false, invalidateAll: false });
	}}
>
	<div role="group" aria-label="Ansicht">
		{#each WAHL as w (w.wert)}
			<button
				type="submit"
				name="ansicht"
				value={w.wert}
				aria-pressed={ansicht === w.wert}
				aria-label={w.label}
				title={w.label}
			>
				<Icon d={w.d} size={20} stroke={2} />
			</button>
		{/each}
	</div>
</form>

<style>
	.ansicht {
		flex: none;
	}
	div {
		display: flex;
		gap: 2px;
		padding: 3px;
		border-radius: 999px;
		background: var(--bg2, color-mix(in srgb, var(--mu) 14%, transparent));
	}
	button {
		width: 44px;
		height: 38px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--mu);
		cursor: pointer;
	}
	button[aria-pressed='true'] {
		background: var(--sf);
		color: var(--ac);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.12);
	}
	button:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 1px;
	}
</style>
