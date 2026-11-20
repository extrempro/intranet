<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- nur Suchparameter der eigenen Seite */
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeZone: 'Europe/Berlin'
	});
	const STATUS: Record<string, string> = {
		neu: 'Neu – bei der Redaktion',
		bei_verwaltung: 'Bei der Verwaltung',
		angelegt: 'Angelegt',
		abgelehnt: 'Abgelehnt',
		geschlossen: 'Geschlossen'
	};
	let ablehnen = $state<string | null>(null);
</script>

<svelte:head><title>Hub-Anträge · Intranet</title></svelte:head>

<div class="stapel">
	<a class="zurueck" href={resolve('/(app)/hubs')}>← Hubs</a>
	<h1>Hub-Anträge</h1>
	{#if data.gesendet}
		<p class="meldung" role="status">
			Danke! Dein Antrag ist eingegangen. Rückfragen kommen als Nachricht.
		</p>
	{/if}
	{#if form && 'fehler' in form}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form && 'ok' in form}<p class="meldung" role="status">{form.ok}</p>{/if}

	{#if data.meine.length}
		<section class="karte" aria-labelledby="h-meine">
			<h2 id="h-meine">Meine Anträge</h2>
			<ul class="liste">
				{#each data.meine as a (a.id)}
					<li>
						<strong>{a.name}</strong>
						<span class="hinweis">
							{STATUS[a.status]} · gestellt am {datum.format(a.createdAt)}{a.decisionReason
								? ` · ${a.decisionReason}`
								: ''}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.pruefen}
		<h2>Zu prüfen</h2>
		<p class="hinweis">
			Die Redaktion prüft vor (Rückfrage oder „An Verwaltung geben“). Die Verwaltung legt an oder
			lehnt mit Begründung ab, jederzeit auch ohne Vorprüfung.
		</p>
		<nav class="pillen" aria-label="Status">
			<a class="pille" href="?" aria-current={!data.erledigt ? 'true' : undefined}>Offen</a>
			<a class="pille" href="?status=erledigt" aria-current={data.erledigt ? 'true' : undefined}>
				Erledigt
			</a>
		</nav>
		{#each data.antraege as a (a.id)}
			<article class="karte stapel antrag">
				<div class="schilder">
					<span class="schild">{STATUS[a.status]}</span>
					<span class="schild rand">{a.central ? 'Alle Mandanten' : a.tenantShort}</span>
				</div>
				<h3>{a.name}</h3>
				<dl>
					<dt>Beschreibung</dt>
					<dd>{a.description}</dd>
					<dt>Begründung</dt>
					<dd>{a.reason}</dd>
					<dt>Hub-Team</dt>
					<dd>{a.team.join(', ')}</dd>
					<dt>Beantragt</dt>
					<dd>{a.applicant}, {datum.format(a.createdAt)}</dd>
				</dl>
				{#each a.conversations as c (c.id)}
					<a href={resolve('/(app)/nachrichten/[id]', { id: c.id })}>
						Gespräch der {c.roleBox === 'verwaltung' ? 'Verwaltung' : 'Redaktion'}{c.closedAt
							? ' (geschlossen)'
							: ''}
					</a>
				{/each}
				{#if !data.erledigt}
					{#if ablehnen === a.id}
						<form method="POST" action="?/ablehnen" class="felder" use:enhance>
							<input type="hidden" name="id" value={a.id} />
							<label class="feld">
								<span>Begründung für die Person</span>
								<textarea name="begruendung" rows="2" required maxlength="1000"></textarea>
							</label>
							<div class="aktionen">
								<button class="knopf rot" type="submit">Ablehnen</button>
								<button class="knopf zweit" type="button" onclick={() => (ablehnen = null)}>
									Abbrechen
								</button>
							</div>
						</form>
					{:else}
						<div class="aktionen">
							{#each a.roles as rolle (rolle)}
								<form method="POST" action="?/rueckfrage">
									<input type="hidden" name="id" value={a.id} />
									<input type="hidden" name="rolle" value={rolle} />
									<button class="knopf zweit" type="submit">
										Rückfrage{a.roles.length > 1
											? ` (${rolle === 'redaktion' ? 'Redaktion' : 'Verwaltung'})`
											: ''}
									</button>
								</form>
							{/each}
							{#if a.roles.includes('redaktion') && a.status === 'neu'}
								<form method="POST" action="?/weitergeben" use:enhance>
									<input type="hidden" name="id" value={a.id} />
									<button class="knopf zweit" type="submit">An Verwaltung geben</button>
								</form>
							{/if}
							{#if a.roles.includes('verwaltung')}
								<form method="POST" action="?/anlegen">
									<input type="hidden" name="id" value={a.id} />
									<button class="knopf" type="submit">Hub anlegen</button>
								</form>
								<button
									class="knopf zweit rotschrift"
									type="button"
									onclick={() => (ablehnen = a.id)}
								>
									Ablehnen
								</button>
							{/if}
						</div>
					{/if}
				{/if}
			</article>
		{:else}
			<p class="karte hinweis">Keine Anträge.</p>
		{/each}
	{/if}
</div>

<style>
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
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
		font-size: 1.1rem;
	}
	.liste {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.liste li {
		display: flex;
		flex-direction: column;
	}
	.pillen,
	.aktionen,
	.schilder {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.pille {
		display: inline-flex;
		align-items: center;
		min-height: 40px;
		padding: 0 16px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		text-decoration: none;
		font-weight: 600;
	}
	.pille[aria-current='true'] {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
	}
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 4px 14px;
		margin: 0;
	}
	dt {
		font-weight: 600;
	}
	dd {
		margin: 0;
		white-space: pre-line;
	}
	.rot {
		background: #b42318;
		border-color: #b42318;
	}
	.rotschrift {
		color: #b42318;
	}
</style>
