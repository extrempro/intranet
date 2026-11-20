<script lang="ts">
	import { PASSWORD_MIN, passwordStrength, STRENGTH_LABELS } from '#lib/password.ts';

	let { data, form } = $props();
	let passwort = $state('');
	const staerke = $derived(passwordStrength(passwort));
</script>

<svelte:head>
	<title>Einladung annehmen · Intranet</title>
</svelte:head>

<section class="karte" aria-labelledby="titel">
	{#if !data.gueltig}
		<h1 id="titel">Einladung abgelaufen</h1>
		<p>
			Dieser Link gilt nicht mehr – entweder ist er älter als 7 Tage oder er wurde schon benutzt.
			Bitte die Person, die dich eingeladen hat, um eine neue Einladung.
		</p>
	{:else}
		<h1 id="titel">Willkommen, {data.name}</h1>
		<p>Leg dein Passwort fest. Danach richtest du noch einen zweiten Faktor ein.</p>

		<form method="POST" class="felder">
			<input type="hidden" name="email" autocomplete="username" value={data.email} />
			{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
			<label>
				Neues Passwort
				<input
					name="passwort"
					type="password"
					autocomplete="new-password"
					minlength={PASSWORD_MIN}
					maxlength="128"
					required
					bind:value={passwort}
					aria-describedby="regeln staerke"
				/>
			</label>
			<p id="regeln" class="hinweis">
				Mindestens {PASSWORD_MIN} Zeichen. Leerzeichen sind erlaubt – ein ganzer Satz ist ideal. Einfügen
				aus dem Passwortmanager geht auch.
			</p>
			<div id="staerke" class="staerke" aria-live="polite">
				<meter min="0" max="4" low="2" high="3" optimum="4" value={staerke}></meter>
				Stärke: {STRENGTH_LABELS[staerke]}
			</div>
			<label>
				Passwort wiederholen
				<input
					name="wiederholung"
					type="password"
					autocomplete="new-password"
					maxlength="128"
					required
				/>
			</label>
			<button class="knopf" type="submit">Weiter</button>
		</form>
	{/if}
</section>

<style>
	.karte {
		max-width: 28rem;
		margin: 4rem auto;
		padding: 0 1rem;
	}
	.felder {
		display: grid;
		gap: 0.75rem;
	}
	label {
		display: grid;
		gap: 0.25rem;
		font-weight: 600;
	}
	input {
		min-height: 44px;
		padding: 0 0.75rem;
		font: inherit;
		border: 1px solid #767676;
		border-radius: 0.5rem;
	}
	.hinweis {
		margin: 0;
		font-size: 0.95rem;
	}
	.staerke {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.knopf {
		min-height: 44px;
		padding: 0 1.25rem;
		border-radius: 999px;
		background: var(--akzent, #1f4f8f);
		color: #fff;
		font: inherit;
		font-weight: 600;
		border: 0;
		cursor: pointer;
		justify-self: start;
	}
	:focus-visible {
		outline: 3px solid #1f4f8f;
		outline-offset: 2px;
	}
	.meldung.fehler {
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		background: #fdecec;
		color: #6b1010;
	}
</style>
