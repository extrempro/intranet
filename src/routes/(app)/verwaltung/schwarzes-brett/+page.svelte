<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const frei = $derived(data.kategorien.filter((k) => !k.fixed));
</script>

<svelte:head><title>Schwarzes Brett · Verwaltung · Intranet</title></svelte:head>

<div class="stapel schmal">
	<h1>Schwarzes Brett: Kategorien</h1>
	<p class="hinweis">
		Gilt für alle Mandanten. „Sonstiges“ ist fest und steht immer am Ende; Anzeigen gelöschter
		Kategorien wandern dorthin.
	</p>
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	<ul class="liste karte">
		{#each frei as k, i (k.id)}
			<li>
				<form method="POST" action="?/umbenennen" class="name" use:enhance>
					<input type="hidden" name="id" value={k.id} />
					<label class="sr-only" for="k-{k.id}">Name</label>
					<input id="k-{k.id}" name="name" value={k.name} maxlength="40" required />
					<button class="knopf zweit klein" type="submit">Speichern</button>
				</form>
				<form method="POST" class="werkzeuge" use:enhance>
					<input type="hidden" name="id" value={k.id} />
					<button
						class="knopf zweit klein"
						formaction="?/hoch"
						disabled={i === 0}
						aria-label="{k.name} nach oben"
					>
						↑
					</button>
					<button
						class="knopf zweit klein"
						formaction="?/runter"
						disabled={i === frei.length - 1}
						aria-label="{k.name} nach unten"
					>
						↓
					</button>
					<button class="knopf zweit klein rotschrift" formaction="?/loeschen">Löschen</button>
				</form>
			</li>
		{/each}
		<li><span class="fest">Sonstiges <span class="hinweis">· fest</span></span></li>
	</ul>

	<form method="POST" action="?/anlegen" class="karte neu" use:enhance>
		<label class="feld">
			<span>Neue Kategorie</span>
			<input name="name" maxlength="40" required placeholder="z. B. Tiere" />
		</label>
		<button class="knopf" type="submit">Hinzufügen</button>
	</form>
</div>

<style>
	.schmal {
		max-width: 720px;
	}
	h1 {
		margin: 0;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.liste li {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		justify-content: space-between;
		padding: 10px 14px;
	}
	.liste li + li {
		border-top: 1px solid var(--bd);
	}
	.name,
	.werkzeuge {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.name input {
		width: 220px;
	}
	.klein {
		min-height: 40px;
		padding: 6px 12px;
	}
	.rotschrift {
		color: var(--err-tx);
	}
	.fest {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
	}
	.neu {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: end;
	}
	.neu .feld {
		flex: 1 1 240px;
	}
</style>
