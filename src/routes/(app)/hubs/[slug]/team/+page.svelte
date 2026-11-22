<script lang="ts">
	/** Hub-Seite, Reiter „Über uns & Team“ */
	import { resolve } from '$app/paths';
	import { animierteBilder } from '#lib/animiert.ts';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import HubLeer from '#lib/components/hub/HubLeer.svelte';
	import { reiterVon } from '#lib/hub-seite.ts';

	let { data } = $props();
	const h = $derived(data.hub);
	const r = $derived(reiterVon(data, 'team'));
	const BRIEF =
		'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2zM3 7l9 6l9 -6';
	const CHAT =
		'M8 9h8M8 13h6M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z';
</script>

<svelte:head><title>Über uns & Team · {h.name} · Hubs · Intranet</title></svelte:head>

{#if r.leer}
	<HubLeer
		titel="Noch keine Angaben"
		text="Hier stellt sich der Hub vor und du siehst, wer ihn pflegt."
		aktion={r.pflegbar
			? {
					href: resolve('/(app)/hubs/[slug]/bearbeiten', { slug: h.slug }),
					label: 'Hub bearbeiten'
				}
			: null}
	/>
{:else}
	<div class="spalten">
		{#if h.aboutHtml}
			<section class="karte" aria-labelledby="h-ueber">
				<h2 id="h-ueber">Über uns</h2>
				<!-- Vom Server bereinigt (nur erlaubte Elemente und eigene Bilder) -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="text" use:animierteBilder>{@html h.aboutHtml}</div>
			</section>
		{/if}
		<div class="stapel">
			{#if h.team.length}
				<section class="karte" aria-labelledby="h-c">
					<h2 id="h-c">Hub-Team</h2>
					<p class="unter">
						Personen aus verschiedenen Abteilungen, die diesen Hub gemeinsam pflegen.
					</p>
					<ul class="zeilen">
						{#each h.team as m (m.id)}
							<li>
								<Avatar name={m.name} foto={m.foto} groesse={44} />
								<span class="spalte">
									<span>
										<a class="name" href={resolve('/(app)/personen/[id]', { id: m.id })}>
											{m.name}
										</a>{#if m.koordination}&nbsp;<span class="schild">Koordination</span>{/if}
									</span>
									{#if m.task}<span class="unter">{m.task}</span>{/if}
									{#if m.abteilung}
										{#if m.abteilungSlug}
											<a
												class="unter"
												href={resolve('/(app)/abteilungen/[slug]', { slug: m.abteilungSlug })}
											>
												{m.abteilung}
											</a>
										{:else}<span class="unter">{m.abteilung}</span>{/if}
									{/if}
								</span>
								<a
									class="rund"
									href="https://teams.microsoft.com/l/chat/0/0?users={encodeURIComponent(m.email)}"
									target="_blank"
									rel="noopener noreferrer"
									aria-label="Teams-Chat mit {m.name}"
									title="Teams-Chat mit {m.name}"
								>
									<Icon d={CHAT} size={18} stroke={1.8} />
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
			{#if h.kontakte.length}
				<section class="karte" aria-labelledby="h-a">
					<h2 id="h-a">Ansprechpersonen</h2>
					<ul class="zeilen">
						{#each h.kontakte as k (k.id)}
							<li>
								<Avatar name={k.name} foto={k.foto} groesse={44} />
								<span class="spalte">
									<a class="name" href={resolve('/(app)/personen/[id]', { id: k.personId })}>
										{k.name}
									</a>
									{#if k.task}<span class="unter">{k.task}</span>{/if}
								</span>
								<a
									class="rund"
									href="mailto:{k.email}"
									aria-label="E-Mail an {k.name}"
									title="E-Mail an {k.name}"
								>
									<Icon d={BRIEF} size={18} stroke={1.8} />
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	</div>
{/if}

<style>
	.spalten {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr));
		gap: 20px;
		align-items: start;
	}
	h2 {
		margin: 0 0 6px;
		font-size: 20px;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
	}
	a.unter {
		color: var(--ac);
	}
	.zeilen {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.zeilen li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.zeilen li:first-child {
		border-top: 0;
	}
	.spalte {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		flex: 1;
		overflow-wrap: anywhere;
	}
	.name {
		font-weight: 600;
	}
	.rund {
		width: 44px;
		height: 44px;
		flex: none;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
</style>
