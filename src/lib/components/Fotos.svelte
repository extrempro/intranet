<script lang="ts">
	/** Bis zu drei Fotos für eine Anzeige; einzeln hochgeladen, das Formular schickt die IDs. */
	import { resolve } from '$app/paths';
	import { BESCHREIBUNG_MAX, beschreibungFeld } from '#lib/bildbeschreibung.ts';

	let { max = 3, fehler }: { max?: number; fehler?: string } = $props();

	let liste = $state<{ id: string; name: string; beschreibung: string }[]>([]);
	let laufend = $state(0);
	let meldungen = $state<string[]>([]);
	let eingabe: HTMLInputElement | undefined = $state();

	async function hochladen(dateien: FileList | null) {
		if (!dateien) return;
		meldungen = [];
		for (const datei of Array.from(dateien)) {
			if (liste.length + laufend >= max) {
				meldungen.push(`Höchstens ${max} Fotos.`);
				break;
			}
			if (datei.size > 20 * 1024 * 1024) {
				meldungen.push(`„${datei.name}“ ist größer als 20 MB.`);
				continue;
			}
			laufend++;
			try {
				const body = new FormData();
				body.set('datei', datei);
				const res = await fetch('/dateien', { method: 'POST', body });
				const r = await res.json().catch(() => ({}));
				if (!res.ok) meldungen.push(`„${datei.name}“: ${r.fehler ?? 'Hochladen fehlgeschlagen.'}`);
				else liste.push({ id: r.id, name: r.name, beschreibung: '' });
			} catch {
				meldungen.push(`„${datei.name}“: Hochladen fehlgeschlagen.`);
			} finally {
				laufend--;
			}
		}
		if (eingabe) eingabe.value = '';
	}
</script>

<fieldset class="fotos">
	<legend>Fotos <span class="optional">(optional, bis zu {max})</span></legend>
	{#each liste as f (f.id)}<input type="hidden" name="fotos" value={f.id} />{/each}
	{#if liste.length}
		<ul class="vorschau">
			{#each liste as f (f.id)}
				<li>
					<img src={resolve('/(app)/dateien/[id]', { id: f.id })} alt="" />
					<button
						type="button"
						class="weg"
						aria-label="{f.name} entfernen"
						onclick={() => (liste = liste.filter((x) => x.id !== f.id))}
					>
						×
					</button>
				</li>
			{/each}
		</ul>
		{#each liste as f, i (f.id)}
			<label class="beschreibung">
				<span>
					Beschreibung Foto {i + 1}
					<span class="hinweis">(optional, für Bildschirmleser)</span>
				</span>
				<input
					name={beschreibungFeld(f.id)}
					maxlength={BESCHREIBUNG_MAX}
					bind:value={f.beschreibung}
					placeholder="Was ist auf dem Foto zu sehen?"
				/>
			</label>
		{/each}
	{/if}
	<div aria-live="polite">
		{#if laufend}<p class="hinweis">Wird hochgeladen …</p>{/if}
		{#each meldungen as m (m)}<p class="feldfehler">{m}</p>{/each}
		{#if fehler}<p class="feldfehler">{fehler}</p>{/if}
	</div>
	{#if liste.length + laufend < max}
		<label class="knopf zweit">
			Fotos hinzufügen
			<input
				bind:this={eingabe}
				type="file"
				multiple
				accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
				class="sr-only"
				onchange={(e) => hochladen(e.currentTarget.files)}
			/>
		</label>
	{/if}
	<p class="hinweis">Bitte keine Fotos, auf denen Personen zu erkennen sind.</p>
</fieldset>

<style>
	.fotos {
		border: 0;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 8px;
	}
	.fotos .knopf {
		justify-self: start;
	}
	.optional {
		font-weight: 400;
		color: var(--mu);
	}
	.beschreibung {
		display: grid;
		gap: 4px;
		font-size: 0.93rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	li {
		position: relative;
	}
	img {
		width: 96px;
		height: 96px;
		object-fit: cover;
		border-radius: 10px;
		border: 1px solid var(--bd);
	}
	.weg {
		position: absolute;
		top: -8px;
		right: -8px;
		width: 32px;
		height: 32px;
		border-radius: 999px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		cursor: pointer;
	}
	.feldfehler {
		color: var(--err-tx);
		font-weight: 600;
		margin: 0;
	}
</style>
