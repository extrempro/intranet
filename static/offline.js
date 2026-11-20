// Offline-Seite: listet die offline gespeicherten Pläne (Cache „intranet-plaene“).
(async () => {
	try {
		const cache = await caches.open('intranet-plaene');
		const res = await cache.match('/__offline/plaene.json');
		const list = res ? await res.json() : [];
		if (!Array.isArray(list) || list.length === 0) return;
		document.getElementById('leer').hidden = true;
		const ul = document.getElementById('plaene');
		for (const p of list) {
			if (typeof p.fileId !== 'string' || !/^[0-9a-f-]{36}$/i.test(p.fileId)) continue;
			const li = document.createElement('li');
			const a = document.createElement('a');
			a.href = '/dateien/' + p.fileId;
			a.textContent = String(p.title ?? 'Plan');
			const info = document.createElement('span');
			info.textContent = [
				p.kbb,
				p.validUntil ? 'gültig bis ' + String(p.validUntil).split('-').reverse().join('.') : ''
			]
				.filter(Boolean)
				.join(' · ');
			li.append(a, info);
			ul.append(li);
		}
	} catch {
		// Ohne Cache-Zugriff bleibt die Liste leer
	}
})();
