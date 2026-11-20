<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<svelte:head><title>{data.meta.title} · Handbuch · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/handbuch')}>← Handbuch</a>
	<div>
		<p class="kapitel">{data.kapitel}{data.rollen ? ` · für ${data.rollen.join(', ')}` : ''}</p>
		<h1>{data.meta.title}</h1>
	</div>
	<!-- Inhalt aus dem Repo, mit cleanHtml bereinigt -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<article class="karte text">{@html data.html}</article>
	<nav class="blaettern" aria-label="Weitere Artikel im Kapitel">
		{#if data.vorher}
			<a href={resolve('/(app)/handbuch/[slug]', { slug: data.vorher.slug })}>
				‹ {data.vorher.title}
			</a>
		{:else}<span></span>{/if}
		{#if data.nachher}
			<a href={resolve('/(app)/handbuch/[slug]', { slug: data.nachher.slug })}>
				{data.nachher.title} ›
			</a>
		{/if}
	</nav>
</div>

<style>
	.seite {
		max-width: 44rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.kapitel {
		margin: 0;
		color: var(--mu);
		font-weight: 600;
		font-size: 14px;
	}
	h1 {
		margin: 0;
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
	.text :global(:last-child) {
		margin-bottom: 0;
	}
	.blaettern {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
</style>
