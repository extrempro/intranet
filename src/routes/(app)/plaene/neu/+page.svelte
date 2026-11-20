<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	let sendet = $state(false);
</script>

<svelte:head><title>PDF hochladen · Pläne (KBB) · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href="{resolve('/(app)/plaene')}?kbb={data.kbb.unitId}">← Pläne</a>
	<h1>PDF hochladen</h1>
	<p class="hinweis">
		Für {data.kbb.unitName} ({data.kbb.tenantName}). Der Plan ist danach für alle sichtbar, auch für
		andere Mandanten.
	</p>
	<form method="POST" enctype="multipart/form-data" class="felder" onsubmit={() => (sendet = true)}>
		{#if form?.fehler}<p class="meldung fehler" role="alert">{form.fehler}</p>{/if}
		<label class="feld">
			<span>Titel</span>
			<input
				name="titel"
				required
				maxlength="120"
				value={form?.werte?.title ?? ''}
				placeholder="z. B. Wochenplan KW 48"
			/>
		</label>
		<div class="zeile">
			<label class="feld">
				<span>Gültig ab</span>
				<input type="date" name="von" required value={form?.werte?.validFrom ?? ''} />
			</label>
			<label class="feld">
				<span>Gültig bis</span>
				<input type="date" name="bis" required value={form?.werte?.validUntil ?? ''} />
			</label>
		</div>
		<label class="feld">
			<span>PDF-Datei (höchstens 20 MB)</span>
			<input type="file" name="datei" accept=".pdf,application/pdf" required />
			{#if form?.fehler}<span class="hinweis">Wähle die Datei bitte erneut aus.</span>{/if}
		</label>
		<label class="informieren">
			<input type="checkbox" name="informieren" checked />
			<span>
				Über den neuen Plan informieren
				<span class="hinweis">
					Alle im Mandanten des KBB, die „Pläne (KBB)“ in ihren Benachrichtigungen eingeschaltet
					haben.
				</span>
			</span>
		</label>
		<button class="knopf" type="submit" disabled={sendet}>
			{sendet ? 'Wird hochgeladen …' : 'Hochladen'}
		</button>
	</form>
</div>

<style>
	.seite {
		max-width: 40rem;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.zeile {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 14px;
	}
	.knopf {
		justify-self: start;
	}
	.informieren {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		min-height: 44px;
	}
	.informieren input {
		width: 20px;
		height: 20px;
		margin-top: 2px;
		accent-color: var(--fill);
	}
	.informieren > span {
		display: flex;
		flex-direction: column;
	}
</style>
