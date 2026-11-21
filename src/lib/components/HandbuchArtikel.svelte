<script lang="ts">
	/** Ein Handbuch-Thema: Kapitel, Rollen, Text (aus dem Repo, bereinigt), Blättern. */
	import { resolve } from '$app/paths';

	let {
		titel,
		kapitel,
		rollen,
		html,
		vorher = null,
		nachher = null,
		zurueck = false
	}: {
		titel: string;
		kapitel: string;
		rollen: string[] | null;
		html: string;
		vorher?: { slug: string; title: string } | null;
		nachher?: { slug: string; title: string } | null;
		zurueck?: boolean;
	} = $props();
</script>

<article class="karte artikel">
	{#if zurueck}<a class="zurueck" href={resolve('/(app)/handbuch')}>← Alle Themen</a>{/if}
	<div class="kopf">
		<span class="kapitel">{kapitel}</span>
		<span class="schild">{rollen ? `Für ${rollen.join(', ')}` : 'Für alle'}</span>
	</div>
	<h2 class="titel">{titel}</h2>
	<!-- Inhalt aus dem Repo, mit cleanHtml bereinigt -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<div class="text">{@html html}</div>
	{#if vorher || nachher}
		<nav class="blaettern" aria-label="Weitere Themen im Kapitel">
			{#if vorher}
				<a
					class="knopf zweit klein"
					href={resolve('/(app)/handbuch/[slug]', { slug: vorher.slug })}
				>
					‹ {vorher.title}
				</a>
			{:else}<span></span>{/if}
			{#if nachher}
				<a
					class="knopf zweit klein"
					href={resolve('/(app)/handbuch/[slug]', { slug: nachher.slug })}
				>
					{nachher.title} ›
				</a>
			{/if}
		</nav>
	{/if}
</article>

<style>
	.artikel {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 20px 22px;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.kopf {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--mu);
	}
	.titel {
		margin: 0;
		font-size: 26px;
		line-height: 1.25;
	}
	.text :global(h2) {
		font-size: 1.1rem;
		margin: 1.2em 0 0.4em;
	}
	.text :global(h2:first-child) {
		margin-top: 0;
	}
	.text :global(p),
	.text :global(ul),
	.text :global(ol) {
		margin: 0 0 0.8em;
		line-height: 1.55;
	}
	.text :global(ol) {
		padding-left: 1.4em;
	}
	.text :global(blockquote) {
		margin: 0 0 0.8em;
		padding: 10px 14px;
		border-radius: 12px;
		background: var(--tint);
	}
	.text :global(blockquote p:last-child) {
		margin: 0;
	}
	.text :global(:last-child) {
		margin-bottom: 0;
	}
	.blaettern {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		padding-top: 12px;
		border-top: 1px solid var(--bd);
	}
	.klein {
		min-height: 38px;
		padding: 6px 14px;
		font-size: 14px;
	}
</style>
