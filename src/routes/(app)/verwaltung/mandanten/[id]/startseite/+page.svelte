<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { moveItem } from '#lib/home.ts';

	let { data, form } = $props();
	let karten = $state(untrack(() => data.karten.map((k) => ({ ...k }))));
	let favoriten = $state<string[]>(untrack(() => [...data.favoriten]));
	let neu = $state('');
	const label = (k: string) => data.auswahl.find((a) => a.key === k);
	const frei = $derived(data.auswahl.filter((a) => !favoriten.includes(a.key)));
	const behalten: SubmitFunction =
		() =>
		async ({ update }) =>
			update({ reset: false });
</script>

<svelte:head><title>Startseite für neue Personen · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/verwaltung/mandanten/[id]', { id: data.mandant.id })}>
		← {data.mandant.name}
	</a>
	<div>
		<h1>Startseite für neue Personen</h1>
		<p class="hinweis">
			Gilt für Personen, die ihre Startseite noch nicht angepasst haben („Auf Standard zurücksetzen“
			führt ebenfalls hierher). Die Favoriten bekommen neue Personen beim ersten Anmelden; danach
			pflegt jede Person ihre Favoriten selbst.
		</p>
	</div>
	{#if form && 'gespeichert' in form}<p class="meldung" role="status">Gespeichert.</p>{/if}
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	<form method="POST" class="stapel" use:enhance={behalten}>
		<input type="hidden" name="reihenfolge" value={JSON.stringify(karten.map((k) => k.id))} />
		<input
			type="hidden"
			name="ausgeblendet"
			value={JSON.stringify(karten.filter((k) => !k.visible).map((k) => k.id))}
		/>
		<input type="hidden" name="favoriten" value={JSON.stringify(favoriten)} />

		<section class="karte stapel" aria-labelledby="h-fav">
			<h2 id="h-fav">Favoriten ({favoriten.length} von {data.max})</h2>
			{#if favoriten.length === 0}<p class="hinweis">Keine Favoriten.</p>{/if}
			<ol class="liste">
				{#each favoriten as k, i (k)}
					<li>
						<span>
							<strong>{label(k)?.label ?? k}</strong>
							<span class="hinweis">· {label(k)?.description}</span>
						</span>
						<span class="werkzeuge">
							<button
								type="button"
								class="mini"
								aria-label="{label(k)?.label} nach oben"
								disabled={i === 0}
								onclick={() => (favoriten = moveItem(favoriten, i, -1))}
							>
								↑
							</button>
							<button
								type="button"
								class="mini"
								aria-label="{label(k)?.label} nach unten"
								disabled={i === favoriten.length - 1}
								onclick={() => (favoriten = moveItem(favoriten, i, 1))}
							>
								↓
							</button>
							<button
								type="button"
								class="mini"
								aria-label="{label(k)?.label} entfernen"
								onclick={() => (favoriten = favoriten.filter((x) => x !== k))}
							>
								×
							</button>
						</span>
					</li>
				{/each}
			</ol>
			{#if favoriten.length < data.max}
				<div class="hinzu">
					<label class="feld">
						<span>Favorit hinzufügen</span>
						<select bind:value={neu}>
							<option value="">Bitte wählen</option>
							{#each frei as a (a.key)}<option value={a.key}>
									{a.label} ({a.description})
								</option>{/each}
						</select>
					</label>
					<button
						type="button"
						class="knopf zweit"
						disabled={!neu}
						onclick={() => {
							favoriten = [...favoriten, neu];
							neu = '';
						}}
					>
						Hinzufügen
					</button>
				</div>
			{/if}
		</section>

		<section class="karte stapel" aria-labelledby="h-karten">
			<h2 id="h-karten">Karten</h2>
			<ol class="liste">
				{#each karten as k, i (k.id)}
					<li>
						<label class="option">
							<input type="checkbox" bind:checked={k.visible} />
							{k.label}
						</label>
						<span class="werkzeuge">
							<button
								type="button"
								class="mini"
								aria-label="{k.label} nach oben"
								disabled={i === 0}
								onclick={() => (karten = moveItem(karten, i, -1))}
							>
								↑
							</button>
							<button
								type="button"
								class="mini"
								aria-label="{k.label} nach unten"
								disabled={i === karten.length - 1}
								onclick={() => (karten = moveItem(karten, i, 1))}
							>
								↓
							</button>
						</span>
					</li>
				{/each}
			</ol>
		</section>
		<button class="knopf" type="submit">Speichern</button>
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
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
	.liste li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 6px 0;
		border-top: 1px solid var(--bd);
	}
	.liste li:first-child {
		border-top: 0;
	}
	.werkzeuge {
		display: flex;
		gap: 6px;
	}
	.mini {
		min-width: 38px;
		min-height: 38px;
		border: 1px solid var(--bd);
		border-radius: 10px;
		background: var(--sf);
		color: var(--tx);
		cursor: pointer;
	}
	.mini:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.hinzu {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: flex-end;
	}
	.hinzu .feld {
		flex: 1 1 260px;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
	}
	.option input {
		width: 20px;
		height: 20px;
		accent-color: var(--fill);
	}
</style>
