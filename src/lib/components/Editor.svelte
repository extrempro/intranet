<script lang="ts">
	/**
	 * WYSIWYG-Editor (TipTap). Liefert HTML im versteckten Feld `name`;
	 * der Server bereinigt es immer (src/lib/server/html.ts).
	 */
	import { onDestroy, onMount, tick as warten } from 'svelte';
	import type { Editor } from '@tiptap/core';
	import { BILD_GROESSEN, type BildAusrichtung, type BildGroesse } from '#lib/bilder-im-text.ts';
	import { bildHochladen, bildVorbereiten, istTextbild } from '#lib/textbild.ts';
	import { KASTEN_ARTEN, KASTEN_NAMEN, type KastenArt } from '#lib/textbausteine.ts';

	let {
		name,
		value = '',
		label,
		describedby,
		bilder = true
	}: {
		name: string;
		value?: string;
		label: string;
		describedby?: string;
		/** Bilder im Text erlauben (Beiträge, FAQs) */
		bilder?: boolean;
	} = $props();

	let element: HTMLDivElement | undefined = $state();
	let editor: Editor | undefined = $state();
	let html = $state('');
	let tick = $state(0);
	let linkOffen = $state(false);
	let linkAdresse = $state('');

	$effect.pre(() => {
		if (!editor) html = value;
	});

	// Bilder im Text: hochladen, Beschreibung abfragen, Größe und Ausrichtung
	let bildStatus = $state('');
	let bildDialog: HTMLDialogElement | undefined = $state();
	let bildFeld: HTMLTextAreaElement | undefined = $state();
	let dateiFeld: HTMLInputElement | undefined = $state();
	let bildEntwurf = $state<{
		src: string;
		vorschau: string;
		alt: string;
		neu: boolean;
		animiert?: boolean;
	} | null>(null);

	async function bildEinfuegen(datei: File) {
		if (!bilder || !editor) return;
		bildStatus = 'Bild wird vorbereitet und hochgeladen …';
		try {
			const { blob, animiert } = await bildVorbereiten(datei);
			const src = await bildHochladen(blob);
			bildStatus = '';
			bildEntwurf = { src, vorschau: URL.createObjectURL(blob), alt: '', neu: true, animiert };
			await warten();
			bildDialog?.showModal();
			bildFeld?.focus();
		} catch (err) {
			bildStatus = err instanceof Error ? err.message : 'Das Bild konnte nicht eingefügt werden.';
		}
	}

	async function beschreibungAendern() {
		const a = editor?.getAttributes('image');
		if (!a?.src) return;
		bildEntwurf = { src: a.src, vorschau: a.src, alt: a.alt ?? '', neu: false };
		await warten();
		bildDialog?.showModal();
		bildFeld?.focus();
	}

	function bildUebernehmen() {
		const b = bildEntwurf;
		if (!b || !b.alt.trim()) return;
		if (b.neu)
			editor
				?.chain()
				.focus()
				.insertContent({
					type: 'image',
					attrs: { src: b.src, alt: b.alt.trim(), animiert: Boolean(b.animiert) }
				})
				.run();
		else editor?.chain().focus().updateAttributes('image', { alt: b.alt.trim() }).run();
		bildSchliessen();
	}

	function bildSchliessen() {
		if (bildEntwurf?.neu) URL.revokeObjectURL(bildEntwurf.vorschau);
		bildEntwurf = null;
		bildDialog?.close();
	}

	const bildAttr = (k: 'groesse' | 'ausrichtung') => {
		void tick;
		return editor?.getAttributes('image')[k] ?? null;
	};
	const setzeBild = (attrs: { groesse?: BildGroesse; ausrichtung?: BildAusrichtung | null }) =>
		editor?.chain().focus().updateAttributes('image', attrs).run();

	onMount(async () => {
		const [
			{ Editor, Node, mergeAttributes },
			{ default: StarterKit },
			{ default: Image },
			{ TableKit }
		] = await Promise.all([
			import('@tiptap/core'),
			import('@tiptap/starter-kit'),
			import('@tiptap/extension-image'),
			import('@tiptap/extension-table')
		]);
		// Infokasten: <div class="kasten kasten-info|hinweis|warnung">
		const Infokasten = Node.create({
			name: 'infokasten',
			group: 'block',
			content: '(paragraph|bulletList|orderedList)+',
			defining: true,
			addAttributes() {
				return {
					art: {
						default: 'info',
						parseHTML: (el: HTMLElement) =>
							KASTEN_ARTEN.find((a) => el.classList.contains(`kasten-${a}`)) ?? 'info',
						renderHTML: (attrs: { art: KastenArt }) => ({ class: `kasten kasten-${attrs.art}` })
					}
				};
			},
			parseHTML() {
				return [{ tag: 'div.kasten' }];
			},
			renderHTML({ HTMLAttributes }) {
				return ['div', HTMLAttributes, 0];
			}
		});
		// Größe und Ausrichtung als Klassen (bild-klein, bild-links …), siehe bilder-im-text.ts
		const TextBild = Image.extend({
			addAttributes() {
				return {
					src: { default: null },
					alt: { default: '' },
					groesse: {
						default: 'voll',
						parseHTML: (el: HTMLElement) =>
							BILD_GROESSEN.find((g) => el.classList.contains(`bild-${g}`)) ?? 'voll',
						renderHTML: () => ({})
					},
					animiert: {
						default: false,
						parseHTML: (el: HTMLElement) => el.classList.contains('bild-animiert'),
						renderHTML: () => ({})
					},
					ausrichtung: {
						default: null,
						parseHTML: (el: HTMLElement) =>
							(['links', 'rechts'] as const).find((a) => el.classList.contains(`bild-${a}`)) ??
							null,
						renderHTML: () => ({})
					}
				};
			},
			renderHTML({ node, HTMLAttributes }) {
				const g = node.attrs.groesse as BildGroesse;
				const a = g !== 'voll' ? (node.attrs.ausrichtung as BildAusrichtung | null) : null;
				return [
					'img',
					mergeAttributes(HTMLAttributes, {
						class: [`bild-${g}`, a && `bild-${a}`, node.attrs.animiert && 'bild-animiert']
							.filter(Boolean)
							.join(' ')
					})
				];
			}
		}).configure({ inline: false, allowBase64: false });
		editor = new Editor({
			element,
			extensions: [
				...(bilder ? [TextBild] : []),
				Infokasten,
				// Einfache Tabellen: keine verbundenen Zellen, keine Spaltenbreiten
				TableKit.configure({ table: { resizable: false } }),
				StarterKit.configure({
					heading: { levels: [2, 3] },
					code: false,
					codeBlock: false,
					link: {
						openOnClick: false,
						autolink: true,
						protocols: ['mailto', 'tel'],
						defaultProtocol: 'https'
					}
				})
			],
			content: value,
			editorProps: {
				// Bilder einfügen per Strg + V oder Ziehen
				handlePaste: (_view, event) => {
					const datei = [...(event.clipboardData?.files ?? [])].find(istTextbild);
					if (!bilder || !datei) return false;
					void bildEinfuegen(datei);
					return true;
				},
				handleDrop: (_view, event, _slice, verschoben) => {
					if (verschoben) return false;
					const datei = [...(event.dataTransfer?.files ?? [])].find(istTextbild);
					if (!bilder || !datei) return false;
					event.preventDefault();
					void bildEinfuegen(datei);
					return true;
				},
				attributes: {
					role: 'textbox',
					'aria-multiline': 'true',
					'aria-label': label,
					...(describedby ? { 'aria-describedby': describedby } : {}),
					class: 'inhalt'
				}
			},
			onUpdate: ({ editor: e }) => {
				html = e.isEmpty ? '' : e.getHTML();
			},
			onTransaction: () => {
				tick++;
			}
		});
	});

	onDestroy(() => editor?.destroy());

	const aktiv = (typ: string, attrs?: Record<string, unknown>) => {
		void tick;
		return editor?.isActive(typ, attrs) ?? false;
	};

	const kastenArt = () => {
		void tick;
		return (editor?.getAttributes('infokasten').art as KastenArt | undefined) ?? null;
	};
	const kopfzeile = () => {
		void tick;
		const tabelle = editor?.state.selection.$from;
		if (!tabelle) return false;
		for (let d = tabelle.depth; d > 0; d--) {
			const n = tabelle.node(d);
			if (n.type.name === 'table') return n.firstChild?.firstChild?.type.name === 'tableHeader';
		}
		return false;
	};
	function kastenUmschalten() {
		if (aktiv('infokasten')) editor?.chain().focus().lift('infokasten').run();
		else editor?.chain().focus().wrapIn('infokasten', { art: 'info' }).run();
	}

	function linkSetzen() {
		const adresse = linkAdresse.trim();
		const kette = editor?.chain().focus().extendMarkRange('link');
		if (!adresse) kette?.unsetLink().run();
		else
			kette
				?.setLink({
					href: /^(https?:|mailto:|tel:)/i.test(adresse) ? adresse : `https://${adresse}`
				})
				.run();
		linkOffen = false;
		linkAdresse = '';
	}

	// Sichtbarer Text steht vorn im Namen (WCAG 2.5.3, Sprachsteuerung „H2 klicken“)
	const knoepfe = $derived([
		{ l: 'Fett', t: 'B', on: aktiv('bold'), run: () => editor?.chain().focus().toggleBold().run() },
		{
			l: 'Kursiv',
			t: 'I',
			on: aktiv('italic'),
			run: () => editor?.chain().focus().toggleItalic().run()
		},
		{
			l: 'Unterstrichen',
			t: 'U',
			on: aktiv('underline'),
			run: () => editor?.chain().focus().toggleUnderline().run()
		},
		{
			l: 'H2 Überschrift',
			t: 'H2',
			on: aktiv('heading', { level: 2 }),
			run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run()
		},
		{
			l: 'H3 Zwischenüberschrift',
			t: 'H3',
			on: aktiv('heading', { level: 3 }),
			run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run()
		},
		{
			l: 'Aufzählung',
			t: '•',
			on: aktiv('bulletList'),
			run: () => editor?.chain().focus().toggleBulletList().run()
		},
		{
			l: '1. Nummerierte Liste',
			t: '1.',
			on: aktiv('orderedList'),
			run: () => editor?.chain().focus().toggleOrderedList().run()
		},
		{
			l: 'Zitat',
			t: '❝',
			on: aktiv('blockquote'),
			run: () => editor?.chain().focus().toggleBlockquote().run()
		}
	]);
