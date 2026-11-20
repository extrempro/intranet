<script lang="ts">
	import { PASSWORD_MIN, passwordStrength, STRENGTH_LABELS } from '#lib/password.ts';

	let { data, form } = $props();
	let passwort = $state('');
	const staerke = $derived(passwordStrength(passwort));
</script>

<svelte:head>
	<title>Einladung annehmen · Intranet</title>
</svelte:head>

<div class="stapel">
	{#if !data.gueltig}
		<h1>Einladung abgelaufen</h1>
		<p>
			Dieser Link gilt nicht mehr – entweder ist er älter als 7 Tage oder er wurde schon benutzt.
			Bitte die Person, die dich eingeladen hat, um eine neue Einladung.
		</p>
	{:else}
		<h1>Willkommen, {data.name}</h1>
		<p>Leg dein Passwort fest. Danach richtest du noch einen zweiten Faktor ein.</p>

		<form method="POST" class="felder">
			<input type="hidden" name="email" autocomplete="username" value={data.email} />
			{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
			<label class="feld">
				<span>Neues Passwort</span>
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
			<label class="feld">
				<span>Passwort wiederholen</span>
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
</div>
