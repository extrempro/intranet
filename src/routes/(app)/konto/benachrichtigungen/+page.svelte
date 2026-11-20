<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { EMAIL_MODES, TOPICS } from '#lib/notify.ts';

	let { data, form } = $props();
	const e = $derived(data.einstellung);
</script>

<svelte:head><title>Benachrichtigungen · Konto · Intranet</title></svelte:head>

<div class="stapel schmal">
	<a class="zurueck" href={resolve('/(app)/konto')}>← Konto</a>
	<h1>Benachrichtigungen</h1>
	{#if form?.gespeichert}<p class="meldung" role="status">Gespeichert.</p>{/if}

	<form
		method="POST"
		class="stapel"
		use:enhance={() =>
			({ update }) =>
				update({ reset: false })}
	>
		<section class="karte">
			<table>
				<caption class="sr-only">Benachrichtigungen je Thema</caption>
				<thead>
					<tr><th scope="col">Thema</th><th scope="col">Glocke</th><th scope="col">E-Mail</th></tr>
				</thead>
				<tbody>
					{#each TOPICS as t (t.key)}
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
									name="{t.key}_mail"
									checked={e.topics[t.key].email}
									aria-label="{t.label}: E-Mail"
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="hinweis">
				Dringende Meldungen erscheinen immer in der Glocke. Web Push und Teams kommen mit der App
				fürs Handy dazu.
			</p>
		</section>

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
	h1 {
		margin: 0;
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
	.modus legend {
		padding: 0 6px;
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
