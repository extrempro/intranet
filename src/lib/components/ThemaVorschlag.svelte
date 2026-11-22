<script lang="ts">
	/** „Thema fehlt?“: Vorschlag an die System-Admins (Kap. 8.15), außerhalb anderer Formulare einsetzen. */
	let offen = $state(false);
	let name = $state('');
	let meldung = $state('');
	let fehler = $state('');
	let laeuft = $state(false);

	async function senden(e: SubmitEvent) {
		e.preventDefault();
		laeuft = true;
		fehler = meldung = '';
		try {
			const r = await fetch('/themen/vorschlagen', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ name })
			});
			const d = (await r.json().catch(() => ({}))) as {
				ok?: boolean;
				name?: string;
				fehler?: string;
			};
			if (d.ok) {
				meldung = `Danke! „${d.name}“ ist vorgeschlagen. Du bekommst Bescheid, sobald entschieden ist.`;
				name = '';
				offen = false;
			} else fehler = d.fehler ?? 'Das hat nicht geklappt. Versuch es bitte noch einmal.';
		} catch {
			fehler = 'Keine Verbindung. Versuch es bitte noch einmal.';
		} finally {
			laeuft = false;
		}
	}
</script>

<div class="stapel eng">
	<div>
		<button class="linkknopf" type="button" onclick={() => (offen = !offen)} aria-expanded={offen}>
			Thema fehlt? Vorschlagen
		</button>
	</div>
	{#if offen}
		<form class="reihe" onsubmit={senden}>
			<label class="feld">
				<span>Neues Thema</span>
				<input bind:value={name} required maxlength="60" />
			</label>
			<button class="knopf zweit" type="submit" disabled={laeuft}>Vorschlagen</button>
		</form>
	{/if}
	{#if meldung}<p class="meldung" role="status">{meldung}</p>{/if}
	{#if fehler}<p class="meldung fehler" role="alert">{fehler}</p>{/if}
</div>

<style>
	.eng {
		gap: 6px;
	}
	p {
		margin: 0;
	}
	.reihe {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: flex-end;
	}
</style>