</script>

<div class="editor">
	<!-- Mausklick nimmt dem Text keinen Fokus; Tastatur funktioniert normal -->
	<div
		class="leiste"
		role="toolbar"
		aria-label="Formatierung"
		tabindex="-1"
		onmousedown={(e) => e.preventDefault()}
	>
		{#each knoepfe as k (k.l)}
			<button
				type="button"
				aria-label={k.l}
				title={k.l}
				aria-pressed={k.on}
				onclick={k.run}
				disabled={!editor}
			>
				{k.t}
			</button>
		{/each}
		<button
			type="button"
			aria-label="Link"
			title="Link"
			aria-pressed={aktiv('link')}
			aria-expanded={linkOffen}
			disabled={!editor}
			onclick={() => {
				linkAdresse = editor?.getAttributes('link').href ?? '';
				linkOffen = !linkOffen;
			}}
		>
			🔗
		</button>
		{#if bilder}
			<button
				type="button"
				aria-label="Bild einfügen"
				title="Bild einfügen (auch per Strg + V oder Ziehen)"
				disabled={!editor}
				onclick={() => dateiFeld?.click()}
			>
				🖼
			</button>
		{/if}
		<button
			type="button"
			aria-label="Tabelle einfügen"
			title="Tabelle einfügen"
			aria-pressed={aktiv('table')}
			disabled={!editor || aktiv('table')}
			onclick={() =>
				editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
		>
			▦
		</button>
		<button
			type="button"
			aria-label="Infokasten"
			title="Infokasten"
			aria-pressed={aktiv('infokasten')}
			disabled={!editor}
			onclick={kastenUmschalten}
		>
			ⓘ
		</button>
		<button
			type="button"
			aria-label="Rückgängig"
			title="Rückgängig"
			disabled={!editor}
			onclick={() => editor?.chain().focus().undo().run()}
		>
			↶
		</button>
		<button
			type="button"
			aria-label="Wiederholen"
			title="Wiederholen"
			disabled={!editor}
			onclick={() => editor?.chain().focus().redo().run()}
		>
			↷
		</button>
	</div>
	{#if bilder && aktiv('image')}
		<!-- Ausgewähltes Bild: Größe, Ausrichtung, Beschreibung -->
		<div class="zusatzleiste" role="toolbar" aria-label="Bild" tabindex="-1">
			<span class="gruppe" role="group" aria-label="Größe">
				{#each [['klein', 'Klein'], ['mittel', 'Mittel'], ['voll', 'Volle Breite']] as [g, t] (g)}
					<button
						type="button"
						aria-pressed={bildAttr('groesse') === g}
						onclick={() => setzeBild({ groesse: g as BildGroesse })}
					>
						{t}
					</button>
				{/each}
			</span>
			<span class="gruppe" role="group" aria-label="Ausrichtung">
				{#each [[null, 'Mitte'], ['links', 'Links'], ['rechts', 'Rechts']] as [a, t] (t)}
					<button
						type="button"
						disabled={bildAttr('groesse') === 'voll'}
						title={bildAttr('groesse') === 'voll'
							? 'Bei voller Breite steht das Bild für sich'
							: 'Text fließt um das Bild'}
						aria-pressed={(bildAttr('ausrichtung') ?? null) === a}
						onclick={() => setzeBild({ ausrichtung: a as BildAusrichtung | null })}
					>
						{t}
					</button>
				{/each}
			</span>
			<button type="button" onclick={beschreibungAendern}>Beschreibung</button>
			<button type="button" onclick={() => editor?.chain().focus().deleteSelection().run()}>
				Bild entfernen
			</button>
		</div>
	{/if}
	{#if aktiv('table')}
		<!-- Tabelle: Zeilen und Spalten -->
		<div class="zusatzleiste" role="toolbar" aria-label="Tabelle" tabindex="-1">
			<span class="gruppe" role="group" aria-label="Zeilen">
				<button type="button" onclick={() => editor?.chain().focus().addRowBefore().run()}>
					+ Zeile oben
				</button>
				<button type="button" onclick={() => editor?.chain().focus().addRowAfter().run()}>
					+ Zeile unten
				</button>
				<button type="button" onclick={() => editor?.chain().focus().deleteRow().run()}>
					− Zeile
				</button>
			</span>
			<span class="gruppe" role="group" aria-label="Spalten">
				<button type="button" onclick={() => editor?.chain().focus().addColumnBefore().run()}>
					+ Spalte links
				</button>
				<button type="button" onclick={() => editor?.chain().focus().addColumnAfter().run()}>
					+ Spalte rechts
				</button>
				<button type="button" onclick={() => editor?.chain().focus().deleteColumn().run()}>
					− Spalte
				</button>
			</span>
			<button
				type="button"
				aria-pressed={kopfzeile()}
				title="Erste Zeile als Überschrift der Spalten"
				onclick={() => editor?.chain().focus().toggleHeaderRow().run()}
			>
				Kopfzeile
			</button>
			<button type="button" onclick={() => editor?.chain().focus().deleteTable().run()}>
				Tabelle entfernen
			</button>
		</div>
	{/if}
	{#if aktiv('infokasten')}
		<!-- Infokasten: Art wählen oder auflösen -->
		<div class="zusatzleiste" role="toolbar" aria-label="Infokasten" tabindex="-1">
			<span class="gruppe" role="group" aria-label="Art">
				{#each KASTEN_ARTEN as a (a)}
					<button
						type="button"
						aria-pressed={kastenArt() === a}
						onclick={() => editor?.chain().focus().updateAttributes('infokasten', { art: a }).run()}
					>
						{KASTEN_NAMEN[a]}
					</button>
				{/each}
			</span>
			<button type="button" onclick={() => editor?.chain().focus().lift('infokasten').run()}>
				Kasten entfernen
			</button>
		</div>
	{/if}
	{#if bildStatus}<p class="bildstatus" role="status">{bildStatus}</p>{/if}
	{#if linkOffen}
		<div class="link">
			<label class="feld">
				<span>Adresse des Links (leer lassen zum Entfernen)</span>
				<input
					type="text"
					inputmode="url"
					bind:value={linkAdresse}
					placeholder="https://…"
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							linkSetzen();
						}
					}}
				/>
			</label>
			<button type="button" class="knopf zweit" onclick={linkSetzen}>Übernehmen</button>
		</div>
	{/if}
	<div bind:this={element} class="flaeche">
		{#if !editor}
			<!-- Ohne JavaScript: schlichtes Textfeld -->
			<textarea {name} aria-label={label} rows="10">{value}</textarea>
		{/if}
	</div>
	{#if editor}<input type="hidden" {name} value={html} />{/if}
	{#if bilder}
		<input
			bind:this={dateiFeld}
			type="file"
			accept="image/jpeg,image/png,image/webp"
			hidden
			onchange={(e) => {
				const d = e.currentTarget.files?.[0];
				e.currentTarget.value = '';
				if (d) void bildEinfuegen(d);
			}}
		/>
		<dialog
			bind:this={bildDialog}
			class="bilddialog"
			aria-labelledby="{name}-bild-titel"
			oncancel={(e) => {
				e.preventDefault();
				bildSchliessen();
			}}
		>
			{#if bildEntwurf}
				<form
					class="innen"
					onsubmit={(e) => {
						e.preventDefault();
						bildUebernehmen();
					}}
				>
					<h2 id="{name}-bild-titel">{bildEntwurf.neu ? 'Bild einfügen' : 'Bildbeschreibung'}</h2>
					<img src={bildEntwurf.vorschau} alt="" class="vorschau" />
					<label class="feld">
						<span>Bildbeschreibung</span>
						<textarea
							bind:this={bildFeld}
							bind:value={bildEntwurf.alt}
							rows="2"
							maxlength="250"
							required
							placeholder="z. B. Der Chor bei der Probe auf der Probebühne"></textarea>
						<span class="hinweis">
							Was ist zu sehen? Bildschirmleser lesen das vor. Pflicht für jedes Bild.
						</span>
					</label>
					<div class="knoepfe">
						<button class="knopf zweit" type="button" onclick={bildSchliessen}>Abbrechen</button>
						<button class="knopf" type="submit" disabled={!bildEntwurf.alt.trim()}>
							{bildEntwurf.neu ? 'Einfügen' : 'Übernehmen'}
						</button>
					</div>
				</form>
			{/if}
		</dialog>
	{/if}
</div>

<style>
	.editor {
		border: 1px solid var(--inp-bd);
		border-radius: 10px;
		background: var(--sf);
		overflow: hidden;
	}
	.leiste {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		padding: 4px;
		border-bottom: 1px solid var(--bd);
		background: var(--bg);
	}
	.leiste button {
		min-width: 40px;
		min-height: 40px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--tx);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}
	.leiste button[aria-pressed='true'] {
		background: var(--tint);
		color: var(--ac);
	}
	.link {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: flex-end;
		padding: 8px;
		border-bottom: 1px solid var(--bd);
	}
	.link .feld {
		flex: 1 1 240px;
	}
	.flaeche :global(.inhalt) {
		min-height: 220px;
		padding: 12px 14px;
		outline: none;
	}
	.flaeche:focus-within {
		box-shadow: inset 0 0 0 3px var(--focus);
	}
	.flaeche textarea {
		border: 0;
		border-radius: 0;
	}
	.flaeche :global(.inhalt p) {
		margin: 0 0 0.6em;
	}
	.flaeche :global(.inhalt img.ProseMirror-selectednode) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.zusatzleiste {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 12px;
		padding: 6px 8px;
		border-bottom: 1px solid var(--bd);
		background: var(--tint);
	}
	.zusatzleiste .gruppe {
		display: inline-flex;
		gap: 2px;
	}
	.zusatzleiste button {
		min-height: 36px;
		padding: 4px 10px;
		border: 1px solid var(--bd);
		border-radius: 8px;
		background: var(--sf);
		color: var(--tx);
		font: inherit;
		font-size: 14px;
		cursor: pointer;
	}
	.zusatzleiste button[aria-pressed='true'] {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
	}
	.zusatzleiste button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.bildstatus {
		margin: 0;
		padding: 6px 12px;
		font-size: 14px;
		border-bottom: 1px solid var(--bd);
	}
	/* Fenster wie die Rückfragen: PC/Tablet in der Mitte, Handy von unten */
	.bilddialog {
		width: min(32rem, calc(100vw - 32px));
		padding: 0;
		border: 1px solid var(--bd);
		border-radius: 14px;
		background: var(--sf);
		color: var(--tx);
		box-shadow: var(--shadow);
	}
	.bilddialog::backdrop {
		background: rgb(0 0 0 / 0.4);
	}
	.bilddialog .innen {
		padding: 22px;
		display: grid;
		gap: 12px;
	}
	.bilddialog h2 {
		margin: 0;
		font-size: 1.2rem;
	}
	.bilddialog .vorschau {
		max-width: 100%;
		max-height: 240px;
		justify-self: start;
		border-radius: 8px;
		border: 1px solid var(--bd);
	}
	.bilddialog .knoepfe {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: 8px;
	}
	@media (max-width: 599px) {
		.bilddialog {
			width: 100%;
			max-width: 100%;
			margin: auto 0 0;
			border-radius: 16px 16px 0 0;
		}
		.bilddialog .knoepfe {
			flex-direction: column-reverse;
		}
		.bilddialog .knoepfe .knopf {
			width: 100%;
		}
	}
</style>
