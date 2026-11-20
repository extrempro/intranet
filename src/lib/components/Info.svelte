<script lang="ts">
	/**
	 * „i“-Erläuterung an Feldern (Kap. 13, Grundprinzip 5). Klick auf „i“
	 * blendet einen kurzen Text ein; Escape blendet ihn aus.
	 * Bewusst kein <button>: Innerhalb eines <label> würde ein Button statt des
	 * Eingabefelds zum beschrifteten Element. preventDefault verhindert, dass
	 * der Klick das Feld auslöst.
	 */
	let { text, thema = 'diesem Feld' }: { text: string; thema?: string } = $props();
	let offen = $state(false);
	const uid = $props.id();
	const id = `info-${uid}`;
</script>

<span class="info">
	<span
		role="button"
		tabindex="0"
		class="i"
		aria-expanded={offen}
		aria-controls={id}
		aria-label="Erläuterung zu {thema}"
		onclick={(e) => {
			e.preventDefault();
			e.stopPropagation();
			offen = !offen;
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				offen = !offen;
			} else if (e.key === 'Escape') offen = false;
		}}
	>
		i
	</span>
	{#if offen}<span {id} class="text" role="note">{text}</span>{/if}
</span>

<style>
	.info {
		display: inline;
	}
	.i {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		margin-left: 6px;
		padding: 0;
		border-radius: 999px;
		border: 1px solid var(--ac);
		background: transparent;
		color: var(--ac);
		font:
			italic 700 12px/1 Georgia,
			serif;
		user-select: none;
		cursor: pointer;
		vertical-align: middle;
		position: relative;
	}
	.i::after {
		content: '';
		position: absolute;
		inset: -12px;
	}
	.text {
		display: block;
		margin-top: 6px;
		padding: 8px 10px;
		border-radius: 10px;
		background: var(--tint);
		font-weight: 400;
		font-size: 14px;
		line-height: 1.45;
		color: var(--tx);
	}
</style>
