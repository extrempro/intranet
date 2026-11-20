<script lang="ts">
	/** Auswahl als Pillen (Radio, Entwurf „Alle / Nur mein Team / Niemand“). */
	let {
		name,
		optionen,
		wert = $bindable()
	}: { name: string; optionen: { key: string; label: string }[]; wert: string } = $props();
</script>

<div class="pillen">
	{#each optionen as o (o.key)}
		<label class="pille" class:an={wert === o.key}>
			<input class="sr-only" type="radio" {name} value={o.key} bind:group={wert} />
			{o.label}
		</label>
	{/each}
</div>

<style>
	.pillen {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.pille.an {
		background: var(--fill);
		border-color: var(--fill);
		color: #fff;
		font-weight: 600;
	}
	.pille:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
</style>
