<script lang="ts">
	/**
	 * Rückmeldung geben (Kap. 13): Fehler oder Idee. Bei Fehlern gehen
	 * technische Angaben und ein freiwilliges Bildschirmfoto mit; beides sehen
	 * nur die System-Admins. Ideen liest die Verwaltung des Mandanten.
	 * Genutzt im Fenster (Kopfzeile) und auf der Seite /rueckmeldung/neu.
	 */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onDestroy, untrack } from 'svelte';
	import { bildAusDatei, kannAufnehmen, nimmAuf } from '#lib/bildschirmfoto.ts';
	import { letzteBrowserfehler } from '#lib/browserfehler.ts';
	import { FEEDBACK_KINDS, FEEDBACK_MAX } from '#lib/feedback.ts';

	let {
		von,
		version,
		inTeams,
		imFenster = false,
		eingabe = null,
		fehlerVomServer = null,
		onfertig,
		onabbrechen,
		onaufnahme,
		hatEingabe = $bindable(false)
	}: {
		/** Seite, um die es geht */
		von: string;
		version: string;
		inTeams: boolean;
		imFenster?: boolean;
		eingabe?: { kind?: string; text?: string } | null;
		fehlerVomServer?: { kind?: string; text?: string } | null;
		onfertig?: () => void;
		onabbrechen?: () => void;
		/** Während der Aufnahme das Fenster ausblenden */
		onaufnahme?: (laeuft: boolean) => void;
		hatEingabe?: boolean;
	} = $props();

	let art = $state(untrack(() => eingabe?.kind ?? 'fehler'));
	let text = $state(untrack(() => eingabe?.text ?? ''));
	let bild = $state<Blob | null>(null);
	let vorschau = $state<string | null>(null);
	let fehler = $state<{ kind?: string; text?: string; bild?: string }>(
		untrack(() => ({ ...(fehlerVomServer ?? {}) }))
	);
	let laeuft = $state(false);
	let gesendet = $state(false);
	let dateiFeld: HTMLInputElement | undefined = $state();

	$effect(() => {
		hatEingabe = !gesendet && (text.trim() !== '' || bild !== null);
	});

	const fenster = typeof window === 'undefined' ? '' : `${innerWidth} × ${innerHeight}`;
	const browserfehler = letzteBrowserfehler();
	const aufnehmenGeht = kannAufnehmen(untrack(() => inTeams));

	function setzeBild(b: Blob | null) {
		if (vorschau) URL.revokeObjectURL(vorschau);
		bild = b;
		vorschau = b ? URL.createObjectURL(b) : null;
	}
	onDestroy(() => vorschau && URL.revokeObjectURL(vorschau));

	async function nimmBild(hole: () => Promise<Blob>) {
		fehler = { ...fehler, bild: undefined };
		try {
			setzeBild(await hole());
		} catch (err) {
			// Abbrechen im Auswahlfenster des Browsers ist kein Fehler
			if (err instanceof DOMException) {
				if (err.name !== 'NotAllowedError' && err.name !== 'AbortError')
					fehler = {
						...fehler,
						bild: 'Die Aufnahme hat in diesem Browser nicht geklappt. Mach das Bildschirmfoto bitte selbst und füge es mit „Bild auswählen“ oder Strg + V ein.'
					};
			} else
				fehler = {
					...fehler,
					bild: err instanceof Error ? err.message : 'Das Bild konnte nicht übernommen werden.'
				};
		}
	}

	async function aufnehmen() {
		onaufnahme?.(true);
		await nimmBild(nimmAuf);
		onaufnahme?.(false);
	}

	/** Bild aus der Zwischenablage (z. B. nach Windows + Umschalt + S); Text normal einfügen */
	function einfuegen(e: ClipboardEvent) {
		if (art !== 'fehler' || gesendet) return;
		const eintrag = [...(e.clipboardData?.items ?? [])].find(
			(i) => i.kind === 'file' && i.type.startsWith('image/')
		);
		const datei = eintrag?.getAsFile();
		if (!datei) return;
		e.preventDefault();
		void nimmBild(() => bildAusDatei(datei));
	}
</script>

