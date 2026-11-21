<script lang="ts">
	/**
	 * Fenster „Rückmeldung geben“ über der aktuellen Seite (Kopfzeile).
	 * Schließen fragt nach, solange Text oder Bild nicht gesendet sind.
	 */
	import { page } from '$app/state';
	import { frage } from '#lib/frage.svelte.ts';
	import RueckmeldungFormular from './RueckmeldungFormular.svelte';

	let {
		offen = $bindable(false),
		version,
		inTeams
	}: { offen: boolean; version: string; inTeams: boolean } = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let hatEingabe = $state(false);
	let nimmtAuf = $state(false);
	// Seite beim Öffnen festhalten (nicht die, auf die man danach wechselt)
	let von = $state('/');
	let ausloeser: Element | null = null;

	$effect(() => {
		if (!dialog) return;
		if (offen && !dialog.open) {
			von = page.url.pathname + page.url.search;
			ausloeser = document.activeElement;
			dialog.showModal();
		} else if (!offen && dialog.open) {
			dialog.close();
		}
	});

	async function schliessen() {
		if (
			hatEingabe &&
			!(await frage({
				titel: 'Rückmeldung verwerfen?',
				text: 'Dein Text ist noch nicht gesendet.',
				ja: 'Verwerfen',
				nein: 'Weiter schreiben',
				gefahr: true
			}))
		)
			return;
		offen = false;
		hatEingabe = false;
		if (ausloeser instanceof HTMLElement) ausloeser.focus();
	}
</script>

<dialog
	bind:this={dialog}
	class="rueckmeldung"
	class:unsichtbar={nimmtAuf}
	aria-labelledby="rm-titel"
	oncancel={(e) => {
		e.preventDefault();
		schliessen();
	}}
	onclick={(e) => {
		// Klick auf den abgedunkelten Rand schließt
		if (e.target === dialog) schliessen();
	}}
>
	<div class="innen">
		<div class="kopf">
			<h2 id="rm-titel">Rückmeldung geben</h2>
			<button class="zu" type="button" aria-label="Schließen" onclick={schliessen}>×</button>
		</div>
		{#if offen}
			<RueckmeldungFormular
				{von}
				{version}
				{inTeams}
				imFenster
				bind:hatEingabe
				onfertig={() => {
					hatEingabe = false;
					schliessen();
				}}
				onabbrechen={schliessen}
				onaufnahme={(l) => (nimmtAuf = l)}
			/>
		{/if}
	</div>
</dialog>

<style>
	.rueckmeldung {
		width: min(40rem, calc(100vw - 24px));
		max-height: calc(100dvh - 24px);
		padding: 0;
		border: 1px solid var(--bd);
		border-radius: 14px;
		background: var(--sf);
		color: var(--tx);
		box-shadow: var(--shadow);
	}
	.rueckmeldung::backdrop {
		background: rgb(0 0 0 / 0.4);
	}
	/* Während der Aufnahme nicht mit aufs Bild */
	.rueckmeldung.unsichtbar,
	.rueckmeldung.unsichtbar::backdrop {
		visibility: hidden;
	}
	.innen {
		padding: 20px;
		display: grid;
		gap: 12px;
	}
	.kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	h2 {
		margin: 0;
		font-size: 1.25rem;
	}
	.zu {
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 10px;
		background: transparent;
		color: var(--tx);
		font-size: 26px;
		line-height: 1;
		cursor: pointer;
	}
	.zu:hover {
		background: var(--bg);
	}
</style>
