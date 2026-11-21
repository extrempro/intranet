<script lang="ts">
	/** Kanäle Glocke / Push / E-Mail als Pillen zum An- und Abhaken (Entwurf). */
	let {
		glocke = $bindable(),
		push = $bindable(),
		mail = $bindable(),
		titel
	}: { glocke: boolean; push: boolean; mail: boolean; titel: string } = $props();
</script>

<div class="kanaele" role="group" aria-label={titel}>
	<label class="pille" class:an={glocke}>
		<input class="sr-only" type="checkbox" name="glocke" bind:checked={glocke} />
		{#if glocke}<span aria-hidden="true">✓</span>{/if}Glocke
	</label>
	<label class="pille" class:an={push}>
		<input class="sr-only" type="checkbox" name="push" bind:checked={push} />
		{#if push}<span aria-hidden="true">✓</span>{/if}Push
	</label>
	<label class="pille" class:an={mail}>
		<input class="sr-only" type="checkbox" name="mail" bind:checked={mail} />
		{#if mail}<span aria-hidden="true">✓</span>{/if}E-Mail
	</label>
</div>

<style>
	.kanaele {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.pille {
		min-height: 40px;
		padding: 6px 14px;
		font-size: 14px;
		cursor: pointer;
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
