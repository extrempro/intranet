<script lang="ts">
	/** Suchfeld der Bereichsübersicht: führt zur Intranet-Suche. */
	import { resolve } from '$app/paths';

	let { platzhalter, label }: { platzhalter: string; label: string } = $props();
	const uid = $props.id();
</script>

<form method="GET" action={resolve('/(app)/suche')} role="search">
	<label class="sr-only" for="bs-{uid}">{label}</label>
	<input id="bs-{uid}" type="search" name="q" maxlength="100" placeholder={platzhalter} />
</form>

<style>
	input {
		border-radius: 14px;
		min-height: 48px;
	}
</style>
