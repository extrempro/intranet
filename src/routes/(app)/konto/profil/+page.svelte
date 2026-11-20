<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import Avatar from '#lib/components/Avatar.svelte';
	import FotoZuschnitt from '#lib/components/FotoZuschnitt.svelte';
	import Info from '#lib/components/Info.svelte';
	import { MOBILE_VISIBILITY, type ContactErrors } from '#lib/profile.ts';

	let { data, form } = $props();
	const pr = $derived(data.profil);
	let k = $state(
		untrack(() => ({
			position: data.profil.position,
			phone: data.profil.phone,
			mobile: data.profil.mobile,
			vis: data.profil.mobileVisibility as string,
			room: data.profil.room
		}))
	);
	const f = $derived<ContactErrors>(form && 'felder' in form ? (form.felder as ContactErrors) : {});
	const behalten: SubmitFunction =
		() =>
		async ({ update }) =>
			update({ reset: false });
</script>

<svelte:head><title>Mein Profil · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/konto')}>← Konto</a>
	<div>
		<h1>Mein Profil</h1>
		<p class="hinweis">
			Diese Angaben pflegst du selbst; aus Entra wird nichts übernommen.
			<a href={resolve('/(app)/personen/[id]', { id: pr.id })}>So sehen dich andere</a>
		</p>
	</div>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}

	<section class="karte stapel" aria-labelledby="h-foto">
		<h2 id="h-foto">Profilfoto</h2>
		<div class="fotozeile">
			<Avatar name={pr.name} foto={pr.foto} groesse={96} />
			<p class="hinweis">
				Freiwillig. Das Foto wird verschlüsselt gespeichert, ohne Metadaten wie Ort oder Kamera.
				Sichtbar für alle, die dich im Intranet sehen.
			</p>
		</div>
		<FotoZuschnitt />
		{#if pr.foto}
			<form method="POST" action="?/fotoLoeschen" use:enhance>
				<button class="linkknopf" type="submit">Foto löschen</button>
			</form>
		{/if}
	</section>

	<section class="karte stapel" aria-labelledby="h-kontakt">
		<h2 id="h-kontakt">Kontaktdaten</h2>
		<p class="hinweis">{pr.name} · {pr.email}</p>
		<form method="POST" action="?/kontakt" class="stapel" use:enhance={behalten}>
			<label class="feld">
				<span>Position</span>
				<input
					name="position"
					maxlength="80"
					bind:value={k.position}
					placeholder="z. B. Referentin der Intendanz"
					aria-invalid={f.position ? 'true' : undefined}
					aria-describedby={f.position ? 'f-position' : undefined}
				/>
				{#if f.position}<span id="f-position" class="feldfehler">{f.position}</span>{/if}
			</label>
			<div class="zwei">
				<label class="feld">
					<span>Telefon</span>
					<input
						name="telefon"
						type="tel"
						maxlength="30"
						autocomplete="tel"
						bind:value={k.phone}
						aria-invalid={f.phone ? 'true' : undefined}
						aria-describedby={f.phone ? 'f-telefon' : undefined}
					/>
					{#if f.phone}<span id="f-telefon" class="feldfehler">{f.phone}</span>{/if}
				</label>
				<label class="feld">
					<span>Raum</span>
					<input
						name="raum"
						maxlength="40"
						bind:value={k.room}
						aria-invalid={f.room ? 'true' : undefined}
						aria-describedby={f.room ? 'f-raum' : undefined}
					/>
					{#if f.room}<span id="f-raum" class="feldfehler">{f.room}</span>{/if}
				</label>
			</div>
			<label class="feld">
				<span>Mobil</span>
				<input
					name="mobil"
					type="tel"
					maxlength="30"
					autocomplete="tel"
					bind:value={k.mobile}
					aria-invalid={f.mobile ? 'true' : undefined}
					aria-describedby={f.mobile ? 'f-mobil' : undefined}
				/>
				{#if f.mobile}<span id="f-mobil" class="feldfehler">{f.mobile}</span>{/if}
			</label>
			<fieldset class="feld">
				<legend>
					Wer sieht deine Mobilnummer?
					<Info
						thema="Wer sieht deine Mobilnummer?"
						text="Alle: jede Person, die dein Profil sieht. Nur mein Team: Personen aus deinen Abteilungen und Hubs. Niemand: Die Nummer bleibt gespeichert, wird aber nirgends angezeigt, auch nicht in der Suche."
					/>
				</legend>
				<div class="optionen">
					{#each MOBILE_VISIBILITY as v (v.key)}
						<label class="option">
							<input type="radio" name="sichtbarkeit" value={v.key} bind:group={k.vis} />
							{v.label}
						</label>
					{/each}
				</div>
				{#if f.mobileVisibility}<span class="feldfehler">{f.mobileVisibility}</span>{/if}
			</fieldset>
			<button class="knopf" type="submit">Speichern</button>
		</form>
		<p class="hinweis">
			Deinen Standort für den Speiseplan wählst du unter
			<a href={resolve('/(app)/konto/standorte')}>Meine Standorte</a>.
		</p>
	</section>
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
	.fotozeile {
		display: flex;
		gap: 16px;
		align-items: center;
	}
	.fotozeile .hinweis {
		margin: 0;
	}
	.zwei {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	.optionen {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 20px;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
	}
	.option input {
		width: 20px;
		height: 20px;
		accent-color: var(--fill);
	}
	.feldfehler {
		color: var(--err-tx);
		font-size: 0.93rem;
		font-weight: 600;
	}
</style>
