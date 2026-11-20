<script lang="ts">
	/**
	 * Anhänge im Beitragsformular: Dateien werden einzeln hochgeladen (höchstens
	 * 20 MB), das Formular schickt nur die IDs in Reihenfolge.
	 */
	import { untrack } from 'svelte';

	interface Anhang {
		id: string;
		name: string;
		groesse: string;
	}

	let {
		start,
		max = 10,
		fehler
	}: {
		start: { id: string; name: string; size: number }[];
		max?: number;
		fehler?: string;
	} = $props();

	const groesse = (b: number) =>
		b < 1024 * 1024
			? `${Math.max(1, Math.round(b / 1024))} KB`
			: `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

	let liste = $state<Anhang[]>(
		untrack(() => start.map((a) => ({ id: a.id, name: a.name, groesse: groesse(a.size) })))
	);
	let laufend = $state<string[]>([]);
	let meldungen = $state<string[]>([]);
	let eingabe: HTMLInputElement | undefined = $state();

	async function hochladen(dateien: FileList | null) {
		if (!dateien) return;
		meldungen = [];
		for (const datei of Array.from(dateien)) {
			if (liste.length + laufend.length >= max) {
				meldungen.push(`„${datei.name}“: höchstens ${max} Anhänge je Beitrag.`);
				continue;
			}
			if (datei.size > 20 * 1024 * 1024) {
				meldungen.push(`„${datei.name}“ ist größer als 20 MB.`);
				continue;
			}
			laufend.push(datei.name);
			try {
				const body = new FormData();
				body.set('datei', datei);
				const res = await fetch('/dateien', { method: 'POST', body });
				const ergebnis = await res.json().catch(() => ({}));
				if (!res.ok)
					meldungen.push(`„${datei.name}“: ${ergebnis.fehler ?? 'Hochladen fehlgeschlagen.'}`);
				else liste.push({ id: ergebnis.id, name: ergebnis.name, groesse: ergebnis.groesse });
			} catch {
				meldungen.push(`„${datei.name}“: Hochladen fehlgeschlagen.`);
			} finally {
				laufend = laufend.filter((n) => n !== datei.name);
			}
		}
		if (eingabe) eingabe.value = '';
	}

	function verschieben(i: number, d: number) {
		const j = i + d;
		if (j < 0 || j >= liste.length) return;
		[liste[i], liste[j]] = [liste[j], liste[i]];
	}
</script>

<fieldset class="gruppe">
	<legend>Dateianhänge</legend>
	<p class="hinweis">
		PDF, Bilder (JPG, PNG, WebP), Word, Excel, PowerPoint ohne Makros; je Datei höchstens 20 MB,
		höchstens {max} Anhänge. Herunterladen nur nach Anmeldung.
	</p>

	{#each liste as a (a.id)}
		<input type="hidden" name="anhaenge" value={a.id} />
	{/each}

	{#if liste.length}
		<ol class="liste">
			{#each liste as a, i (a.id)}
				<li>
					<span class="name">{a.name} <span class="hinweis">· {a.groesse}</span></span>
					<span class="werkzeuge">
						<button
							type="button"
							class="mini"
							aria-label="{a.name} nach oben"
							disabled={i === 0}
							onclick={() => verschieben(i, -1)}
						>
							↑
						</button>
						<button
							type="button"
							class="mini"
							aria-label="{a.name} nach unten"
							disabled={i === liste.length - 1}
							onclick={() => verschieben(i, 1)}
						>
							↓
						</button>
						<button
							type="button"
							class="mini"
							aria-label="{a.name} entfernen"
							onclick={() => (liste = liste.filter((x) => x.id !== a.id))}
						>
							×
						</button>
					</span>
				</li>
			{/each}
		</ol>
	{/if}

	<div aria-live="polite">
		{#each laufend as n (n)}<p class="hinweis">„{n}“ wird hochgeladen …</p>{/each}
		{#each meldungen as m (m)}<p class="feldfehler">{m}</p>{/each}
		{#if fehler}<p class="feldfehler">{fehler}</p>{/if}
	</div>

	{#if liste.length + laufend.length < max}
		<label class="knopf zweit hochladen">
			Dateien auswählen
			<input
				bind:this={eingabe}
				type="file"
				multiple
				accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.pptx"
				class="sr-only"
				onchange={(e) => hochladen(e.currentTarget.files)}
			/>
		</label>
	{/if}
	<noscript><p class="hinweis">Anhänge brauchen JavaScript.</p></noscript>
</fieldset>

<style>
	.gruppe {
		border: 1px solid var(--bd);
		border-radius: var(--radius);
		padding: 10px 16px 14px;
		margin: 0;
		display: grid;
		gap: 8px;
	}
	.liste {
		margin: 0;
		padding-left: 1.4rem;
		display: grid;
		gap: 4px;
	}
	.liste li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
	}
	.name {
		overflow-wrap: anywhere;
	}
	.werkzeuge {
		display: flex;
		gap: 4px;
		flex: none;
	}
	.mini {
		min-width: 40px;
		min-height: 40px;
		border-radius: 10px;
		border: 1px solid var(--bd);
		background: var(--sf);
		color: var(--tx);
		font: inherit;
		cursor: pointer;
	}
	.mini:disabled {
		opacity: 0.35;
	}
	.hochladen {
		justify-self: start;
	}
	.hochladen:focus-within {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.feldfehler {
		color: var(--err-tx);
		font-weight: 600;
		margin: 0;
	}
</style>
