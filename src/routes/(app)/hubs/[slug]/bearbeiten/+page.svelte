<script lang="ts">
	import MitFrage from '#lib/components/MitFrage.svelte';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import EinfuehrungAngebot from '#lib/components/EinfuehrungAngebot.svelte';
	import EinfuehrungKnopf from '#lib/components/EinfuehrungKnopf.svelte';
	import { ROLLEN } from '#lib/tours.ts';
	import { HUB_SECTIONS, type HubLayout, type HubSection } from '#lib/hubs.ts';

	let { data, form } = $props();
	const h = $derived(data.hub);

	type Bereich = 'main' | 'side' | 'aus';
	interface Zeile {
		key: HubSection;
		bereich: Bereich;
	}
	function zeilen(l: HubLayout): Zeile[] {
		const list: Zeile[] = [
			...l.main.map((key) => ({ key, bereich: 'main' as const })),
			...l.side.map((key) => ({ key, bereich: 'side' as const }))
		];
		for (const s of HUB_SECTIONS)
			if (!list.some((z) => z.key === s.key)) list.push({ key: s.key, bereich: 'aus' });
		return list;
	}
	// Beim Öffnen aus den Daten; danach lokal bearbeitet und mit „Speichern“ übernommen
	let aufbau = $state<Zeile[]>(untrack(() => zeilen(data.hub.layout)));
	const json = $derived(
		JSON.stringify({
			main: aufbau.filter((z) => z.bereich === 'main').map((z) => z.key),
			side: aufbau.filter((z) => z.bereich === 'side').map((z) => z.key)
		})
	);
	const LABEL = Object.fromEntries(HUB_SECTIONS.map((s) => [s.key, s.label]));
	function schieben(i: number, d: number) {
		const j = i + d;
		if (j < 0 || j >= aufbau.length) return;
		[aufbau[i], aufbau[j]] = [aufbau[j], aufbau[i]];
	}
</script>

<svelte:head><title>{h.name} bearbeiten · Hubs · Intranet</title></svelte:head>

<div class="stapel schmal">
	{#if h.canManage}
		<EinfuehrungAngebot
			tour={ROLLEN.hub_team}
			text="Du bist im Hub-Team. Eine kurze Einführung zeigt dir, wie du den Hub gestaltest."
		/>
	{/if}
	<a class="zurueck" href={resolve('/(app)/hubs/[slug]', { slug: h.slug })}>← {h.name}</a>
	<h1 class="mit-hilfe">
		Hub bearbeiten
		{#if h.canManage}<EinfuehrungKnopf tour={ROLLEN.hub_team} />{/if}
	</h1>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'gespeichert' in form}<p class="meldung" role="status">Gespeichert.</p>{/if}

	{#if h.canManage}
		<form
			method="POST"
			action="?/speichern"
			class="karte felder"
			data-tour="hinweis"
			use:enhance={() =>
				({ update }) =>
					update({ reset: false })}
		>
			<label class="feld">
				<span>Hinweis oben <span class="optional">(optional)</span></span>
				<textarea name="hinweis" rows="2" maxlength="500">{h.notice ?? ''}</textarea>
				<span class="hinweis">Erscheint hervorgehoben oben auf der Hub-Seite.</span>
			</label>
			<label class="feld">
				<span>Über uns</span>
				<textarea name="ueber" rows="5" maxlength="2000">{h.about ?? ''}</textarea>
			</label>

			<fieldset class="aufbau" data-tour="aufbau">
				<legend>Aufbau der Seite</legend>
				<p class="hinweis">Abschnitte ein- und ausblenden und sortieren.</p>
				<input type="hidden" name="aufbau" value={json} />
				{#each aufbau as z, i (z.key)}
					<div class="zeile">
						<span class="name">{LABEL[z.key]}</span>
						<select bind:value={z.bereich} aria-label="{LABEL[z.key]}: Bereich">
							<option value="main">Hauptbereich</option>
							<option value="side">Seitenleiste</option>
							<option value="aus">Ausgeblendet</option>
						</select>
						<button
							type="button"
							class="knopf zweit klein"
							disabled={i === 0}
							aria-label="{LABEL[z.key]} nach oben"
							onclick={() => schieben(i, -1)}
						>
							↑
						</button>
						<button
							type="button"
							class="knopf zweit klein"
							disabled={i === aufbau.length - 1}
							aria-label="{LABEL[z.key]} nach unten"
							onclick={() => schieben(i, 1)}
						>
							↓
						</button>
					</div>
				{/each}
			</fieldset>
			<div><button class="knopf" type="submit">Speichern</button></div>
		</form>

		<form method="POST" action="?/ruhen" class="karte stapel" data-tour="ruhen" use:enhance>
			<h2>Ruhen lassen</h2>
			<p class="hinweis">
				Ein ruhender Hub bleibt sichtbar, aber es erscheinen keine neuen Beiträge. Abos bleiben
				bestehen.
			</p>
			{#if h.resting}
				<button class="knopf zweit" name="ruhen" value="nein">Hub wieder aktivieren</button>
			{:else}
				<button class="knopf zweit" name="ruhen" value="ja">Hub ruhen lassen</button>
			{/if}
		</form>
	{/if}

	{#if h.canAdminister}
		<section class="karte stapel">
			<h2>Archivieren</h2>
			<p class="hinweis">
				Nur für die Verwaltung. Ein archivierter Hub ist nirgends mehr sichtbar und wird nach zwei
				Jahren gelöscht.
			</p>
			<div>
				<MitFrage
					action="?/archivieren"
					frage={{
						titel: `„${h.name}“ archivieren?`,
						text: 'Der Hub ist danach nirgends mehr sichtbar und wird nach zwei Jahren gelöscht.',
						ja: 'Archivieren',
						gefahr: true
					}}
				>
					{#snippet ausloeser(klick: () => void)}
						<button class="knopf zweit" type="button" onclick={klick}>Hub archivieren</button>
					{/snippet}
				</MitFrage>
			</div>
		</section>
	{/if}
</div>

<style>
	.schmal {
		max-width: 760px;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	.optional {
		font-weight: 400;
		color: var(--mu);
	}
	.aufbau {
		border: 0;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 6px;
	}
	.zeile {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		padding: 6px 0;
		border-top: 1px solid var(--bd);
	}
	.zeile .name {
		flex: 1 1 160px;
		font-weight: 600;
	}
	.zeile select {
		width: auto;
	}
	.klein {
		min-height: 40px;
		padding: 6px 12px;
	}
</style>
