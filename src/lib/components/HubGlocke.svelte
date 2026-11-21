<script lang="ts">
	/** Glocke zum Abonnieren eines Hubs; bei Pflicht-Abo gesperrt mit Schloss (Kap. 8.3). */
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { actionUrl } from '#lib/action-url.ts';

	let {
		hub,
		aufFarbe = false
	}: {
		hub: { id: string; name: string; subscribed: boolean; mandatory: boolean };
		/** Auf farbigem Hintergrund (Kopf der Hub-Seite) */
		aufFarbe?: boolean;
	} = $props();
	const label = $derived(
		hub.mandatory
			? `${hub.name}: Pflicht-Abo, lässt sich nicht beenden`
			: hub.subscribed
				? `${hub.name} abonniert – Abo beenden`
				: `${hub.name} abonnieren`
	);
</script>

<form
	method="POST"
	action={actionUrl(page.url.search, hub.subscribed ? 'abbestellen' : 'abonnieren')}
	use:enhance
	class="glocke"
>
	<input type="hidden" name="hub" value={hub.id} />
	<button
		type="submit"
		aria-pressed={hub.subscribed}
		aria-label={label}
		title={label}
		disabled={hub.mandatory}
		class:an={hub.subscribed}
		class:farbe={aufFarbe}
	>
		<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
			<path
				d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6"
				fill={hub.subscribed ? 'currentColor' : 'none'}
			/>
			<path d="M9 17v1a3 3 0 0 0 6 0v-1" fill="none" />
		</svg>
		{#if hub.mandatory}<span class="schloss" aria-hidden="true">🔒</span>{/if}
	</button>
</form>

<style>
	.glocke {
		display: inline-flex;
	}
	button {
		position: relative;
		width: 40px;
		height: 40px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	button.an {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
	}
	button.farbe {
		width: 44px;
		height: 44px;
		background: transparent;
		border-color: rgb(255 255 255 / 0.6);
		color: #fff;
	}
	button.farbe.an {
		background: #fff;
		border-color: #fff;
		color: var(--fill);
	}
	button:disabled {
		cursor: default;
		opacity: 1;
	}
	svg path {
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.schloss {
		position: absolute;
		right: -4px;
		bottom: -4px;
		font-size: 11px;
		background: var(--sf);
		border: 1px solid var(--bd);
		border-radius: 999px;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
