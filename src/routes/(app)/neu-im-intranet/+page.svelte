<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Neu im Intranet · Intranet</title></svelte:head>

<div class="stapel seite">
	<div>
		<h1>Neu im Intranet</h1>
		<p class="hinweis">Was sich geändert hat. Der neueste Eintrag steht oben.</p>
	</div>
	{#each data.eintraege as e, i (e.version)}
		<section class="karte eintrag" aria-labelledby="v-{e.version}">
			<div class="kopf">
				<h2 id="v-{e.version}">{e.title}</h2>
				{#if i === 0}<span class="schild">Aktuell</span>{/if}
			</div>
			<p class="hinweis klein">Version {e.version} · {e.date}</p>
			<!-- Inhalt aus CHANGELOG.md im Repo, mit cleanHtml bereinigt -->
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<div class="text">{@html e.html}</div>
		</section>
	{/each}
</div>

<style>
	.seite {
		max-width: 820px;
	}
	h1 {
		margin: 0;
	}
	.kopf {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	h2 {
		margin: 0;
		font-size: 20px;
	}
	.klein {
		margin: 2px 0 8px;
		font-size: 13px;
	}
	.text :global(ul) {
		margin: 0;
		padding-left: 1.2em;
		display: grid;
		gap: 4px;
		line-height: 1.5;
	}
	.text :global(p) {
		margin: 0 0 8px;
	}
</style>
