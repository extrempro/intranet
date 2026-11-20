<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Fotos from '#lib/components/Fotos.svelte';

	let { data, form } = $props();
	const w = $derived(form?.werte);
	const f = $derived(form?.fehler ?? {});
	// Gebundene Felder: sonst setzt Svelte sie beim Tippen im Text zurück
	let titel = $state('');
	let text = $state('');
	let kontakt = $state('');
	$effect.pre(() => {
		if (!w) return;
		titel = w.title;
		text = w.body;
		kontakt = w.ownContact;
	});
</script>

<svelte:head><title>Anzeige aufgeben · Schwarzes Brett · Intranet</title></svelte:head>

<div class="stapel">
	<a class="zurueck" href={resolve('/(app)/schwarzes-brett')}>← Schwarzes Brett</a>
	<div>
		<h1>Anzeige aufgeben</h1>
		<p class="hinweis">
			Nur private Angebote und Gesuche. Gewerbliche Anzeigen, z. B. bezahlte Dienstleistungen oder
			Handel mit Waren, sind nicht erlaubt. Private Dinge verkaufen oder verschenken ist in Ordnung.
		</p>
	</div>
	{#if f.limit}<p class="meldung fehler" role="alert">{f.limit}</p>{/if}

	<form
		method="POST"
		class="spalten"
		use:enhance={() =>
			({ update }) =>
				update({ reset: false })}
	>
		<section class="karte felder" aria-label="Anzeige">
			<fieldset class="wahl">
				<legend>Kategorie</legend>
				<div class="chips">
					{#each data.kategorien as k (k.id)}
						<label class="chip">
							<input
								type="radio"
								name="kategorie"
								value={k.id}
								required
								checked={w ? w.categoryId === k.id : false}
							/>
							<span>{k.name}</span>
						</label>
					{/each}
				</div>
				{#if f.categoryId}<span class="feldfehler">{f.categoryId}</span>{/if}
			</fieldset>
			<label class="feld">
				<span>Titel</span>
				<input
					name="titel"
					required
					maxlength="80"
					bind:value={titel}
					placeholder="z. B. Kinderfahrrad zu verschenken"
				/>
				{#if f.title}<span class="feldfehler">{f.title}</span>{/if}
			</label>
			<label class="feld">
				<span>Text</span>
				<textarea
					name="text"
					rows="5"
					maxlength="600"
					required
					bind:value={text}
					placeholder="Zustand, Ort, Zeitraum …"></textarea>
				<span class="hinweis zaehlung">{text.length} / 600 Zeichen</span>
				{#if f.body}<span class="feldfehler">{f.body}</span>{/if}
			</label>
			<Fotos fehler={f.photos} />
		</section>

		<section class="karte felder" aria-label="Kontakt und Sichtbarkeit">
			<h2>Kontakt</h2>
			<p class="hinweis">Interessierte schreiben dir immer über „Nachricht“ im Intranet.</p>
			<label class="option">
				<input type="checkbox" name="apps" checked={w?.viaApps ?? false} />
				<span>
					Auch über Teams oder E-Mail anschreiben
					<span class="hinweis">Zeigt „Teams-Chat“ und „E-Mail“ an der Anzeige</span>
				</span>
			</label>
			<label class="feld">
				<span>Eigene Angaben <span class="optional">(optional)</span></span>
				<input
					name="kontakt"
					maxlength="80"
					bind:value={kontakt}
					placeholder="z. B. Telefon 0151 …"
				/>
				<span class="hinweis">
					Für alle sichtbar, die die Anzeige sehen. Nach Ablauf wird die Angabe mit der Anzeige
					gelöscht.
				</span>
				{#if f.ownContact}<span class="feldfehler">{f.ownContact}</span>{/if}
			</label>

			<fieldset class="wahl">
				<legend>Wer sieht das?</legend>
				<div class="chips">
					{#each data.mandanten as m (m.id)}
						<label class="chip">
							<input
								type="checkbox"
								name="mandanten"
								value={m.id}
								checked={m.eigener || (w?.tenantIds.includes(m.id) ?? false)}
								disabled={m.eigener}
							/>
							<span>{m.name}</span>
						</label>
					{/each}
				</div>
				<span class="hinweis">Dein eigener Mandant ist immer dabei.</span>
			</fieldset>
			<div class="info">
				<span>Die Anzeige erscheint mit deinem Namen ({data.ich}).</span>
				<span>Sie läuft 30 Tage und lässt sich einmal verlängern.</span>
				<span>Sie erscheint erst nach Prüfung durch die Moderation.</span>
			</div>
			<div class="aktionen">
				<button class="knopf" type="submit">Zur Prüfung senden</button>
				<a class="knopf zweit" href={resolve('/(app)/schwarzes-brett')}>Abbrechen</a>
			</div>
		</section>
	</form>
</div>

<style>
	h1 {
		margin: 0;
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.spalten {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 16px;
		align-items: start;
	}
	.wahl {
		border: 0;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chip {
		position: relative;
	}
	.chip input {
		position: absolute;
		opacity: 0;
		inset: 0;
	}
	.chip span {
		display: inline-flex;
		align-items: center;
		min-height: 40px;
		padding: 0 14px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		cursor: pointer;
	}
	.chip input:checked + span {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
	}
	.chip input:focus-visible + span {
		outline: 3px solid #2f7de1;
		outline-offset: 2px;
	}
	.zaehlung {
		justify-self: end;
		font-size: 12px;
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
		accent-color: var(--fill);
	}
	.option > span {
		display: flex;
		flex-direction: column;
	}
	.optional {
		font-weight: 400;
		color: var(--mu);
	}
	.info {
		display: grid;
		gap: 4px;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--tint);
		font-size: 14px;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.feldfehler {
		color: var(--err-tx);
		font-weight: 600;
		font-size: 0.93rem;
	}
</style>
