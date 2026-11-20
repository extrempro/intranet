<script lang="ts">
	import { resolve } from '$app/paths';

	let { form } = $props();
	const w = $derived(form?.werte);
	const f = $derived(form?.fehler ?? {});
</script>

<svelte:head><title>Hub beantragen · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/hubs')}>← Hubs</a>
	<div>
		<h1>Hub beantragen</h1>
		<p class="hinweis">
			Die Redaktion prüft deinen Antrag vor, die Verwaltung legt den Hub an. Rückfragen kommen als
			Nachricht; ohne Antwort wird der Antrag nach 30 Tagen geschlossen.
		</p>
	</div>
	<form method="POST" class="karte felder">
		<label class="feld">
			<span>Name des Hubs</span>
			<input
				name="name"
				required
				maxlength="80"
				value={w?.name ?? ''}
				placeholder="z. B. Radfahrende"
			/>
			{#if f.name}<span class="feldfehler">{f.name}</span>{/if}
		</label>
		<label class="feld">
			<span>Beschreibung</span>
			<textarea name="beschreibung" rows="4" required maxlength="1000"
				>{w?.description ?? ''}</textarea
			>
			<span class="hinweis">Erscheint später unter „Über uns“.</span>
			{#if f.description}<span class="feldfehler">{f.description}</span>{/if}
		</label>
		<label class="feld">
			<span>Begründung</span>
			<textarea name="begruendung" rows="3" required maxlength="1000">{w?.reason ?? ''}</textarea>
			<span class="hinweis">Nur für Redaktion und Verwaltung: Warum braucht es den Hub?</span>
			{#if f.reason}<span class="feldfehler">{f.reason}</span>{/if}
		</label>
		<label class="feld">
			<span>Hub-Team</span>
			<textarea name="team" rows="2" required placeholder="E-Mail-Adressen, getrennt durch Komma"
				>{w?.team ?? ''}</textarea
			>
			<span class="hinweis">Du gehörst automatisch dazu. Höchstens 10 Personen.</span>
			{#if f.team}<span class="feldfehler">{f.team}</span>{/if}
		</label>
		<fieldset class="wahl">
			<legend>Zuständigkeit</legend>
			<label class="option">
				<input type="radio" name="zustaendigkeit" value="mandant" checked={!w?.central} /> Nur mein Mandant
			</label>
			<label class="option">
				<input type="radio" name="zustaendigkeit" value="zentral" checked={w?.central ?? false} /> Alle
				Mandanten (zentral)
			</label>
		</fieldset>
		<div class="aktionen">
			<button class="knopf" type="submit">Antrag senden</button>
			<a class="knopf zweit" href={resolve('/(app)/hubs')}>Abbrechen</a>
		</div>
	</form>
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
	h1 {
		margin: 0;
	}
	.wahl {
		border: 0;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 4px;
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
