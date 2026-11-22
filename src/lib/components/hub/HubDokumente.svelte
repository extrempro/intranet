<script lang="ts">
	/** Dokumente eines Hubs, nach Ordnern gruppiert. */
	import { resolve } from '$app/paths';
	import { formatSize } from '#lib/format.ts';

	interface Dok {
		id: string;
		fileId: string;
		title: string;
		description: string | null;
		size: number;
		kind: string;
		updatedAt: Date;
		folderId: string | null;
	}
	let {
		dokumente,
		ordner = [],
		max
	}: { dokumente: Dok[]; ordner?: { id: string; name: string }[]; max?: number } = $props();

	const kurzDatum = new Intl.DateTimeFormat('de-DE', {
		day: '2-digit',
		month: '2-digit',
		timeZone: 'Europe/Berlin'
	});
	const TYP: Record<string, string> = {
		pdf: 'PDF',
		jpeg: 'JPG',
		png: 'PNG',
		webp: 'WebP',
		docx: 'Word',
		xlsx: 'Excel',
		pptx: 'PowerPoint'
	};
	const typ = (k: string) => TYP[k] ?? k.toUpperCase();
	const gruppen = $derived(
		max
			? [{ id: null as string | null, name: '', liste: dokumente.slice(0, max) }]
			: [
					...ordner.map((o) => ({ id: o.id as string | null, name: o.name })),
					{ id: null, name: ordner.length ? 'Weitere' : '' }
				]
					.map((g) => ({ ...g, liste: dokumente.filter((d) => d.folderId === g.id) }))
					.filter((g) => g.liste.length)
	);
</script>

{#snippet liste(l: Dok[])}
	<ul class="zeilen">
		{#each l as d (d.id)}
			<li>
				<span class="typ" aria-hidden="true">{typ(d.kind)}</span>
				<span class="spalte">
					<a href={resolve('/(app)/dateien/[id]', { id: d.fileId })} target="_blank" rel="noopener">
						{d.title}
					</a>
					{#if d.description}<span class="unter">{d.description}</span>{/if}
					<span class="unter">
						{typ(d.kind)}&nbsp;· {formatSize(d.size)}&nbsp;· aktualisiert am {kurzDatum.format(
							new Date(d.updatedAt)
						)}
					</span>
				</span>
				<a
					class="knopf zweit klein"
					href="{resolve('/(app)/dateien/[id]', { id: d.fileId })}?download"
					aria-label="{d.title} herunterladen"
				>
					Herunterladen
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

{#each gruppen as g (g.id ?? 'ohne')}
	{#if g.name}
		<details class="ordner" open={gruppen.length <= 3}>
			<summary><h3>{g.name} <span class="anzahl">({g.liste.length})</span></h3></summary>
			{@render liste(g.liste)}
		</details>
	{:else}
		{@render liste(g.liste)}
	{/if}
{/each}

<style>
	.zeilen {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	li:first-child {
		border-top: 0;
	}
	.typ {
		flex: none;
		min-width: 44px;
		padding: 6px 4px;
		border-radius: 10px;
		background: var(--tint);
		color: var(--ac);
		font-size: 11px;
		font-weight: 700;
		text-align: center;
	}
	.spalte {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
		overflow-wrap: anywhere;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
	}
	.klein {
		min-height: 40px;
		padding: 6px 14px;
		font-size: 14px;
	}
	.ordner {
		border-top: 1px solid var(--bd);
		padding-top: 8px;
		margin-top: 4px;
	}
	.ordner summary {
		cursor: pointer;
		min-height: 40px;
		display: flex;
		align-items: center;
	}
	h3 {
		display: inline;
		margin: 0;
		font-size: 1rem;
	}
	.anzahl {
		font-weight: 400;
		color: var(--mu);
	}
</style>
