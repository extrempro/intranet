<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	const s = $derived(data.standort);
	const STATUS = { active: 'aktiv', invited: 'eingeladen', disabled: 'gesperrt' } as const;
	const zeit = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'Europe/Berlin'
	});
</script>

<svelte:head><title>{s.name} · Standorte · Verwaltung · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/verwaltung/standorte')}>← Standorte</a>
	<h1>{s.name}</h1>
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}

	<form
		method="POST"
		action="?/speichern"
		class="karte felder"
		use:enhance={() =>
			({ update }) =>
				update({ reset: false })}
	>
		<h2>Standort</h2>
		{#if form && 'gespeichert' in form}<p class="meldung" role="status">Gespeichert.</p>{/if}
		<p class="hinweis">Mandant: {s.tenantName}</p>
		<label class="feld">
			<span>Name</span><input name="name" required maxlength="80" value={s.name} />
		</label>
		<label class="feld">
			<span>Adresse, Gebäude</span><input name="adresse" maxlength="200" value={s.address ?? ''} />
		</label>
		<label class="schalter">
			<input type="checkbox" role="switch" name="aktiv" checked={s.active} /> Aktiv
		</label>
		<p class="hinweis">
			Ein deaktivierter Standort erscheint nirgends mehr; seine Betreiber werden abgemeldet.
		</p>
		<button class="knopf" type="submit">Speichern</button>
	</form>

	<section class="karte stapel" aria-labelledby="h-betreiber">
		<h2 id="h-betreiber">Betreiber-Konten</h2>
		<p class="hinweis">
			Lokale Konten für die Kantine. Sie sehen nur Speiseplan, Öffnungs- und Schließzeiten dieses
			Standorts und erscheinen nicht in der Benutzerliste.
		</p>
		{#if s.operators.length}
			<ul class="liste">
				{#each s.operators as o (o.id)}
					<li>
						<span class="wer">
							<strong>{o.name}</strong>
							<span class="hinweis">
								{o.email} · {STATUS[o.status]}{#if o.lastLoginAt}
									{' '}· zuletzt angemeldet {zeit.format(o.lastLoginAt)}{/if}
							</span>
						</span>
						<form method="POST" action={o.status === 'disabled' ? '?/freigeben' : '?/sperren'}>
							<input type="hidden" name="person" value={o.id} />
							<button class="knopf zweit" type="submit">
								{o.status === 'disabled' ? 'Freigeben' : 'Sperren'}
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}

		<form method="POST" action="?/einladen" class="felder einladen">
			<h3>Betreiber-Konto einladen</h3>
			{#if !data.mailBereit}
				<p class="meldung fehler">
					Der E-Mail-Versand ist noch nicht eingerichtet (Verwaltung → Benachrichtigungen → E-Mail).
					Einladungen können nicht verschickt werden.
				</p>
			{/if}
			{#if form && 'eingeladen' in form}
				<p class="meldung" role="status">Einladung an {form.eingeladen} verschickt.</p>
			{/if}
			{#if form && 'einladeFehler' in form}
				<p class="meldung fehler" role="alert">{form.einladeFehler}</p>
			{/if}
			<div class="zeile">
				<label class="feld">
					<span>Name</span>
					<input
						name="name"
						required
						maxlength="200"
						value={form && 'einladung' in form ? form.einladung?.name : ''}
						placeholder="z. B. Kantinenteam Muster GmbH"
					/>
				</label>
				<label class="feld">
					<span>E-Mail-Adresse</span>
					<input
						name="email"
						type="email"
						required
						maxlength="320"
						value={form && 'einladung' in form ? form.einladung?.email : ''}
					/>
				</label>
			</div>
			<p class="hinweis">
				Die Adresse darf eine externe Domain haben. Erneut einladen geht, solange die Einladung
				nicht angenommen ist.
			</p>
			<button class="knopf" type="submit">Einladen</button>
		</form>
	</section>
</div>

<style>
	.schmal {
		max-width: 820px;
	}
	h1,
	h2,
	h3 {
		margin: 0;
	}
	h2 {
		font-size: 1.15rem;
	}
	h3 {
		font-size: 1rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.schalter {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
	}
	.schalter input {
		width: 20px;
		height: 20px;
		accent-color: var(--fill);
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.liste li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 8px 12px;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.wer {
		display: flex;
		flex-direction: column;
	}
	.einladen {
		border-top: 1px solid var(--bd);
		padding-top: 14px;
	}
	.zeile {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
		gap: 14px;
	}
</style>
