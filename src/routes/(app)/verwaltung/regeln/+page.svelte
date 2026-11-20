<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import Info from '#lib/components/Info.svelte';
	import { RULE_GROUPS } from '#lib/rules-config.ts';

	let { data, form } = $props();
	const fehler = $derived<Record<string, string>>(
		form && 'fehler' in form ? (form.fehler ?? {}) : {}
	);
	const eingabe = $derived<Record<string, string> | null>(
		form && 'eingabe' in form ? (form.eingabe ?? null) : null
	);
	const wert = (k: string) => {
		if (eingabe) return eingabe[k] ?? '';
		const v = (data.regeln as unknown as Record<string, unknown>)[k];
		return Array.isArray(v) ? v.join(' ') : String(v);
	};
	const an = (k: string) =>
		eingabe ? eingabe[k] === 'on' : Boolean((data.regeln as unknown as Record<string, unknown>)[k]);
	const behalten: SubmitFunction =
		() =>
		async ({ update }) =>
			update({ reset: false });
</script>

<svelte:head><title>Regeln für Inhalte · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/verwaltung')}>← Verwaltung</a>
	<h1>Regeln für Inhalte</h1>
	<p class="hinweis">
		Gelten für alle Mandanten.
		{data.darfAendern ? '' : 'Ändern können nur System-Admins.'}
	</p>
	{#if form && 'gespeichert' in form}<p class="meldung" role="status">Gespeichert.</p>{/if}
	{#if Object.keys(fehler).length}
		<p class="meldung fehler" role="alert">Bitte prüfe die markierten Felder.</p>
	{/if}

	<form method="POST" class="stapel" use:enhance={behalten}>
		<fieldset class="stapel" disabled={!data.darfAendern}>
			<legend class="sr-only">Regeln</legend>
			{#each RULE_GROUPS as g (g.id)}
				<section class="karte stapel" aria-labelledby="h-{g.id}">
					<h2 id="h-{g.id}">
						{g.title}
						{#if g.info}<Info thema={g.title} text={g.info} />{/if}
					</h2>
					{#each g.fields as f (f.key)}
						{#if f.type === 'bool'}
							<label class="option">
								<input type="checkbox" name={f.key} checked={an(f.key)} />
								<span>
									{f.label}
									{#if f.hint}<br /><span class="hinweis">{f.hint}</span>{/if}
								</span>
							</label>
						{:else}
							<label class="feld">
								<span>{f.label}</span>
								<span class="zeile">
									<input
										name={f.key}
										value={wert(f.key)}
										inputmode={f.type === 'number' ? 'numeric' : undefined}
										type={f.type === 'number' ? 'number' : 'text'}
										min={f.type === 'number' ? f.min : undefined}
										max={f.type === 'number' ? f.max : undefined}
										class:zahl={f.type === 'number'}
										aria-invalid={fehler[f.key] ? 'true' : undefined}
										aria-describedby="h-{f.key}"
									/>
									{#if f.type === 'number'}<span class="hinweis">{f.unit}</span>{/if}
								</span>
								<span
									id="h-{f.key}"
									class:feldfehler={fehler[f.key]}
									class:hinweis={!fehler[f.key]}
								>
									{fehler[f.key] ?? f.hint ?? (f.type === 'number' ? `${f.min} bis ${f.max}` : '')}
								</span>
							</label>
						{/if}
					{/each}
					{#if g.id === 'brett' && data.darfAendern}
						<p class="hinweis">
							Kategorien pflegst du unter
							<a href={resolve('/(app)/verwaltung/schwarzes-brett')}>Schwarzes Brett</a>.
						</p>
					{/if}
				</section>
			{/each}
			<section class="karte stapel" aria-labelledby="h-kulissen">
				<h2 id="h-kulissen">Hinter den Kulissen</h2>
				<p class="hinweis">
					Einheiten schalten die Funktion selbst frei.
					{#if data.darfAendern}
						Den Hinweis „So geht’s“ bearbeitest du unter
						<a href={resolve('/(app)/verwaltung/kulissen')}>Hinter den Kulissen</a>.
					{/if}
				</p>
			</section>
		</fieldset>
		{#if data.darfAendern}<button class="knopf" type="submit">Regeln speichern</button>{/if}
	</form>
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
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.zeile {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.zahl {
		width: 7rem;
	}
	.zeile input:not(.zahl) {
		flex: 1;
	}
	.option {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		min-height: 44px;
	}
	.option input {
		width: 20px;
		height: 20px;
		margin-top: 2px;
		flex: none;
		accent-color: var(--fill);
	}
	.feldfehler {
		color: var(--err-tx);
		font-size: 0.93rem;
		font-weight: 600;
	}
</style>
