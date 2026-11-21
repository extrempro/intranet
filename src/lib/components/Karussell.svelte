<script lang="ts">
	/**
	 * Fotos eines Beitrags als Karussell: Pfeile, Punkte, Zähler. Blättert
	 * automatisch weiter (anhaltbar), außer bei „Bewegung reduzieren“, beim
	 * Darüberfahren und solange der Fokus im Karussell ist.
	 */
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';

	let { bilder, titel }: { bilder: { id: string }[]; titel: string } = $props();

	const SEKUNDEN = 6;
	let nr = $state(0);
	let laeuft = $state(false);
	let darueber = $state(false);
	let fokus = $state(false);
	const mehrere = $derived(bilder.length > 1);

	onMount(() => {
		const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
		laeuft = mehrere && !ruhig;
	});

	$effect(() => {
		if (!laeuft || darueber || fokus || !mehrere) return;
		const t = setInterval(() => (nr = (nr + 1) % bilder.length), SEKUNDEN * 1000);
		return () => clearInterval(t);
	});

	const geh = (i: number) => (nr = (i + bilder.length) % bilder.length);

	const LINKS = 'M15 6l-6 6l6 6';
	const RECHTS = 'M9 6l6 6l-6 6';
</script>

<section
	class="karussell"
	aria-roledescription="Karussell"
	aria-label="Fotos zu „{titel}“"
	onmouseenter={() => (darueber = true)}
	onmouseleave={() => (darueber = false)}
	onfocusin={() => (fokus = true)}
	onfocusout={() => (fokus = false)}
>
	<div class="buehne">
		<img
			src={resolve('/(app)/dateien/[id]', { id: bilder[nr].id })}
			alt="Foto {nr + 1} von {bilder.length} zu „{titel}“"
		/>
		{#if mehrere}
			<button
				type="button"
				class="pause"
				onclick={() => (laeuft = !laeuft)}
				aria-label={laeuft ? 'Automatisches Blättern anhalten' : 'Automatisch blättern'}
			>
				{#if laeuft}
					<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
						<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
						<rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
					</svg>
					Pause
				{:else}
					<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
						<path d="M7 5l12 7l-12 7z" fill="currentColor" />
					</svg>
					Abspielen
				{/if}
			</button>
			<span class="zaehler" aria-live={laeuft ? 'off' : 'polite'}>{nr + 1} / {bilder.length}</span>
			<button
				type="button"
				class="pfeil links"
				onclick={() => geh(nr - 1)}
				aria-label="Vorheriges Foto"
			>
				<Icon d={LINKS} size={20} stroke={2} />
			</button>
			<button
				type="button"
				class="pfeil rechts"
				onclick={() => geh(nr + 1)}
				aria-label="Nächstes Foto"
			>
				<Icon d={RECHTS} size={20} stroke={2} />
			</button>
			<div class="punkte">
				{#each bilder as b, i (b.id)}
					<button
						type="button"
						class:aktiv={i === nr}
						aria-label="Foto {i + 1}"
						aria-current={i === nr ? 'true' : undefined}
						onclick={() => geh(i)}
					></button>
				{/each}
			</div>
		{/if}
	</div>
</section>

<style>
	.karussell {
		margin: 0;
	}
	.buehne {
		position: relative;
		border-radius: 16px;
		overflow: hidden;
		background: var(--bg);
		border: 1px solid var(--bd);
	}
	img {
		display: block;
		width: 100%;
		height: min(60vh, 480px);
		object-fit: contain;
	}
	.pause,
	.zaehler {
		position: absolute;
		top: 10px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		min-height: 30px;
		border-radius: 999px;
		background: rgb(0 0 0 / 0.6);
		color: #fff;
		font: inherit;
		font-size: 12px;
		font-weight: 600;
	}
	.pause {
		left: 10px;
		border: 0;
		cursor: pointer;
	}
	.zaehler {
		right: 10px;
	}
	.pfeil {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 44px;
		height: 44px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		border: 1px solid var(--bd);
		border-radius: 999px;
		background: var(--sf);
		color: var(--tx);
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
		cursor: pointer;
	}
	.links {
		left: 12px;
	}
	.rechts {
		right: 12px;
	}
	.punkte {
		position: absolute;
		bottom: 8px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 2px;
	}
	/* Punkt klein sichtbar, Trefffläche 24 × 24 */
	.punkte button {
		width: 24px;
		height: 24px;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.punkte button::before {
		content: '';
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.8);
		box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35);
		transition: width 0.2s ease;
	}
	.punkte button.aktiv::before {
		width: 20px;
		background: #fff;
	}
</style>
