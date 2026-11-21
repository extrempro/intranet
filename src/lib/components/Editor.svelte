<script lang="ts">
	/**
	 * WYSIWYG-Editor (TipTap). Liefert HTML im versteckten Feld `name`;
	 * der Server bereinigt es immer (src/lib/server/html.ts).
	 */
	import { onDestroy, onMount } from 'svelte';
	import type { Editor } from '@tiptap/core';

	let {
		name,
		value = '',
		label,
		describedby
	}: { name: string; value?: string; label: string; describedby?: string } = $props();

	let element: HTMLDivElement | undefined = $state();
	let editor: Editor | undefined = $state();
	let html = $state('');
	let tick = $state(0);
	let linkOffen = $state(false);
	let linkAdresse = $state('');

	$effect.pre(() => {
		if (!editor) html = value;
	});

	onMount(async () => {
		const [{ Editor }, { default: StarterKit }] = await Promise.all([
			import('@tiptap/core'),
			import('@tiptap/starter-kit')
		]);
		editor = new Editor({
			element,
			extensions: [
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
</style>
