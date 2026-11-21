<script lang="ts">
	/**
	 * Ablagefläche für eine PDF: hineinziehen oder über „PDF auswählen“ wählen.
	 * Das echte Datei-Feld bleibt im Formular (nur unsichtbar), damit das
	 * Absenden wie bisher funktioniert.
	 */
	import { formatSize } from '#lib/format.ts';

	let { name = 'datei', fehler = $bindable('') }: { name?: string; fehler?: string } = $props();
	let feld: HTMLInputElement | undefined = $state();
	let datei = $state<{ name: string; groesse: number } | null>(null);
	let drueber = $state(false);
	const uid = $props.id();

	function gewaehlt() {
		const f = feld?.files?.[0];
		datei = f ? { name: f.name, groesse: f.size } : null;
		if (f) fehler = '';
	}

	function abgelegt(e: DragEvent) {
		e.preventDefault();
		drueber = false;
		const f = e.dataTransfer?.files?.[0];
		if (!f || !feld) return;
		if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
			fehler = 'Bitte nur eine PDF-Datei ablegen.';
			return;
		}
		const dt = new DataTransfer();
		dt.items.add(f);
		feld.files = dt.files;
		gewaehlt();
	}

	/** Nach erfolgreichem Hochladen leert das Formular das Feld; Anzeige nachziehen. */
	export function leeren() {
		if (feld) feld.value = '';
		datei = null;
	}
</script>

<div
	class="zone"
	class:drueber
	role="group"
	aria-labelledby="{uid}-text"
	ondragover={(e) => {
		e.preventDefault();
		drueber = true;
	}}
	ondragleave={() => (drueber = false)}
	ondrop={abgelegt}
>
	<svg
		width="32"
		height="32"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.6"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M14 3v4a1 1 0 0 0 1 1h4" />
		<path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z" />
		<path d="M12 11v6M9.5 13.5l2.5 -2.5l2.5 2.5" />
	</svg>
	<span id="{uid}-text" class="mu">PDF hierher ziehen oder</span>
	<button class="knopf zweit" type="button" onclick={() => feld?.click()}>PDF auswählen</button>
	<input
		bind:this={feld}
		class="sr-only"
		type="file"
		{name}
		accept=".pdf,application/pdf"
		tabindex="-1"
		aria-hidden="true"
		onchange={gewaehlt}
	/>
	{#if datei}
		<strong role="status">{datei.name} · {formatSize(datei.groesse)}</strong>
	{/if}
</div>

<style>
	.zone {
		border: 2px dashed var(--bd);
		border-radius: 14px;
		padding: 24px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		text-align: center;
		color: var(--ac);
	}
	.zone.drueber {
		border-color: var(--ac);
		background: var(--tint);
	}
	.mu {
		color: var(--mu);
	}
	strong {
		color: var(--tx);
	}
</style>
