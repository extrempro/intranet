/**
 * Schutz gegen SSRF (Kap. 16) für Verbindungen zu Adressen, die Admins eintragen
 * (S3-Speicher): nur öffentliche IP-Adressen, geprüft nach der Namensauflösung und
 * bei jeder Verbindung (kein Umweg über DNS-Rebinding).
 */
import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns';
import { Agent } from 'node:https';
import { BlockList, isIP } from 'node:net';

const gesperrt = new BlockList();
for (const [netz, laenge] of [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.0.2.0', 24],
	['192.88.99.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['198.51.100.0', 24],
	['203.0.113.0', 24],
	['224.0.0.0', 4],
	['240.0.0.0', 4]
] as const)
	gesperrt.addSubnet(netz, laenge, 'ipv4');
for (const [netz, laenge] of [
	// IPv4-kompatibel (veraltet, ::a.b.c.d) inkl. :: und ::1
	['::', 96],
	// IPv4 übersetzt (SIIT, ::ffff:0:a.b.c.d)
	['::ffff:0:0:0', 96],
	// NAT64 (bekannt und lokal) und 6to4: betten IPv4-Adressen ein
	['64:ff9b::', 96],
	['64:ff9b:1::', 48],
	['2002::', 16],
	['100::', 64],
	['2001:db8::', 32],
	['fc00::', 7],
	['fe80::', 10],
	// site-local (veraltet)
	['fec0::', 10],
	['ff00::', 8]
] as const)
	gesperrt.addSubnet(netz, laenge, 'ipv6');

/** true, wenn die Adresse öffentlich erreichbar ist (keine internen Netze). */
export function istOeffentlich(ip: string): boolean {
	const v = isIP(ip);
	if (v === 0) return false;
	// IPv4 in IPv6 verpackt: als IPv4 prüfen
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
	if (mapped) return !gesperrt.check(mapped[1], 'ipv4');
	return !gesperrt.check(ip, v === 4 ? 'ipv4' : 'ipv6');
}

export class NetzFehler extends Error {}

type LookupCallback = (
	err: NodeJS.ErrnoException | null,
	address: string | LookupAddress[],
	family?: number
) => void;

/** DNS-Auflösung, die interne Adressen ablehnt (für http(s).Agent). */
export function sichererLookup(hostname: string, options: LookupOptions, cb: LookupCallback) {
	dnsLookup(hostname, { ...options, all: true }, (err, adressen) => {
		if (err) return cb(err, '');
		const liste = adressen as LookupAddress[];
		if (liste.length === 0 || liste.some((a) => !istOeffentlich(a.address))) {
			return cb(
				Object.assign(new NetzFehler(`${hostname} zeigt auf eine interne Adresse.`), {
					code: 'EINTERN'
				}),
				''
			);
		}
		if (options.all) return cb(null, liste);
		cb(null, liste[0].address, liste[0].family);
	});
}

/** HTTPS-Agent mit Prüfung der Zieladresse bei jeder Verbindung. */
export function sichererAgent(): Agent {
	return new Agent({ keepAlive: true, maxSockets: 16, lookup: sichererLookup });
}
