<script lang="ts">
	/** Felder für ein neues Passwort mit Stärkeanzeige (Einladung, Zurücksetzen). */
	import { passwordStrength, STRENGTH_LABELS } from '#lib/password.ts';

	let { min, email }: { min: number; email: string } = $props();
	let passwort = $state('');
	const staerke = $derived(passwordStrength(passwort, min));
</script>

<!-- Für Passwortmanager: welches Konto -->
<input type="hidden" name="email" autocomplete="username" value={email} />
<label class="feld">
	<span>Neues Passwort</span>
	<input
		name="passwort"
		type="password"
		autocomplete="new-password"
		minlength={min}
		maxlength="128"
		required
		bind:value={passwort}
		aria-describedby="regeln staerke"
	/>
</label>
<p id="regeln" class="hinweis">
	Mindestens {min} Zeichen. Leerzeichen sind erlaubt – ein ganzer Satz ist ideal. Einfügen aus dem Passwortmanager
	geht auch.
</p>
<div id="staerke" class="staerke" aria-live="polite">
	<meter min="0" max="4" low="2" high="3" optimum="4" value={staerke}></meter>
	Stärke: {STRENGTH_LABELS[staerke]}
</div>
<label class="feld">
	<span>Passwort wiederholen</span>
	<input name="wiederholung" type="password" autocomplete="new-password" maxlength="128" required />
</label>
