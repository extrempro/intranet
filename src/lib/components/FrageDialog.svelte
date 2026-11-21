<script lang="ts">
	/**
	 * Fenster für Bestätigungen (src/lib/frage.svelte.ts). Einmal im Layout.
	 * PC und Tablet: in der Mitte, Knöpfe rechts nebeneinander.
	 * Handy: von unten, große Knöpfe untereinander (Bestätigen oben).
	 * Escape oder ein Klick daneben bricht ab; danach Fokus zurück.
	 */
	import { tick } from 'svelte';
	import { frageZustand } from '#lib/frage.svelte.ts';

	let dialog: HTMLDialogElement | undefined = $state();
	let neinKnopf: HTMLButtonElement | undefined = $state();
	let jaKnopf: HTMLButtonElement | undefined = $state();
	let vorher: Element | null = null;

	const f = $derived(frageZustand.aktiv);

	$effect(() => {
		if (!dialog) return;
		if (f && !dialog.open) {
			vorher = document.activeElement;
			dialog.showModal();
			void tick().then(() => (f.gefahr ? neinKnopf : jaKnopf)?.focus());
		} else if (!f && dialog.open) {
			dialog.close();
			if (vorher instanceof HTMLElement && vorher.isConnected) vorher.focus();
		}
	});

	function antworte(ja: boolean) {
		frageZustand.aktiv?.antwort(ja);
	}
</script>

<dialog
	bind:this={dialog}
	class="frage"
	role="alertdialog"
	aria-labelledby="frage-titel"
	aria-describedby={f?.text ? 'frage-text' : undefined}
	oncancel={(e) => {
		e.preventDefault();
		antworte(false);
	}}
	onclick={(e) => {
		if (e.target === dialog) antworte(false);
	}}
>
	{#if f}
		<div class="innen">
			<h2 id="frage-titel">{f.titel}</h2>
			{#if f.text}<p id="frage-text">{f.text}</p>{/if}
			<div class="knoepfe">
				<button
					bind:this={neinKnopf}
					class="knopf zweit"
					type="button"
					onclick={() => antworte(false)}
				>
					{f.nein ?? 'Abbrechen'}
				</button>
				<button
					bind:this={jaKnopf}
					class={['knopf', f.gefahr && 'rot']}
					type="button"
					onclick={() => antworte(true)}
				>
					{f.ja}
				</button>
			</div>
		</div>
	{/if}
</dialog>

<style>
	.frage {
		width: min(28rem, calc(100vw - 32px));
		padding: 0;
		border: 1px solid var(--bd);
		border-radius: 14px;
		background: var(--sf);
		color: var(--tx);
		box-shadow: var(--shadow);
	}
	.frage::backdrop {
		background: rgb(0 0 0 / 0.4);
	}
	.innen {
		padding: 22px;
		display: grid;
		gap: 10px;
	}
	h2 {
		margin: 0;
		font-size: 1.2rem;
		line-height: 1.3;
	}
	p {
		margin: 0;
		color: var(--mu);
		white-space: pre-line;
	}
	.knoepfe {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 10px;
	}

	/* Handy: von unten, Knöpfe über die ganze Breite, Bestätigen oben */
	@media (max-width: 599px) {
		.frage {
			width: 100%;
			max-width: 100%;
			margin: auto 0 0;
			border-radius: 16px 16px 0 0;
			border-bottom: 0;
		}
		.frage[open] {
			animation: hoch 0.18s ease-out;
		}
		.innen {
			padding: 22px 18px calc(18px + env(safe-area-inset-bottom));
		}
		.knoepfe {
			flex-direction: column-reverse;
		}
		.knoepfe .knopf {
			width: 100%;
			min-height: 50px;
		}
	}
	@keyframes hoch {
		from {
			transform: translateY(100%);
		}
		to {
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.frage[open] {
			animation: none;
		}
	}
</style>
