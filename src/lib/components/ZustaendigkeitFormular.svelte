<script lang="ts">
	/** Felder einer Zuständigkeit (Kap. 8.11): Thema, Person, Vertretung, Gruppe, Stichwörter, Links. */
	import { untrack } from 'svelte';
	import Info from './Info.svelte';

	interface Werte {
		topic: string;
		description: string;
		keywords: string;
		groupName: string;
		personId: string;
		deputyId: string;
		links: string;
	}

	let {
		werte,
		team,
		gruppen = [],
		fehler = {},
		praefix
	}: {
		werte: Werte;
		team: { personId: string; name: string; disabled: boolean }[];
		gruppen?: string[];
		fehler?: Partial<Record<keyof Werte, string>>;
		praefix: string;
	} = $props();

	// Eigener Zustand, damit Eingaben beim Neuladen der Seite nicht verloren gehen
	let w = $state(untrack(() => ({ ...werte })));
	const id = (k: string) => `${praefix}-${k}`;
	const err = (k: keyof Werte) => (fehler[k] ? id(`${k}-fehler`) : undefined);
</script>

<label class="feld">
	<span>
		Thema
		<Info
			thema="Thema"
			text="Wofür jemand ansprechbar ist, so wie Kolleginnen und Kollegen danach suchen würden. Das Thema erscheint unter „Wer hilft bei was?“ und in der Suche."
		/>
	</span>
	<input
		name="thema"
		required
		maxlength="120"
		bind:value={w.topic}
		placeholder="z. B. Drucker und Scanner"
		aria-invalid={fehler.topic ? 'true' : undefined}
		aria-describedby={err('topic')}
	/>
	{#if fehler.topic}<span id={id('topic-fehler')} class="feldfehler">{fehler.topic}</span>{/if}
</label>

<div class="zwei">
	<label class="feld">
		<span>Ansprechperson</span>
		<select
			name="person"
			bind:value={w.personId}
			aria-invalid={fehler.personId ? 'true' : undefined}
			aria-describedby={err('personId')}
		>
			<option value="">Bitte wählen</option>
			{#each team as m (m.personId)}
				<option value={m.personId}>{m.name}{m.disabled ? ' (inaktiv)' : ''}</option>
			{/each}
		</select>
		{#if fehler.personId}<span id={id('personId-fehler')} class="feldfehler">
				{fehler.personId}
			</span>{/if}
	</label>
	<label class="feld">
		<span>
			Vertretung (optional)
			<Info
				thema="Vertretung"
				text="Ist die Ansprechperson inaktiv, zeigt die Seite stattdessen die Vertretung an."
			/>
		</span>
		<select
			name="vertretung"
			bind:value={w.deputyId}
			aria-invalid={fehler.deputyId ? 'true' : undefined}
			aria-describedby={err('deputyId')}
		>
			<option value="">Keine</option>
			{#each team as m (m.personId)}
				<option value={m.personId}>{m.name}{m.disabled ? ' (inaktiv)' : ''}</option>
			{/each}
		</select>
		{#if fehler.deputyId}<span id={id('deputyId-fehler')} class="feldfehler">
				{fehler.deputyId}
			</span>{/if}
	</label>
</div>

<label class="feld">
	<span>Beschreibung (optional)</span>
	<textarea
		name="beschreibung"
		rows="2"
		maxlength="500"
		bind:value={w.description}
		aria-describedby={err('description')}></textarea>
	{#if fehler.description}<span id={id('description-fehler')} class="feldfehler">
			{fehler.description}
		</span>{/if}
</label>

<div class="zwei">
	<label class="feld">
		<span>Gruppe (optional)</span>
		<input
			name="gruppe"
			maxlength="60"
			bind:value={w.groupName}
			list={id('gruppen')}
			placeholder="z. B. Arbeitsplatz"
			aria-describedby={err('groupName')}
		/>
		<datalist id={id('gruppen')}>
			{#each gruppen as g (g)}<option value={g}></option>{/each}
		</datalist>
		{#if fehler.groupName}<span id={id('groupName-fehler')} class="feldfehler">
				{fehler.groupName}
			</span>{/if}
	</label>
	<label class="feld">
		<span>
			Stichwörter (mit Komma getrennt)
			<Info
				thema="Stichwörter"
				text="Weitere Begriffe, unter denen die Suche diese Zuständigkeit findet, zum Beispiel andere Schreibweisen oder Abkürzungen. Sie stehen klein unter dem Eintrag."
			/>
		</span>
		<input
			name="stichwoerter"
			maxlength="500"
			bind:value={w.keywords}
			placeholder="z. B. Toner, Papierstau"
			aria-describedby={err('keywords')}
		/>
		{#if fehler.keywords}<span id={id('keywords-fehler')} class="feldfehler">
				{fehler.keywords}
			</span>{/if}
	</label>
</div>

<label class="feld">
	<span>Links (optional, je Zeile „Bezeichnung | Adresse“)</span>
	<textarea
		name="links"
		rows="2"
		maxlength="3000"
		bind:value={w.links}
		placeholder="Anleitung | https://…"
		aria-describedby={err('links')}></textarea>
	{#if fehler.links}<span id={id('links-fehler')} class="feldfehler">{fehler.links}</span>{/if}
</label>

<style>
	.zwei {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
	}
	.feldfehler {
		color: var(--err-tx);
		font-size: 0.93rem;
		font-weight: 600;
	}
</style>
