<script lang="ts">
	/** Video hochladen (Kap. 8.15): in Teilen, danach wandelt der Server um. */
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { MAX_TITEL, MAX_VIDEO_BYTES } from '#lib/mediathek.ts';
	import { anfragen, fortsetzenAb, teileSenden } from '#lib/hochladen.ts';

	let { data } = $props();
	let einheit = $state(untrack(() => data.einheit));
	let titel = $state('');
	let datei = $state<File | null>(null);
	let fehler = $state('');
	let laeuft = $state(false);
	let gesendet = $state(0);
	const prozent = $derived(datei ? Math.floor((gesendet / datei.size) * 100) : 0);
	const mb = (b: number) => (b / 1024 ** 2).toLocaleString('de-DE', { maximumFractionDigits: 0 });

	function waehlen(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
		fehler = '';
		if (f && f.size > MAX_VIDEO_BYTES) {
			fehler = 'Die Datei ist größer als 4 GB.';
			datei = null;
			return;
		}
		datei = f;
		if (f && !titel)
			titel = f.name
				.replace(/\.[^.]+$/, '')
				.replace(/[_-]+/g, ' ')
				.slice(0, MAX_TITEL);
	}

	/** Angelegtes Video: bei einem Abbruch geht es damit weiter */
	let videoId = $state<string | null>(null);

	async function senden(e: SubmitEvent) {
		e.preventDefault();
		if (!datei || laeuft) return;
		fehler = '';
		laeuft = true;
		try {
			let ab = 0;
			if (videoId) {
				ab = await fortsetzenAb(videoId, datei);
			} else {
				const j = await anfragen<{ id: string }>('/mediathek/hochladen', {
					unitId: einheit,
					title: titel,
					size: datei.size
				});
				videoId = j.id;
			}
			await teileSenden(videoId, datei, ab, (n) => (gesendet = n));
			await goto(resolve('/(app)/mediathek/[id]/bearbeiten', { id: videoId }));
		} catch (err) {
			fehler = err instanceof Error ? err.message : 'Das Hochladen hat nicht geklappt.';
		} finally {
			laeuft = false;
		}
	}
</script>

<svelte:head><title>Video hochladen · Mediathek · Intranet</title></svelte:head>

<div class="stapel seite">
	<a class="zurueck" href={resolve('/(app)/mediathek')}>← Mediathek</a>
	<h1>Video hochladen</h1>
	{#if fehler}<p class="meldung fehler" role="alert">{fehler}</p>{/if}
	<form class="karte felder" onsubmit={senden}>
		<label class="feld">
			<span>Abteilung oder Hub</span>
			<select bind:value={einheit} disabled={laeuft || Boolean(videoId)}>
				{#each data.einheiten as u (u.id)}<option value={u.id}>{u.name} ({u.label})</option>{/each}
			</select>
		</label>
		<label class="feld">
			<span>Videodatei</span>
			<input
				type="file"
				accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
				required
				onchange={waehlen}
				disabled={laeuft}
			/>
			<span class="hinweis">
				MP4, MOV oder WebM, bis 4 GB und 3 Stunden.{datei ? ` Gewählt: ${mb(datei.size)} MB.` : ''}
			</span>
		</label>
		<label class="feld">
			<span>Titel</span>
			<input
				bind:value={titel}
				required
				maxlength={MAX_TITEL}
				disabled={laeuft || Boolean(videoId)}
			/>
		</label>
		<p class="hinweis">
			Nach dem Hochladen wandelt das Intranet das Video um und benachrichtigt dich, wenn es fertig
			ist. Dann ergänzt du Beschreibung, Themen, Untertitel und Kapitel und veröffentlichst es. Die
			Originaldatei wird danach gelöscht.
		</p>
		{#if laeuft}
			<div class="stapel eng" role="status">
				<span>
					Wird hochgeladen: {prozent} % ({mb(gesendet)} von {mb(datei?.size ?? 0)} MB). Lass die Seite
					bitte offen.
				</span>
				<progress max="100" value={prozent} aria-label="Fortschritt beim Hochladen"></progress>
			</div>
		{/if}
		<div>
			<button class="knopf" type="submit" disabled={!datei || laeuft}>
				{videoId ? 'Hochladen fortsetzen' : 'Hochladen'}
			</button>
		</div>
		{#if videoId && !laeuft}
			<p class="hinweis">
				Du kannst auch später weitermachen: In der Mediathek steht das Video als „Wird hochgeladen“;
				wähle dort dieselbe Datei erneut. Nach 24 Stunden ohne Fortschritt wird es gelöscht.
			</p>
		{/if}
	</form>
</div>

<style>
	.seite {
		max-width: 44rem;
	}
	h1 {
		margin: 0;
	}
	p {
		margin: 0;
	}
	.zurueck {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
	}
	.eng {
		gap: 4px;
	}
	progress {
		width: 100%;
		height: 10px;
	}
</style>
