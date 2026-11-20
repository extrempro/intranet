<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Info from '#lib/components/Info.svelte';
	import PushGeraet from '#lib/components/PushGeraet.svelte';
	import { EMAIL_MODES, TOPICS } from '#lib/notify.ts';

	let { data, form } = $props();
	const e = $derived(data.einstellung);
	const datum = new Intl.DateTimeFormat('de-DE', {
		dateStyle: 'medium',
		timeZone: 'Europe/Berlin'
	});
</script>

<svelte:head><title>Benachrichtigungen · Konto · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/konto')}>← Konto</a>
	<h1>Benachrichtigungen</h1>
	{#if form && 'gespeichert' in form}<p class="meldung" role="status">Gespeichert.</p>{/if}

	<section class="karte stapel" aria-labelledby="h-push">
		<h2 id="h-push">
			Push auf diesem Gerät
			<Info
				thema="Push"
				text="Push zeigt Benachrichtigungen auch an, wenn das Intranet geschlossen ist. Du schaltest Push je Gerät ein, also zum Beispiel am Handy an und am Arbeitsplatz aus. Welche Themen als Push kommen, stellst du unten ein."
			/>
		</h2>
		<PushGeraet vapidKey={data.vapidKey} />
		{#if data.geraete.length}
			<details>
				<summary>Geräte mit Push ({data.geraete.length})</summary>
				<ul class="geraete">
					{#each data.geraete as g (g.id)}
						<li>
							<span>
								<strong>{g.label ?? 'Gerät'}</strong>
								<span class="hinweis">
									· seit {datum.format(g.createdAt)}{g.lastSuccessAt
										? ` · zuletzt zugestellt ${datum.format(g.lastSuccessAt)}`
										: ''}
								</span>
							</span>
							<form method="POST" action="?/geraetEntfernen" use:enhance>
								<input type="hidden" name="id" value={g.id} />
								<button class="linkknopf" type="submit">Entfernen</button>
							</form>
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	</section>

	<form
		method="POST"
		action="?/speichern"
		class="stapel"
		use:enhance={() =>
			({ update }) =>
				update({ reset: false })}
	>
		<section class="karte">
			<table>
				<caption class="sr-only">Benachrichtigungen je Thema</caption>
				<thead>
					<tr>
						<th scope="col">Thema</th>
						<th scope="col">Glocke</th>
						<th scope="col">Push</th>
						<th scope="col">E-Mail</th>
						{#if data.teams}<th scope="col">Teams</th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each TOPICS.filter((x) => data.themen.includes(x.key)) as t (t.key)}
						<tr>
							<th scope="row">
								{t.label}
								{#if t.hint}<span class="hinweis">({t.hint})</span>{/if}
							</th>
							<td>
								<input
									type="checkbox"
									name="{t.key}_glocke"
									checked={e.topics[t.key].bell}
									disabled={t.fixed?.includes('bell')}
									aria-label="{t.label}: Glocke{t.fixed?.includes('bell') ? ' (immer an)' : ''}"
								/>
							</td>
							<td>
								<input
									type="checkbox"
									name="{t.key}_push"
									checked={e.topics[t.key].push}
									disabled={t.fixed?.includes('push')}
									aria-label="{t.label}: Push{t.fixed?.includes('push') ? ' (immer an)' : ''}"
								/>
								{#if t.fixed?.includes('push')}<input
										type="hidden"
										name="{t.key}_push"
										value="on"
									/>{/if}
							</td>
							<td>
								<input
									type="checkbox"
									name="{t.key}_mail"
									checked={e.topics[t.key].email}
									aria-label="{t.label}: E-Mail"
								/>
							</td>
							{#if data.teams}
								<td>
									{#if t.teams !== undefined}
										<input
											type="checkbox"
											name="{t.key}_teams"
											checked={e.topics[t.key].teams}
											aria-label="{t.label}: Teams"
										/>
									{:else}
										<span class="hinweis" title="Für dieses Thema nicht verfügbar">–</span>
									{/if}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="hinweis">
				Dringende Meldungen erscheinen immer in der Glocke und als Push. Push kommt nur auf Geräten
				an, auf denen du ihn oben eingeschaltet hast. Hubs stellst du unter „Meine Hubs“ ein.
				{#if data.teams}Teams-Meldungen erscheinen in Teams unter „Aktivität“.{/if}
			</p>
		</section>

		<fieldset class="karte modus">
			<legend>
				Ruhezeiten
				<Info
					thema="Ruhezeiten"
					text="Die Zeiten gelten in deutscher Zeit, auch wenn dein Gerät anders eingestellt ist. Über Mitternacht geht, zum Beispiel 20 bis 7 Uhr. Dringende Meldungen kommen trotzdem sofort, wenn du das unten nicht ausschaltest."
				/>
			</legend>
			<p class="hinweis">
				In Ruhezeiten kommen keine Push-Nachrichten; danach gesammelt als eine Nachricht. Glocke und
				E-Mail sind nicht betroffen.
			</p>
			<label class="option">
				<input type="checkbox" name="ruhe" checked={e.quiet.on} />
				<span>Ruhezeiten einhalten</span>
			</label>
			<div class="zeiten">
				<label class="feld">
					<span>Werktags von</span>
					<input type="time" name="ruhe_von" value={e.quiet.start} required />
				</label>
				<label class="feld">
					<span>bis</span>
					<input type="time" name="ruhe_bis" value={e.quiet.end} required />
				</label>
			</div>
			<label class="option">
				<input type="checkbox" name="ruhe_wochenende" checked={e.quiet.weekend} />
				<span>Samstag und Sonntag ganztägig</span>
			</label>
			<label class="option">
				<input type="checkbox" name="ruhe_dringend" checked={e.quiet.urgent} />
				<span>Dringende Meldungen trotzdem sofort</span>
			</label>
		</fieldset>

		<fieldset class="karte modus">
			<legend>E-Mails</legend>
			{#each EMAIL_MODES as m (m.key)}
				<label class="option">
					<input type="radio" name="modus" value={m.key} checked={e.emailMode === m.key} />
					<span><strong>{m.label}</strong> <span class="hinweis">· {m.hint}</span></span>
				</label>
			{/each}
			{#if !data.mailBereit}
				<p class="hinweis">
					Der E-Mail-Versand ist noch nicht eingerichtet. Deine Auswahl gilt, sobald er läuft.
				</p>
			{/if}
		</fieldset>

		<div><button class="knopf" type="submit">Speichern</button></div>
	</form>
</div>

<style>
	.schmal {
		max-width: 720px;
	}
	h1,
	h2 {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	.geraete {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		display: grid;
	}
	.geraete li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 4px 12px;
		padding: 6px 0;
		border-top: 1px solid var(--bd);
	}
	summary {
		cursor: pointer;
		min-height: 44px;
		display: flex;
		align-items: center;
	}
	.zeiten {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		padding: 10px 6px;
		border-bottom: 1px solid var(--bd);
		text-align: center;
	}
	th[scope='row'],
	thead th:first-child {
		text-align: left;
		font-weight: 600;
	}
	thead th {
		font-size: 13px;
		color: var(--mu);
	}
	td input {
		width: 22px;
		height: 22px;
		accent-color: var(--fill);
	}
	.modus {
		border: 1px solid var(--bd);
		display: grid;
		gap: 4px;
	}
	/* Überschrift innerhalb der Karte, damit die „i“-Erläuterung nicht auf dem Rahmen liegt */
	.modus legend {
		float: left;
		width: 100%;
		padding: 0;
		margin-bottom: 4px;
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
</style>
