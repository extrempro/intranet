<script lang="ts">
	import { hierBleiben } from '#lib/formular.ts';
	/** Kontaktdaten (Kap. 8.13); auf /konto (Aktionen unter /konto/profil). */
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import Info from '#lib/components/Info.svelte';
	import { MOBILE_VISIBILITY, type ContactErrors } from '#lib/profile.ts';
	import Wahlpillen from './Wahlpillen.svelte';

	interface Profil {
		name: string;
		position: string;
		phone: string;
		mobile: string;
		mobileVisibility: string;
		room: string;
	}
	let {
		profil,
		form = null,
		basis = '/konto/profil'
	}: { profil: Profil; form?: Record<string, unknown> | null; basis?: string } = $props();

	let k = $state(
		untrack(() => ({
			position: profil.position,
			phone: profil.phone,
			mobile: profil.mobile,
			vis: profil.mobileVisibility,
			room: profil.room
		}))
	);
	const f = $derived<ContactErrors>(form && 'felder' in form ? (form.felder as ContactErrors) : {});
	const vorschau = $derived(
		[profil.name, k.position, k.phone && `Tel. ${k.phone}`, k.room && `Raum ${k.room}`]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<form method="POST" action="{basis}?/kontakt" class="kontakt" use:enhance={hierBleiben}>
	<label class="feld">
		<span>Position <span class="optional">(optional)</span></span>
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
	<div class="drei">
		<label class="feld">
			<span>Telefon <span class="optional">(optional)</span></span>
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
		<div class="feld">
			<label class="feld">
				<span>Mobil <span class="optional">(optional)</span></span>
				<input
					name="mobil"
					type="tel"
					maxlength="30"
					autocomplete="tel"
					placeholder="z. B. 0151 …"
					bind:value={k.mobile}
					aria-invalid={f.mobile ? 'true' : undefined}
					aria-describedby={f.mobile ? 'f-mobil' : undefined}
				/>
				{#if f.mobile}<span id="f-mobil" class="feldfehler">{f.mobile}</span>{/if}
			</label>
			<fieldset class="sichtbar">
				<legend>
					Wer sieht die Mobilnummer?
					<Info
						thema="Wer sieht die Mobilnummer?"
						text="Alle: jede Person, die dein Profil sieht. Nur mein Team: Personen aus deinen Abteilungen und Hubs. Niemand: Die Nummer bleibt gespeichert, wird aber nirgends angezeigt, auch nicht in der Suche."
					/>
				</legend>
				<Wahlpillen name="sichtbarkeit" optionen={MOBILE_VISIBILITY} bind:wert={k.vis} />
				{#if f.mobileVisibility}<span class="feldfehler">{f.mobileVisibility}</span>{/if}
			</fieldset>
		</div>
		<label class="feld">
			<span>Raum <span class="optional">(optional)</span></span>
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
	<div class="fuss">
		<span class="vorschau">So erscheinst du: {vorschau}</span>
		<button class="knopf" type="submit">Speichern</button>
	</div>
</form>

<style>
	.kontakt {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.optional {
		font-weight: 400;
		color: var(--mu);
	}
	.feld > span:first-child {
		font-size: 14px;
	}
	.drei {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
		gap: 12px;
		align-items: start;
	}
	input {
		background: var(--bg);
		border-color: var(--bd);
	}
	.sichtbar {
		border: 0;
		margin: 6px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.sichtbar legend {
		font-size: 13px;
		font-weight: 600;
		padding: 0;
		margin-bottom: 6px;
	}
	.sichtbar :global(.pille) {
		min-height: 36px;
		padding: 4px 12px;
		font-size: 14px;
	}
	.fuss {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding-top: 12px;
		border-top: 1px solid var(--bd);
	}
	.vorschau {
		font-size: 13px;
		color: var(--mu);
	}
	.feldfehler {
		color: var(--err-tx);
		font-size: 0.93rem;
		font-weight: 600;
	}
</style>
