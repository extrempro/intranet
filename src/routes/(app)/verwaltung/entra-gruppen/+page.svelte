<script lang="ts">
	import MitFrage from '#lib/components/MitFrage.svelte';
	import { enhance } from '$app/forms';
	import RolleWaehlen from '#lib/components/RolleWaehlen.svelte';

	let { data, form } = $props();
</script>

<svelte:head><title>Rollen aus Entra-Gruppen · Verwaltung · Intranet</title></svelte:head>

<div class="stapel seite">
	<h1>Rollen aus Entra-Gruppen</h1>
	<p class="hinweis">
		Mitglieder der Gruppe bekommen die Rolle bei ihrer nächsten Anmeldung mit Microsoft; verlassen
		sie die Gruppe, verlieren sie die Rolle ebenfalls bei der nächsten Anmeldung. Verschachtelte
		Gruppen zählen mit.
	</p>

	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form?.gespeichert}<p class="meldung" role="status">Gespeichert.</p>{/if}

	{#if data.zuordnungen.length}
		<ul class="liste karte">
			{#each data.zuordnungen as z (z.id)}
				<li>
					<span>
						<strong>{z.groupName ?? z.groupId}</strong> → {z.roleLabel} · {z.scopeText}<br />
						<span class="hinweis mono">{z.groupId}</span>
					</span>
					<MitFrage
						action="?/entfernen"
						enhance
						knopf="Entfernen"
						knopfLabel="Zuordnung {z.groupName ?? z.groupId} entfernen"
						frage={{
							titel: 'Zuordnung entfernen?',
							text: `${z.groupName ?? z.groupId} → ${z.roleLabel}. Mitglieder der Gruppe verlieren die Rolle bei ihrer nächsten Anmeldung.`,
							ja: 'Entfernen',
							gefahr: true
						}}
					>
						{#snippet felder()}<input type="hidden" name="zuordnung" value={z.id} />{/snippet}
					</MitFrage>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="hinweis">Noch keine Zuordnungen.</p>
	{/if}

	<section class="karte stapel" aria-labelledby="h-neu">
		<h2 id="h-neu">Zuordnung hinzufügen</h2>
		<form method="POST" action="?/hinzufuegen" class="felder" use:enhance>
			<label class="feld">
				<span>Objekt-ID der Gruppe</span>
				<input
					name="gruppe"
					required
					pattern="[0-9a-fA-F-]{'{36}'}"
					placeholder="00000000-0000-0000-0000-000000000000"
					autocomplete="off"
				/>
				<span class="hinweis">In Entra unter Gruppen → Übersicht → Objekt-ID.</span>
			</label>
			<label class="feld">
				<span>Name der Gruppe (zur Orientierung)</span>
				<input name="gruppenname" maxlength="120" placeholder="z. B. GRP-INTRANET-REDAKTION" />
			</label>
			<RolleWaehlen rollen={data.rollen} mandanten={data.mandanten} einheiten={data.einheiten} />
			<button class="knopf" type="submit">Hinzufügen</button>
		</form>
	</section>
</div>

<style>
	.seite {
		max-width: 46rem;
	}
	h2 {
		margin: 0;
	}
	.liste {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.liste li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
	}
	.liste li + li {
		border-top: 1px solid var(--bd);
	}
	.mono {
		font-family: ui-monospace, monospace;
		font-size: 0.85rem;
	}
	.knopf {
		justify-self: start;
	}
</style>
