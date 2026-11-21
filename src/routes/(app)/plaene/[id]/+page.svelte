<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import Info from '#lib/components/Info.svelte';
	import LinkKopieren from '#lib/components/LinkKopieren.svelte';
	import OfflinePlan from '#lib/components/OfflinePlan.svelte';
	import PdfAnsicht from '#lib/components/PdfAnsicht.svelte';
	import { formatRange, planState } from '#lib/plans.ts';
	import MitFrage from '#lib/components/MitFrage.svelte';

	let { data, form } = $props();
	const pl = $derived(data.plan);
	const datei = $derived(resolve('/(app)/dateien/[id]', { id: pl.fileId }));
	let bearbeiten = $state(false);
	const LADEN = 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2M7 11l5 5l5 -5M12 4l0 12';
	const DRUCKER =
		'M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2M17 9v-4a2 2 0 0 0 -2 -2h-6a2 2 0 0 0 -2 2v4M7 13m0 2a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z';
</script>

<svelte:head><title>{pl.title} · Pläne (KBB) · Intranet</title></svelte:head>

<div class="stapel">
	<a class="zurueck" href="{resolve('/(app)/plaene')}?kbb={pl.unitId}">← Pläne {pl.kbb.unitName}</a>
	<div class="stapel eng">
		<h1>{pl.title}</h1>
		<p class="hinweis">
			{pl.kbb.unitName} ({pl.kbb.tenantName}) · gültig {formatRange(pl.validFrom, pl.validUntil)}
			{#if planState(pl, data.heute) === 'abgelaufen'}
				{' '}· <span class="schild rand">abgelaufen</span>{/if}
		</p>
		<div class="werkzeuge">
			<a class="knopf zweit klein mit-symbol" href="{datei}?download" download>
				<Icon d={LADEN} size={16} stroke={2} />Herunterladen
			</a>
			<!-- Drucken über den PDF-Betrachter des Browsers: zuverlässiger als ein Druck aus der Seite -->
			<a
				class="knopf zweit klein mit-symbol"
				href={datei}
				target="_blank"
				rel="noopener"
				title="Öffnet das PDF in einem neuen Tab, dort drucken"
			>
				<Icon d={DRUCKER} size={16} stroke={2} />Drucken<span class="sr-only">
					(öffnet das PDF in einem neuen Tab)
				</span>
			</a>
			<OfflinePlan
				plan={{
					id: pl.id,
					fileId: pl.fileId,
					title: pl.title,
					kbb: pl.kbb.unitName,
					validUntil: pl.validUntil
				}}
			/>
			<Info
				thema="Offline speichern"
				text="Der Plan wird nur nach Anmeldung angezeigt. Auf dem Gerät gespeichert wird er nur, wenn du „Offline speichern“ wählst."
			/>
			<LinkKopieren />
		</div>
	</div>

	{#if pl.neuer}
		<p class="meldung">
			Es gibt einen neueren Plan:
			<a href={resolve('/(app)/plaene/[id]', { id: pl.neuer.id })}>{pl.neuer.title}</a>
		</p>
	{/if}
	{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
	{#if form?.gespeichert}<p class="meldung" role="status">Neue Fassung gespeichert.</p>{/if}

	{#if pl.darfPflegen}
		<section class="pflege" aria-label="Plan pflegen">
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
			{:else}
				<div class="aktionen">
					<span class="hinweis schieben">Nur für die Fachpflege des KBB sichtbar</span>
					<button class="knopf zweit klein" type="button" onclick={() => (bearbeiten = true)}>
						Neue Fassung hochladen
					</button>
					<MitFrage
						action="?/loeschen"
						frage={{
							titel: `„${pl.title}“ löschen?`,
							text: 'Der Plan verschwindet endgültig für alle, auch für andere Mandanten.',
							ja: 'Löschen',
							gefahr: true
						}}
					>
						{#snippet ausloeser(klick: () => void)}
							<button class="knopf zweit klein rotschrift" type="button" onclick={klick}>
								Löschen
							</button>
						{/snippet}
					</MitFrage>
				</div>
			{/if}
		</section>
	{/if}
	{#key pl.fileId}
		<PdfAnsicht src={datei} titel={pl.title} />
	{/key}

	<nav class="blaettern" aria-label="Weitere Pläne dieses KBB">
		{#if pl.vorher}<a
				class="knopf zweit klein"
				href={resolve('/(app)/plaene/[id]', { id: pl.vorher.id })}
			>
				‹ {pl.vorher.title}
			</a>{:else}<span></span>{/if}
		{#if pl.nachher}<a
				class="knopf zweit klein"
				href={resolve('/(app)/plaene/[id]', { id: pl.nachher.id })}
			>
				{pl.nachher.title} ›
			</a>{/if}
	</nav>
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
	.eng {
		gap: 6px;
	}
	.werkzeuge {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 6px;
	}
	.mit-symbol {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}
	.klein {
		min-height: 38px;
		padding: 6px 14px;
		font-size: 14px;
	}
	.pflege {
		padding: 10px 14px;
		border: 1px dashed var(--bd);
		border-radius: 14px;
		background: var(--sf);
	}
	.schieben {
		margin-right: auto;
		font-size: 14px;
	}
	.zeile {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
		gap: 14px;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
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
