import { isIP } from 'node:net';

/**
 * Kürzt eine IP-Adresse für Protokolle (Kap. 15/16):
 * IPv4 auf /24 (letztes Oktett 0), IPv6 auf /48.
 * Gibt null zurück, wenn die Adresse nicht lesbar ist.
 */
export function ipPrefix(ip: string | null | undefined): string | null {
	if (!ip) return null;
	let addr = ip.trim();
	// IPv4 in IPv6 verpackt (::ffff:192.0.2.1)
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(addr);
	if (mapped) addr = mapped[1];

	const version = isIP(addr);
	if (version === 4) {
		const parts = addr.split('.');
		return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
	}
	if (version === 6) {
		const groups = expandIpv6(addr).slice(0, 3);
		return `${groups.join(':')}::/48`;
	}
	return null;
}

function expandIpv6(addr: string): string[] {
	const [head, tail] = addr.split('::');
	const h = head ? head.split(':') : [];
	const t = tail !== undefined && tail !== '' ? tail.split(':') : [];
	const missing = 8 - h.length - t.length;
	const full = tail === undefined ? h : [...h, ...Array(missing).fill('0'), ...t];
	return full.map((g) => g.toLowerCase().replace(/^0+(?=.)/, ''));
}
