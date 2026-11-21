<script lang="ts">
	/**
	 * WYSIWYG-Editor (TipTap). Liefert HTML im versteckten Feld `name`;
	 * der Server bereinigt es immer (src/lib/server/html.ts).
	 */
	import { onDestroy, onMount, tick as warten } from 'svelte';
	import type { Editor } from '@tiptap/core';
	import {
		BILD_BREITE_SCHRITT,
		BILD_VORGABEN,
		bildBreite,
		breiteAusKlassen,
		type BildAusrichtung
	} from '#lib/bilder-im-text.ts';
	import Icon from './Icon.svelte';
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
		if (b.neu) {
			editor
				?.chain()
				.focus()
				.insertContent({
					type: 'image',
					attrs: { src: b.src, alt: b.alt.trim(), animiert: Boolean(b.animiert) }
				})
				.run();
			// Cursor hinter das Bild, damit Weiterschreiben das Bild nicht ersetzt
			if (editor) editor.commands.setTextSelection(editor.state.selection.to);
		} else editor?.chain().focus().updateAttributes('image', { alt: b.alt.trim() }).run();
		bildSchliessen();
	}

	function bildSchliessen() {
		if (bildEntwurf?.neu) URL.revokeObjectURL(bildEntwurf.vorschau);
		bildEntwurf = null;
		bildDialog?.close();
	}

	const bildAttr = (k: 'breite' | 'ausrichtung') => {
		void tick;
		return editor?.getAttributes('image')[k] ?? null;
	};
	const setzeBild = (attrs: { breite?: number; ausrichtung?: BildAusrichtung | null }) =>
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
		// Breite (bild-b<n>, Prozent der Textbreite) und Ausrichtung als Klassen, siehe bilder-im-text.ts
		const klassen = (attrs: Record<string, unknown>) => {
			const breite = attrs.breite as number;
			const a = breite < 100 ? (attrs.ausrichtung as BildAusrichtung | null) : null;
			return [`bild-b${breite}`, a && `bild-${a}`, attrs.animiert && 'bild-animiert']
				.filter(Boolean)
				.join(' ');
		};
		const TextBild = Image.extend({
			draggable: true,
			addAttributes() {
				return {
					src: { default: null },
					alt: { default: '' },
					breite: {
						default: 100,
						parseHTML: (el: HTMLElement) => breiteAusKlassen(el.classList),
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
				return ['img', mergeAttributes(HTMLAttributes, { class: klassen(node.attrs) })];
			},
			// Im Editor: Rahmen mit Anfasser zum Größer-/Kleinerziehen; verschieben per Ziehen
			addNodeView() {
				return ({ node: start, getPos, editor: ed }) => {
					let node = start;
					let ausgewaehlt = false;
					const rahmen = document.createElement('div');
					const img = document.createElement('img');
					const griff = document.createElement('span');
					const anzeige = document.createElement('span');
					griff.className = 'ziehpunkt';
					griff.setAttribute('aria-hidden', 'true');
					anzeige.className = 'breitenanzeige';
					anzeige.setAttribute('aria-hidden', 'true');
					rahmen.append(img, griff, anzeige);
					const zeigen = () => {
						rahmen.className = `textbild ${klassen(node.attrs)}${ausgewaehlt ? ' ProseMirror-selectednode' : ''}`;
						img.src = node.attrs.src;
						img.alt = node.attrs.alt ?? '';
						griff.dataset.seite = node.attrs.ausrichtung === 'rechts' ? 'links' : 'rechts';
					};
					zeigen();
					griff.addEventListener('pointerdown', (e) => {
						e.preventDefault();
						e.stopPropagation();
						const flaeche = rahmen.parentElement?.getBoundingClientRect().width ?? 1;
						const startX = e.clientX;
						const startB = rahmen.getBoundingClientRect().width;
						const richtung =
							node.attrs.ausrichtung === 'rechts' && node.attrs.breite < 100
								? -1
								: node.attrs.ausrichtung && node.attrs.breite < 100
									? 1
									: 2;
						let neu = node.attrs.breite as number;
						griff.setPointerCapture(e.pointerId);
						rahmen.classList.add('zieht');
						const bewegen = (ev: PointerEvent) => {
							neu = bildBreite(((startB + (ev.clientX - startX) * richtung) / flaeche) * 100);
							rahmen.style.width = `${neu}%`;
							anzeige.textContent = `${neu} %`;
						};
						const ende = () => {
							griff.removeEventListener('pointermove', bewegen);
							rahmen.classList.remove('zieht');
							rahmen.style.width = '';
							const pos = typeof getPos === 'function' ? getPos() : undefined;
							if (typeof pos === 'number' && neu !== node.attrs.breite)
								ed.view.dispatch(
									ed.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, breite: neu })
								);
						};
						griff.addEventListener('pointermove', bewegen);
						griff.addEventListener('pointerup', ende, { once: true });
						griff.addEventListener('pointercancel', ende, { once: true });
					});
					return {
						dom: rahmen,
						update: (n) => {
							if (n.type !== node.type) return false;
							node = n;
							zeigen();
							return true;
						},
						selectNode: () => {
							ausgewaehlt = true;
							zeigen();
						},
						deselectNode: () => {
							ausgewaehlt = false;
							zeigen();
						},
						stopEvent: (e) => e.target === griff
					};
				};
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
				// Auch Änderungen ohne Tippen (Bild, Tabelle) zählen als Eingabe:
				// Entwurf speichern, Schutz vor Verlassen
				element?.dispatchEvent(new Event('input', { bubbles: true }));
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

	// Linien-Symbole (Tabler, 24×24) wie im Hauptmenü
	const SYM = {
		link: 'M9 15l6 -6M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463',
		bild: 'M15 8h.01M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3zM3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3',
		tabelle:
			'M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2zM3 10h18M10 3v18',
		info: 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0M12 9h.01M11 12h1v4h1',
		zurueck: 'M9 14l-4 -4l4 -4M5 10h11a4 4 0 1 1 0 8h-1',
		vor: 'M15 14l4 -4l-4 -4M19 10h-11a4 4 0 1 0 0 8h1'
	};

	// Sichtbarer Text steht vorn im Namen (WCAG 2.5.3, Sprachsteuerung „H2 klicken“)
	const knoepfe: { l: string; t?: string; i?: string; on: boolean; run: () => void }[] = $derived([
		{
			l: 'Fett',
			i: 'M7 5h6a3.5 3.5 0 0 1 0 7h-6zM13 12h1a3.5 3.5 0 0 1 0 7h-7v-7',
			on: aktiv('bold'),
			run: () => editor?.chain().focus().toggleBold().run()
		},
		{
			l: 'Kursiv',
			i: 'M11 5h6M7 19h6M14 5l-4 14',
			on: aktiv('italic'),
			run: () => editor?.chain().focus().toggleItalic().run()
		},
		{
			l: 'Unterstrichen',
			i: 'M7 5v5a5 5 0 0 0 10 0v-5M5 19h14',
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
			i: 'M9 6h11M9 12h11M9 18h11M5 6v.01M5 12v.01M5 18v.01',
			on: aktiv('bulletList'),
			run: () => editor?.chain().focus().toggleBulletList().run()
		},
		{
			l: '1. Nummerierte Liste',
			i: 'M11 6h9M11 12h9M12 18h8M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4M6 10v-6l-2 2',
			on: aktiv('orderedList'),
			run: () => editor?.chain().focus().toggleOrderedList().run()
		},
		{
			l: 'Zitat',
			i: 'M6 15h15M21 19h-15M15 11h6M21 7h-6M9 9h1a1 1 0 1 1 -1 1v-2.5a2 2 0 0 1 2 -2M3 9h1a1 1 0 1 1 -1 1v-2.5a2 2 0 0 1 2 -2',
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
				{#if k.i}<Icon d={k.i} size={20} stroke={2} />{:else}{k.t}{/if}
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
			<Icon d={SYM.link} size={20} stroke={2} />
		</button>
		{#if bilder}
			<button
				type="button"
				aria-label="Bild einfügen"
				title="Bild einfügen (auch per Strg + V oder Ziehen)"
				disabled={!editor}
				onclick={() => dateiFeld?.click()}
			>
				<Icon d={SYM.bild} size={20} stroke={2} />
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
			<Icon d={SYM.tabelle} size={20} stroke={2} />
		</button>
		<button
			type="button"
			aria-label="Infokasten"
			title="Infokasten"
			aria-pressed={aktiv('infokasten')}
			disabled={!editor}
			onclick={kastenUmschalten}
		>
			<Icon d={SYM.info} size={20} stroke={2} />
		</button>
		<button
			type="button"
			aria-label="Rückgängig"
			title="Rückgängig"
			disabled={!editor}
			onclick={() => editor?.chain().focus().undo().run()}
		>
			<Icon d={SYM.zurueck} size={20} stroke={2} />
		</button>
		<button
			type="button"
			aria-label="Wiederholen"
			title="Wiederholen"
			disabled={!editor}
			onclick={() => editor?.chain().focus().redo().run()}
		>
			<Icon d={SYM.vor} size={20} stroke={2} />
		</button>
	</div>
	{#if bilder && aktiv('image')}
		<!-- Ausgewähltes Bild: Größe, Ausrichtung, Beschreibung -->
		<div class="zusatzleiste" role="toolbar" aria-label="Bild" tabindex="-1">
			<span class="gruppe" role="group" aria-label="Breite">
				{#each BILD_VORGABEN as v (v.breite)}
					<button
						type="button"
						aria-pressed={bildAttr('breite') === v.breite}
						onclick={() => setzeBild({ breite: v.breite })}
					>
						{v.name}
					</button>
				{/each}
				<button
					type="button"
					aria-label="Schmaler"
					title="Schmaler (oder an der Ecke ziehen)"
					disabled={bildAttr('breite') <= 10}
					onclick={() =>
						setzeBild({ breite: bildBreite(bildAttr('breite') - BILD_BREITE_SCHRITT) })}
				>
					−
				</button>
				<span class="wert" aria-live="polite">{bildAttr('breite')} %</span>
				<button
					type="button"
					aria-label="Breiter"
					title="Breiter (oder an der Ecke ziehen)"
					disabled={bildAttr('breite') >= 100}
					onclick={() =>
						setzeBild({ breite: bildBreite(bildAttr('breite') + BILD_BREITE_SCHRITT) })}
				>
					+
				</button>
			</span>
			<span class="gruppe" role="group" aria-label="Ausrichtung">
				{#each [[null, 'Mitte'], ['links', 'Links'], ['rechts', 'Rechts']] as [a, t] (t)}
					<button
						type="button"
						disabled={bildAttr('breite') >= 100}
						title={bildAttr('breite') >= 100
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
	.flaeche :global(.inhalt .textbild) {
		position: relative;
		cursor: grab;
	}
	.flaeche :global(.inhalt .textbild:not(.bild-links, .bild-rechts)) {
		margin: 12px auto;
	}
	.flaeche :global(.inhalt .textbild img) {
		display: block;
		pointer-events: none;
	}
	.flaeche :global(.inhalt .textbild.ProseMirror-selectednode) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
		border-radius: 10px;
	}
	/* Anfasser zum Größer-/Kleinerziehen, nur am ausgewählten Bild */
	.flaeche :global(.inhalt .ziehpunkt) {
		display: none;
		position: absolute;
		bottom: -10px;
		width: 22px;
		height: 22px;
		border: 3px solid var(--sf);
		border-radius: 50%;
		background: var(--fill);
		cursor: ew-resize;
		touch-action: none;
	}
	.flaeche :global(.inhalt .ziehpunkt[data-seite='rechts']) {
		right: -10px;
	}
	.flaeche :global(.inhalt .ziehpunkt[data-seite='links']) {
		left: -10px;
	}
	.flaeche :global(.inhalt .ProseMirror-selectednode .ziehpunkt),
	.flaeche :global(.inhalt .zieht .ziehpunkt) {
		display: block;
	}
	.flaeche :global(.inhalt .breitenanzeige) {
		display: none;
		position: absolute;
		top: 8px;
		left: 8px;
		padding: 2px 8px;
		border-radius: 999px;
		background: rgb(0 0 0 / 0.7);
		color: #fff;
		font-size: 13px;
		font-weight: 600;
	}
	.flaeche :global(.inhalt .zieht .breitenanzeige) {
		display: block;
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
	.zusatzleiste .wert {
		min-width: 3.5em;
		text-align: center;
		font-size: 14px;
		font-variant-numeric: tabular-nums;
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