{#if gesendet}
	<div class="stapel">
		<p class="meldung" role="status">Danke! Deine Rückmeldung ist angekommen.</p>
		<p class="hinweis">
			{art === 'fehler'
				? 'Die IT sieht sie und kümmert sich darum. Hat sie eine Rückfrage, meldet sie sich über Nachrichten.'
				: 'Die Verwaltung deines Mandanten liest sie. Rückfragen kommen über Nachrichten.'}
			Den Stand siehst du unter „Meine Meldungen“.
		</p>
		<div class="zeile">
			<button class="knopf" type="button" onclick={() => onfertig?.()}>Schließen</button>
			<a class="knopf zweit" href={resolve('/(app)/rueckmeldung')} onclick={() => onfertig?.()}>
				Meine Meldungen
			</a>
		</div>
	</div>
{:else}
	<form
		method="POST"
		action="/rueckmeldung/neu"
		enctype="multipart/form-data"
		class="stapel"
		onpaste={einfuegen}
		use:enhance={({ formData }) => {
			laeuft = true;
			if (art === 'fehler') {
				formData.set(
					'technik',
					JSON.stringify({ version, fenster, teams: inTeams, fehler: browserfehler })
				);
				if (bild) formData.set('bildschirmfoto', bild, 'bildschirmfoto.jpg');
			}
			return async ({ result, update }) => {
				laeuft = false;
				if (result.type === 'failure') {
					fehler = (result.data?.fehler as typeof fehler) ?? {
						text: 'Das hat nicht geklappt.'
					};
					return;
				}
				if (result.type === 'success' && imFenster) {
					gesendet = true;
					setzeBild(null);
					return;
				}
				await update();
			};
		}}
	>
		<input type="hidden" name="seite" value={von} />
		{#if imFenster}<input type="hidden" name="fenster" value="1" />{/if}
		<fieldset>
			<legend>Worum geht es?</legend>
			<div class="optionen">
				{#each FEEDBACK_KINDS as k (k.key)}
					<label class="option">
						<input type="radio" name="art" value={k.key} bind:group={art} />
						<span><strong>{k.label}</strong> <span class="hinweis">· {k.hint}</span></span>
					</label>
				{/each}
			</div>
			{#if fehler.kind}<span class="feldfehler">{fehler.kind}</span>{/if}
		</fieldset>

		<label class="feld">
			<span>{art === 'fehler' ? 'Was ist passiert?' : 'Deine Idee'}</span>
			<textarea
				name="text"
				rows="5"
				maxlength={FEEDBACK_MAX}
				required
				bind:value={text}
				placeholder={art === 'fehler'
					? 'Was wolltest du tun, was ist stattdessen passiert? Bitte keine Passwörter.'
					: 'Was würde dir die Arbeit leichter machen?'}
				aria-invalid={fehler.text ? 'true' : undefined}
				aria-describedby={fehler.text ? 'rm-f-text' : 'rm-h-text'}></textarea>
			{#if fehler.text}<span id="rm-f-text" class="feldfehler">{fehler.text}</span>{:else}<span
					id="rm-h-text"
					class="hinweis"
				>
					{text.length} / {FEEDBACK_MAX}
				</span>{/if}
		</label>

		{#if art === 'fehler'}
			<fieldset class="bildfeld">
				<legend>Bildschirmfoto (freiwillig)</legend>
				{#if vorschau}
					<img src={vorschau} alt="Vorschau des Bildschirmfotos, das mitgeschickt wird" />
					<p class="hinweis warnung">
						<strong>Bitte ansehen, bevor du sendest:</strong> Die IT sieht alles, was auf dem Bild steht,
						auch Namen und Inhalte. Wenn etwas darauf nicht für sie gedacht ist, entferne das Bild.
					</p>
					<button class="knopf zweit klein" type="button" onclick={() => setzeBild(null)}>
						Bild entfernen
					</button>
				{:else}
					<p class="hinweis">
						Ein Bild zeigt oft schneller als Worte, was nicht stimmt. Du siehst es vor dem Senden
						und kannst es wieder entfernen.
					</p>
					<div class="zeile">
						{#if aufnehmenGeht}
							<button class="knopf zweit klein" type="button" onclick={() => void aufnehmen()}>
								Bildschirmfoto aufnehmen
							</button>
						{/if}
						<button class="knopf zweit klein" type="button" onclick={() => dateiFeld?.click()}>
							Bild auswählen
						</button>
					</div>
					<p class="hinweis">
						{#if aufnehmenGeht}Beim Aufnehmen fragt der Browser, welches Fenster er zeigen darf –
							wähle dieses.{/if}
						Ein kopiertes Bild kannst du auch mit Strg + V einfügen.
					</p>
					<input
						bind:this={dateiFeld}
						type="file"
						accept="image/*"
						hidden
						aria-label="Bild für die Fehlermeldung auswählen"
						onchange={(e) => {
							const d = e.currentTarget.files?.[0];
							e.currentTarget.value = '';
							if (d) void nimmBild(() => bildAusDatei(d));
						}}
					/>
				{/if}
				{#if fehler.bild}<p class="feldfehler" role="alert">{fehler.bild}</p>{/if}
			</fieldset>
		{/if}

		<details class="mitgeschickt">
			<summary>Das wird automatisch mitgeschickt</summary>
			<dl>
				<dt>Dein Name</dt>
				<dd>damit man nachfragen kann</dd>
				<dt>Seite</dt>
				<dd><code>{von}</code></dd>
				{#if art === 'fehler'}
					<dt>Version</dt>
					<dd>{version}</dd>
					<dt>Fenstergröße</dt>
					<dd>{fenster || '–'}</dd>
					<dt>Browser</dt>
					<dd>{typeof navigator === 'undefined' ? '–' : navigator.userAgent}</dd>
					<dt>Teams-App</dt>
					<dd>{inTeams ? 'ja' : 'nein'}</dd>
					<dt>Bildschirmfoto</dt>
					<dd>{bild ? 'ja, siehe Vorschau oben' : 'nein'}</dd>
					<dt>Letzte Fehlermeldungen des Browsers</dt>
					<dd>
						{#if browserfehler.length}<pre>{browserfehler.join('\n')}</pre>{:else}keine{/if}
					</dd>
				{/if}
				<dt>Wer liest das?</dt>
				<dd>
					{art === 'fehler'
						? 'die IT (System-Admins). Das Bildschirmfoto wird 30 Tage nach Abschluss gelöscht.'
						: 'die Verwaltung deines Mandanten'}
				</dd>
			</dl>
		</details>

		<div class="zeile">
			<button class="knopf" type="submit" disabled={laeuft || text.trim().length < 5}>
				{laeuft ? 'Wird gesendet …' : 'Rückmeldung senden'}
			</button>
			{#if onabbrechen}
				<button class="knopf zweit" type="button" onclick={() => onabbrechen?.()}>Abbrechen</button>
			{/if}
		</div>
	</form>
{/if}

<style>
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
		min-width: 0;
	}
	legend {
		font-weight: 600;
		margin-bottom: 4px;
	}
	.optionen {
		display: grid;
		gap: 2px;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
	}
	.option input {
		width: 20px;
		height: 20px;
		accent-color: var(--fill);
	}
	.feldfehler {
		color: var(--err-tx);
		font-size: 0.93rem;
		font-weight: 600;
	}
	.zeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.klein {
		min-height: 38px;
		padding: 6px 12px;
		font-size: 14px;
	}
	.bildfeld {
		display: grid;
		gap: 8px;
	}
	.bildfeld p {
		margin: 0;
	}
	.bildfeld > button {
		justify-self: start;
	}
	.bildfeld img {
		max-width: 100%;
		max-height: 260px;
		object-fit: contain;
		justify-self: start;
		border: 1px solid var(--bd);
		border-radius: 8px;
	}
	.warnung {
		color: var(--tx);
	}
	.mitgeschickt summary {
		cursor: pointer;
		min-height: 32px;
		display: flex;
		align-items: center;
	}
	dl {
		display: grid;
		grid-template-columns: minmax(8rem, auto) 1fr;
		gap: 4px 12px;
		margin: 8px 0 0;
		font-size: 14px;
	}
	dt {
		color: var(--mu);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	pre {
		margin: 0;
		white-space: pre-wrap;
		font-size: 12px;
	}
	code {
		overflow-wrap: anywhere;
	}
	@media (max-width: 599px) {
		dl {
			grid-template-columns: 1fr;
		}
		dt {
			margin-top: 6px;
		}
	}
</style>
