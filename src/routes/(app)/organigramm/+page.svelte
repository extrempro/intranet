<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PdfAnsicht from '#lib/components/PdfAnsicht.svelte';
	import { formatMonth } from '#lib/plans.ts';

	let { data, form } = $props();
	let hochladen = $state(false);
	const o = $derived(data.organigramm);
</script>

<svelte:head><title>Organigramm · Intranet</title></svelte:head>

<div class="stapel">
	<div class="kopfzeile">
		<div class="titel">
			<h1>Organigramm</h1>
			<form method="POST" action="?/favorit" use:enhance>
				<button
					class="stern"
					type="submit"
					aria-pressed={data.favorit}
					aria-label={data.favorit ? 'Aus den Favoriten entfernen' : 'Zu den Favoriten hinzufügen'}
				>
					{data.favorit ? '★' : '☆'}
				</button>
			</form>
		</div>
		{#if data.darfPflegen && !hochladen}
			<button class="knopf" type="button" onclick={() => (hochladen = true)}>
				Neue Fassung hochladen
			</button>
		{/if}
	</div>

	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form?.gespeichert}<p class="meldung" role="status">Neue Fassung veröffentlicht.</p>{/if}

	{#if hochladen}
		<form
			method="POST"
			action="?/hochladen"
			enctype="multipart/form-data"
			class="karte felder"
			use:enhance={() =>
				async ({ update, result }) => {
					await update();
					if (result.type === 'success') hochladen = false;
				}}
		>
			<label class="feld">
				<span>Stand (Monat)</span>
				<input type="month" name="stand" required />
			</label>
			<label class="feld">
				<span>PDF-Datei (höchstens 20 MB)</span>
				<input type="file" name="datei" accept=".pdf,application/pdf" required />
				<span class="hinweis">Gilt für alle Mandanten und ersetzt die bisherige Fassung.</span>
			</label>
			<div class="aktionen">
				<button class="knopf" type="submit">Veröffentlichen</button>
				<button class="knopf zweit" type="button" onclick={() => (hochladen = false)}>
					Abbrechen
				</button>
			</div>
		</form>
	{/if}

	{#if o}
		<p class="hinweis">Stand: {formatMonth(o.stand)}</p>
		{#key o.fileId}
			<PdfAnsicht
				src={resolve('/(app)/dateien/[id]', { id: o.fileId })}
				titel="Organigramm, Stand {formatMonth(o.stand)}"
				download="{resolve('/(app)/dateien/[id]', { id: o.fileId })}?download"
			/>
		{/key}
	{:else}
		<p class="hinweis" role="status">Es ist noch kein Organigramm hochgeladen.</p>
	{/if}
</div>

<style>
	h1 {
		margin: 0;
	}
	.kopfzeile {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
	}
	.titel {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.stern {
		width: 44px;
		height: 44px;
		border: 0;
		background: transparent;
		color: var(--ac);
		font-size: 24px;
		cursor: pointer;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
</style>
