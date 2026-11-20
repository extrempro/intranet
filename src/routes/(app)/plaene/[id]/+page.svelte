<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PdfAnsicht from '#lib/components/PdfAnsicht.svelte';
	import { formatRange, planState } from '#lib/plans.ts';

	let { data, form } = $props();
	const pl = $derived(data.plan);
	const datei = $derived(resolve('/(app)/dateien/[id]', { id: pl.fileId }));
	let bearbeiten = $state(false);
	let loeschenFragen = $state(false);
</script>

<svelte:head><title>{pl.title} · Pläne (KBB) · Intranet</title></svelte:head>

<div class="stapel">
	<a class="zurueck" href="{resolve('/(app)/plaene')}?kbb={pl.unitId}">← Pläne {pl.kbb.unitName}</a>
	<div>
		<h1>{pl.title}</h1>
		<p class="hinweis">
			{pl.kbb.unitName} ({pl.kbb.tenantName}) · gültig {formatRange(pl.validFrom, pl.validUntil)}
			{#if planState(pl, data.heute) === 'abgelaufen'}
				· <span class="schild rand">abgelaufen</span>{/if}
		</p>
	</div>

	{#if pl.neuer}
		<p class="meldung">
			Es gibt einen neueren Plan:
			<a href={resolve('/(app)/plaene/[id]', { id: pl.neuer.id })}>{pl.neuer.title}</a>
		</p>
	{/if}
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form?.gespeichert}<p class="meldung" role="status">Neue Fassung gespeichert.</p>{/if}

	{#key pl.fileId}
		<PdfAnsicht src={datei} titel={pl.title} download="{datei}?download" />
	{/key}

	<nav class="blaettern" aria-label="Weitere Pläne dieses KBB">
		{#if pl.vorher}<a href={resolve('/(app)/plaene/[id]', { id: pl.vorher.id })}>
				‹ {pl.vorher.title}
			</a>{:else}<span></span>{/if}
		{#if pl.nachher}<a href={resolve('/(app)/plaene/[id]', { id: pl.nachher.id })}>
				{pl.nachher.title} ›
			</a>{/if}
	</nav>

	{#if pl.darfPflegen}
		<section class="karte stapel" aria-label="Plan pflegen">
			{#if bearbeiten}
				<form
					method="POST"
					action="?/ersetzen"
					enctype="multipart/form-data"
					class="felder"
					use:enhance={() =>
						async ({ update, result }) => {
							await update({ reset: false });
							if (result.type === 'success') bearbeiten = false;
						}}
				>
					<label class="feld">
						<span>Titel</span><input name="titel" required maxlength="120" value={pl.title} />
					</label>
					<div class="zeile">
						<label class="feld">
							<span>Gültig ab</span><input type="date" name="von" required value={pl.validFrom} />
						</label>
						<label class="feld">
							<span>Gültig bis</span><input type="date" name="bis" required value={pl.validUntil} />
						</label>
					</div>
					<label class="feld">
						<span>Neue Fassung (PDF, optional)</span>
						<input type="file" name="datei" accept=".pdf,application/pdf" />
						<span class="hinweis">Die bisherige Datei wird ersetzt und gelöscht.</span>
					</label>
					<label class="informieren">
						<input type="checkbox" name="informieren" />
						Über die neue Fassung informieren (nur wenn eine neue Datei hochgeladen wird)
					</label>
					<div class="aktionen">
						<button class="knopf" type="submit">Speichern</button>
						<button class="knopf zweit" type="button" onclick={() => (bearbeiten = false)}>
							Abbrechen
						</button>
					</div>
				</form>
			{:else if loeschenFragen}
				<form method="POST" action="?/loeschen" class="aktionen">
					<span>
						„{pl.title}“ endgültig löschen? Der Plan verschwindet für alle, auch für andere
						Mandanten.
					</span>
					<button class="knopf rot" type="submit">Ja, löschen</button>
					<button class="knopf zweit" type="button" onclick={() => (loeschenFragen = false)}>
						Abbrechen
					</button>
				</form>
			{:else}
				<div class="aktionen">
					<button class="knopf zweit" type="button" onclick={() => (bearbeiten = true)}>
						Neue Fassung hochladen
					</button>
					<button class="linkknopf" type="button" onclick={() => (loeschenFragen = true)}>
						Löschen
					</button>
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	h1 {
		margin: 0;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.blaettern {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}
	.blaettern a {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.zeile {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 14px;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.rot {
		background: #b42318;
		border-color: #b42318;
	}
	.informieren {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
	}
	.informieren input {
		width: 20px;
		height: 20px;
		accent-color: var(--fill);
	}
</style>
