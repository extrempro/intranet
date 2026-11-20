<script lang="ts">
	let { data } = $props();
</script>

<svelte:head>
	<title>Intranet</title>
</svelte:head>

<h1>Hallo {data.name}</h1>
<p>
	Du bist angemeldet. Die Oberfläche entsteht in den nächsten Schritten nach <code>
		docs/spec.md
	</code>.
</p>
<form method="POST" action="/abmelden">
	<button type="submit">Abmelden</button>
</form>
