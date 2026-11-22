<script lang="ts">
	/** Hub-Seite, Reiter „Fragen“ */
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import HubLeer from '#lib/components/hub/HubLeer.svelte';
	import { reiterVon } from '#lib/hub-seite.ts';

	let { data } = $props();
	const h = $derived(data.hub);
	const r = $derived(reiterVon(data, 'fragen'));
	const PFEIL = 'M9 6l6 6l-6 6';
	const anlegen = $derived(`${resolve('/(app)/faqs/neu')}?einheit=${h.id}`);
</script>

<svelte:head><title>Fragen · {h.name} · Hubs · Intranet</title></svelte:head>

{#if h.faqs.length}
	<section class="karte" aria-labelledby="h-f">
		<div class="kopfzeile">
			<h2 id="h-f">Häufige Fragen</h2>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- aus resolve() gebaut -->
			{#if r.pflegbar}<a class="klein-link" href={anlegen}>FAQ anlegen</a>{/if}
		</div>
		<ul class="fragen">
			{#each h.faqs as f (f.id)}
				<li>
					<a class="frage" href="{resolve('/(app)/faqs')}?einheit={h.id}#faq-{f.id}">
						<span>{f.question}</span>
						<Icon d={PFEIL} size={16} stroke={2} />
					</a>
				</li>
			{/each}
		</ul>
		<p class="hinweis">
			Deine Frage ist nicht dabei? <a href={resolve('/(app)/hubs/[slug]/team', { slug: h.slug })}>
				Frag das Hub-Team
			</a>.
		</p>
	</section>
{:else}
	<HubLeer
		titel="Noch keine Fragen"
		text="Hier stehen Antworten auf Fragen, die zu diesem Thema oft gestellt werden."
		aktion={r.pflegbar ? { href: anlegen, label: 'FAQ anlegen' } : null}
	/>
{/if}

<style>
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: baseline;
		gap: 6px 10px;
		margin-bottom: 6px;
	}
	h2 {
		margin: 0;
		font-size: 20px;
	}
	.klein-link {
		font-size: 14px;
		font-weight: 600;
	}
	.fragen {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.fragen li {
		border-top: 1px solid var(--bd);
	}
	.fragen li:first-child {
		border-top: 0;
	}
	.frage {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 6px 0;
		text-decoration: none;
	}
	.hinweis {
		margin: 12px 0 0;
	}
</style>
