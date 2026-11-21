<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Info from '#lib/components/Info.svelte';
	import Kanalpillen from '#lib/components/konto/Kanalpillen.svelte';
	import { matchesSearch } from '#lib/departments.ts';

	let { data, form } = $props();
	let suche = $state('');
	// Auswahl folgt dem gespeicherten Standard (auch nach dem Speichern)
	let std = $derived({ ...data.standard });
	let alleFragen = $state(false);

	const kanaele = (h: { bell: boolean; push: boolean; email: boolean }) =>
		[h.bell && 'Glocke', h.push && 'Push', h.email && 'E-Mail'].filter(Boolean).join(', ') ||
		'keine Benachrichtigung';
	const gefiltert = $derived(data.hubs.filter((h) => matchesSearch(suche, [h.name])));
	const pflicht = $derived(gefiltert.filter((h) => h.mandatory));
	const freiwillig = $derived(gefiltert.filter((h) => !h.mandatory));
	const abweichend = $derived(data.hubs.filter((h) => h.eigen).length);
	const freiwilligGesamt = $derived(data.hubs.filter((h) => !h.mandatory).length);
</script>

<svelte:head><title>Meine Hubs · Konto · Intranet</title></svelte:head>

{#snippet hubZeile(h: (typeof data.hubs)[number])}
	<li>
		<details>
			<summary>
				<span class="was">
					<strong>{h.name.replace(/^Hub /, '')}</strong>
					<span class="hinweis">
						{h.eigen ? 'Eigene Einstellung' : 'Standard'}: {kanaele(h)}
					</span>
				</span>
			</summary>
			<div class="innen">
				<form method="POST" action="?/kanaele" class="zeile" use:enhance>
					<input type="hidden" name="hub" value={h.id} />
					<Kanalpillen titel="Kanäle für {h.name}" glocke={h.bell} push={h.push} mail={h.email} />
					<button class="knopf zweit klein" type="submit">Speichern</button>
				</form>
				<div class="zeile">
					<a href={resolve('/(app)/hubs/[slug]', { slug: h.slug })}>Zum Hub</a>
					{#if !h.mandatory}
						<form method="POST" action="?/abbestellen" use:enhance>
							<input type="hidden" name="hub" value={h.id} />
							<button class="linkknopf" type="submit">Abo beenden</button>
						</form>
					{/if}
				</div>
			</div>
		</details>
	</li>
{/snippet}

<div class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/konto')}>← Konto</a>
	<div>
		<h1>
			Meine Hubs
			<Info
				thema="Meine Hubs"
				text="Hier legst du fest, wie du über neue Beiträge aus deinen Hubs benachrichtigt wirst. Pflicht-Abos kannst du nicht beenden, aber leiser stellen."
			/>
		</h1>
		<p class="hinweis">
			{data.hubs.length}
			{data.hubs.length === 1 ? 'Hub' : 'Hubs'} abonniert. Tipp auf einen Hub, um ihn einzustellen.
		</p>
	</div>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}

	<form method="POST" action="?/standard" class="karte stapel standard" use:enhance>
		<h2>Standard für neue Abos</h2>
		<Kanalpillen
			titel="Standard für neue Abos"
			bind:glocke={std.bell}
			bind:push={std.push}
			bind:mail={std.email}
		/>
		<div class="zeile">
			<button class="knopf zweit klein" type="submit">Speichern</button>
			{#if data.hubs.length}
				<button class="knopf zweit klein" type="submit" name="anwenden" value="ja">
					Auf alle Abos anwenden
				</button>
				<span class="hinweis">
					{abweichend === 0
						? 'Alle Abos folgen dem Standard.'
						: abweichend === 1
							? '1 Abo weicht ab.'
							: `${abweichend} Abos weichen ab.`}
				</span>
			{/if}
		</div>
	</form>

	{#if data.hubs.length === 0}
		<div class="karte stapel leer">
			<span class="hinweis">
				Du hast noch keine Hubs abonniert. Tipp bei einem Hub auf die Glocke.
			</span>
			<a class="knopf" href={resolve('/(app)/hubs')}>Hubs ansehen</a>
		</div>
	{:else}
		{#if data.hubs.length > 5}
			<div>
				<label class="sr-only" for="suche-abos">Abos durchsuchen</label>
				<input
					id="suche-abos"
					type="search"
					bind:value={suche}
					placeholder="Abos durchsuchen"
					autocomplete="off"
					maxlength="100"
				/>
			</div>
		{/if}
		{#if pflicht.length}
			<section class="karte gruppe" aria-labelledby="h-pflicht">
				<h2 id="h-pflicht">Pflicht-Abos · {pflicht.length}</h2>
				<ul>
					{#each pflicht as h (h.id)}{@render hubZeile(h)}{/each}
				</ul>
			</section>
		{/if}
		{#if freiwillig.length}
			<section class="karte gruppe" aria-labelledby="h-frei">
				<h2 id="h-frei">Freiwillige Abos · {freiwillig.length}</h2>
				<ul>
					{#each freiwillig as h (h.id)}{@render hubZeile(h)}{/each}
				</ul>
			</section>
		{/if}
		{#if gefiltert.length === 0}<p class="karte hinweis">Kein Abo zu „{suche}“.</p>{/if}

		<p class="hinweis">
			E-Mails kommen sofort oder gesammelt, wie unter Konto → Benachrichtigungen eingestellt.
		</p>
		{#if freiwilligGesamt}
			{#if alleFragen}
				<form method="POST" action="?/alleBeenden" class="zeile" use:enhance>
					<span>Alle {freiwilligGesamt} freiwilligen Abos beenden?</span>
					<button class="knopf rot klein" type="submit">Ja, beenden</button>
					<button class="knopf zweit klein" type="button" onclick={() => (alleFragen = false)}>
						Abbrechen
					</button>
				</form>
			{:else}
				<div>
					<button
						class="knopf zweit klein rotschrift"
						type="button"
						onclick={() => (alleFragen = true)}
					>
						Alle freiwilligen Abos beenden
					</button>
				</div>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.schmal {
		max-width: 820px;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h1 {
		margin: 0;
	}
	h2 {
		margin: 0;
		font-size: 16px;
	}
	.leer {
		justify-items: start;
	}
	.zeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	input[type='search'] {
		width: 100%;
	}
	.gruppe {
		padding: 12px 16px 4px;
	}
	.gruppe ul {
		list-style: none;
		margin: 6px 0 0;
		padding: 0;
	}
	.gruppe li + li {
		border-top: 1px solid var(--bd);
	}
	summary {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 52px;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::after {
		content: '';
		margin-left: auto;
		width: 14px;
		height: 14px;
		flex: none;
		background: var(--mu);
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6l6 -6'/%3E%3C/svg%3E")
			center / contain no-repeat;
		transition: transform 0.15s ease;
	}
	details[open] summary::after {
		transform: rotate(180deg);
	}
	.was {
		display: flex;
		flex-direction: column;
	}
	.was .hinweis {
		font-size: 13px;
	}
	.innen {
		display: grid;
		gap: 10px;
		padding: 0 0 12px;
	}
	.klein {
		min-height: 38px;
		padding: 6px 12px;
	}
	.knopf.rot {
		background: #b42318;
		border-color: #b42318;
		color: #fff;
	}
	.rotschrift {
		color: var(--err-tx);
	}
</style>
