<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve -- Dateilinks unter /dateien (Endpunkt ohne Seitenroute) */
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/Icon.svelte';
	import LinkKopieren from '#lib/components/LinkKopieren.svelte';
	import { formatIsoDate, formatSize } from '#lib/format.ts';
	import { AGREEMENT_KINDS } from '#lib/legal.ts';

	let { data } = $props();
	const v = $derived(data.v);
	const art = $derived(AGREEMENT_KINDS.find((k) => k.key === v.kind)?.single ?? '');
	const heute = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
	const kuenftig = $derived(v.validFrom > heute);
	const LADEN = 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2M7 11l5 5l5 -5M12 4l0 12';
</script>

<svelte:head><title>{v.title} · Rechtliches · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/rechtliches')}>← Rechtliches</a>
	<div class="stapel eng">
		<div>
			<span class={['schild', kuenftig && 'warn']}>
				{kuenftig ? `Gilt ab ${formatIsoDate(v.validFrom)}` : 'Gültig'}
			</span>
		</div>
		<div class="titelzeile">
			<h1>{v.title}</h1>
			<LinkKopieren />
		</div>
		<p class="art">{art}{data.mandant ? ` · ${data.mandant}` : ''}</p>
	</div>

	<dl class="kacheln">
		<div>
			<dt>Gilt ab</dt>
			<dd>{formatIsoDate(v.validFrom)}</dd>
		</div>
		<div>
			<dt>Stand</dt>
			<dd>{formatIsoDate(v.versionDate)}</dd>
		</div>
		<div>
			<dt>Dokumente</dt>
			<dd>{v.attachments.length}</dd>
		</div>
	</dl>

	{#if v.description}<p class="text">{v.description}</p>{/if}

	<section class="karte" aria-labelledby="h-dok">
		<h2 id="h-dok">Dokumente</h2>
		<ul class="dateien">
			{#each v.attachments as a, i (a.id)}
				<li>
					<span class="pdf" aria-hidden="true">{a.kind.toUpperCase().slice(0, 4)}</span>
					<span class="datei">
						<span class="rolle">{i === 0 ? 'Hauptdokument' : `Anlage ${i}`}</span>
						<strong>{a.name}</strong>
						<span class="hinweis">{formatSize(a.size)}</span>
					</span>
					<a class="knopf zweit klein" href="/dateien/{a.id}" target="_blank" rel="noopener">
						Öffnen<span class="sr-only">: {a.name}</span>
					</a>
					<a
						class="rund"
						href="/dateien/{a.id}?download"
						download
						aria-label="{a.name} herunterladen"
						title="Herunterladen"
					>
						<Icon d={LADEN} size={16} stroke={2} />
					</a>
				</li>
			{/each}
		</ul>
	</section>

	{#if v.canWrite}
		<div>
			<a class="knopf zweit" href={resolve('/(app)/rechtliches/[id]/bearbeiten', { id: v.id })}>
				Neue Fassung einstellen
			</a>
		</div>
	{/if}
	<p class="hinweis">
		Der Link führt immer auf die aktuelle Fassung. Frühere Fassungen werden nicht aufbewahrt.
	</p>
</div>

<style>
	.seite {
		max-width: 820px;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
	}
	.eng {
		gap: 6px;
	}
	.titelzeile {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	h1 {
		margin: 0;
		font-size: 28px;
		line-height: 1.25;
	}
	h2 {
		margin: 0 0 6px;
		font-size: 18px;
	}
	.art {
		margin: 0;
		color: var(--mu);
		font-size: 14px;
	}
	.schild.warn {
		background: var(--warn-bg);
		color: var(--warn-tx);
	}
	.kacheln {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(140px, 100%), 1fr));
		gap: 10px;
		margin: 0;
	}
	.kacheln div {
		padding: 10px 14px;
		border-radius: 12px;
		background: var(--tint);
	}
	dt {
		font-size: 12px;
		font-weight: 700;
		color: var(--ac);
	}
	dd {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
	}
	.text {
		margin: 0;
		white-space: pre-line;
	}
	.dateien {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.dateien li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
		border-top: 1px solid var(--bd);
	}
	.pdf {
		flex: none;
		width: 34px;
		height: 40px;
		border-radius: 6px;
		border: 1px solid var(--bd);
		background: var(--bg);
		color: var(--err-tx);
		font-size: 10px;
		font-weight: 700;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 4px;
		box-sizing: border-box;
	}
	.datei {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow-wrap: anywhere;
	}
	.rolle {
		font-size: 12px;
		font-weight: 700;
		color: var(--ac);
	}
	.klein {
		min-height: 36px;
		padding: 6px 12px;
		font-size: 13px;
	}
	.rund {
		flex: none;
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--bd);
		border-radius: 999px;
		color: var(--tx);
	}
</style>
