<script lang="ts">
	/** Abteilungsseite, Reiter „Über uns & Team“ */
	import { resolve } from '$app/paths';
	import { tick } from 'svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import HubLeer from '#lib/components/hub/HubLeer.svelte';
	import { abteilungReiterVon } from '#lib/abteilung-seite.ts';
	import { matchesSearch } from '#lib/departments.ts';

	let { data } = $props();
	const h = $derived(data.einheit);
	const r = $derived(abteilungReiterVon(data, 'team'));

	// Großes Team: Suche und erst 12 Personen (Kap. 6.7)
	const ERSTE = 12;
	let suche = $state('');
	let alle = $state(false);
	const gross = $derived(h.team.length > ERSTE);
	const treffer = $derived(
		h.team.filter((m) => matchesSearch(suche, [m.name, m.position ?? '', m.room ?? '']))
	);
	const sichtbar = $derived(alle || suche ? treffer : treffer.slice(0, ERSTE));
	let liste = $state<HTMLUListElement>();
	async function alleZeigen() {
		alle = true;
		await tick();
		liste?.querySelectorAll<HTMLElement>('li')[ERSTE]?.querySelector<HTMLElement>('a')?.focus();
	}
	const BRIEF =
		'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2zM3 7l9 6l9 -6';
	const rolle = (id: string) =>
		[h.leitung?.id, h.zweiteLeitung?.id].includes(id)
			? 'Leitung'
			: h.stellvertretung?.id === id
				? 'Stellvertretung'
				: null;
</script>

<svelte:head><title>Über uns & Team · {h.name} · Abteilungen · Intranet</title></svelte:head>

{#if r.leer}
	<HubLeer
		titel="Noch keine Angaben"
		text="Hier stellt sich die Abteilung vor und du siehst, wer dazugehört."
		aktion={r.pflegbar
			? {
					href: resolve('/(app)/abteilungen/[slug]/bearbeiten', { slug: h.slug }),
					label: 'Abteilung bearbeiten'
				}
			: null}
	/>
{:else}
	<div class="spalten">
		{#if h.about}
			<section class="karte" aria-labelledby="h-ueber">
				<h2 id="h-ueber">Über uns</h2>
				<p class="text">{h.about}</p>
			</section>
		{/if}
		{#if h.team.length}
			<section class="karte" aria-labelledby="h-c">
				<h2 id="h-c">Team <span class="anzahl">{h.team.length}</span></h2>
				{#if gross}
					<label class="sr-only" for="team-suche">Im Team suchen</label>
					<input
						id="team-suche"
						class="teamsuche"
						type="search"
						bind:value={suche}
						placeholder="Name, Position oder Raum"
						autocomplete="off"
						maxlength="100"
					/>
					<p class="unter" role="status">
						{sichtbar.length} von {suche ? treffer.length : h.team.length} Personen
					</p>
				{/if}
				<ul class="zeilen" bind:this={liste}>
					{#each sichtbar as m (m.id)}
						{@const ro = rolle(m.id)}
						<li>
							<Avatar name={m.name} foto={m.foto} groesse={44} />
							<span class="spalte">
								<span>
									<a class="name" href={resolve('/(app)/personen/[id]', { id: m.id })}>
										{m.name}
									</a>{#if ro}&nbsp;<span class="schild">{ro}</span>{/if}
								</span>
								{#if m.position}<span class="unter">{m.position}</span>{/if}
								{#if m.phone || m.mobile || m.room}
									<span class="unter">
										{#if m.phone}<a href="tel:{m.phone}">{m.phone}</a>{/if}
										{#if m.mobile}{#if m.phone}&nbsp;·
											{/if}<a href="tel:{m.mobile}">{m.mobile}</a>{/if}
										{#if m.room}{#if m.phone || m.mobile}&nbsp;·
											{/if}Raum {m.room}{/if}
									</span>
								{/if}
							</span>
							<a
								class="rund"
								href="mailto:{m.email}"
								aria-label="E-Mail an {m.name}"
								title="E-Mail an {m.name}"
							>
								<Icon d={BRIEF} size={18} stroke={1.8} />
							</a>
						</li>
					{/each}
				</ul>
				{#if gross && !alle && !suche && treffer.length > ERSTE}
					<button type="button" class="knopf zweit mehr" onclick={alleZeigen}>
						Alle {h.team.length} anzeigen
					</button>
				{/if}
			</section>
		{/if}
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
	.anzahl {
		font-weight: 400;
		color: var(--mu);
	}
	.text {
		margin: 0;
		white-space: pre-line;
	}
	.unter {
		font-size: 13px;
		color: var(--mu);
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
	.teamsuche {
		width: 100%;
		margin: 6px 0 4px;
	}
	.mehr {
		width: 100%;
		margin-top: 8px;
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
