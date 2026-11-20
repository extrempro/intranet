/**
 * Navigation (Kap. 6). Es erscheinen nur Bereiche und Unterseiten, die es
 * schon gibt; neue Seiten werden hier eingetragen.
 */
export interface NavPage {
	key: string;
	label: string;
	href: string;
	/** SVG-Pfad für die Bereichsübersicht */
	icon: string;
	/** Kurztext in der Bereichsübersicht */
	text: string;
}

export interface NavArea {
	key: string;
	label: string;
	/** Kurzer Name für schmale Leisten (Tablet, Handy) */
	kurz?: string;
	/** SVG-Pfad (24×24, Strich) */
	icon: string;
	href: string;
	pages: NavPage[];
}

const BUCH =
	'M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0M3 6v13M12 6v13M21 6v13';
const GEBAEUDE = 'M3 21h18M5 21v-14l8 -4v18M19 21v-10l-6 -4M9 9v.01M9 12v.01M9 15v.01M9 18v.01';
const ZEITUNG =
	'M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1 -4 0v-13a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1v12a3 3 0 0 0 3 3h11M8 8h4M8 12h4M8 16h4';

const ICONS = {
	start: 'M5 12h-2l9 -9l9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7',
	aktuelles: ZEITUNG,
	organisation: GEBAEUDE,
	wissen: BUCH,
	plaene:
		'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2zM16 3v4M8 3v4M4 11h16',
	kalender:
		'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2zM16 3v4M8 3v4M4 11h16M8 15h2v2h-2z',
	hubfeed:
		'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M5 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M19 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M12 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M6.5 6.5l4 4M17.5 6.5l-4 4M12 14v3',
	kulissen:
		'M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2M12 13m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
	brett: 'M9 4v6l-2 4v2h10v-2l-2 -4v-6M12 16v5M8 4h8',
	speiseplan: 'M7 3v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2 -2v-8M9 3v18M17 3c-2 0 -3 3 -3 7h3v11',
	hubs: 'M4 4h6v6h-6zM14 4h6v6h-6zM4 14h6v6h-6zM14 14h6v6h-6z',
	personen:
		'M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0 -3 -3.85',
	organigramm:
		'M10 3h4a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1zM4 16h4a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1zM16 16h4a1 1 0 0 1 1 1v3a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1zM12 8v4M6 16v-4h12v4',
	faqs: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M12 17v.01M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4',
	recht:
		'M7 20h10M6 6l6 -1l6 1M12 3v17M9 12l-3 -6l-3 6a3 3 0 0 0 6 0M21 12l-3 -6l-3 6a3 3 0 0 0 6 0'
};

/** Alle Bereiche in Reihenfolge; Unterseiten nur, wenn fertig. */
const AREAS: NavArea[] = [
	{ key: 'start', label: 'Start', icon: ICONS.start, href: '/', pages: [] },
	{
		key: 'aktuelles',
		label: 'Aktuelles',
		icon: ICONS.aktuelles,
		href: '/aktuelles',
		pages: [
			{
				key: 'neuigkeiten',
				label: 'Neuigkeiten',
				href: '/neuigkeiten',
				icon: ZEITUNG,
				text: 'Beiträge von Geschäftsführung, Stabsstellen und Abteilungen'
			},
			{
				key: 'plaene',
				label: 'Pläne (KBB)',
				href: '/plaene',
				icon: ICONS.plaene,
				text: 'Wochen- und Monatspläne'
			},
			{
				key: 'kalender',
				label: 'Kalender',
				href: '/kalender',
				icon: ICONS.kalender,
				text: 'Spielplan, Abteilungen und Hubs'
			},
			{
				key: 'aus-den-hubs',
				label: 'Aus den Hubs',
				href: '/aus-den-hubs',
				icon: ICONS.hubfeed,
				text: 'Beiträge deiner abonnierten Hubs'
			},
			{
				key: 'kulissen',
				label: 'Hinter den Kulissen',
				href: '/hinter-den-kulissen',
				icon: ICONS.kulissen,
				text: 'Einblicke von Kolleginnen und Kollegen'
			},
			{
				key: 'schwarzes-brett',
				label: 'Schwarzes Brett',
				href: '/schwarzes-brett',
				icon: ICONS.brett,
				text: 'Biete, Suche, Mitfahren'
			},
			{
				key: 'speiseplan',
				label: 'Speiseplan',
				href: '/speiseplan',
				icon: ICONS.speiseplan,
				text: 'Kantine, aktuelle Woche'
			}
		]
	},
	{
		key: 'organisation',
		label: 'Organisation',
		kurz: 'Orga',
		icon: ICONS.organisation,
		href: '/organisation',
		pages: [
			{
				key: 'abteilungen',
				label: 'Abteilungen',
				href: '/abteilungen',
				icon: GEBAEUDE,
				text: 'Alle Abteilungen mit Ansprechpersonen'
			},
			{
				key: 'hubs',
				label: 'Hubs',
				href: '/hubs',
				icon: ICONS.hubs,
				text: 'Themenseiten für alle'
			},
			{
				key: 'personen',
				label: 'Personen',
				href: '/personen',
				icon: ICONS.personen,
				text: 'Ansprechpersonen finden'
			},
			{
				key: 'organigramm',
				label: 'Organigramm',
				href: '/organigramm',
				icon: ICONS.organigramm,
				text: 'Die Struktur im Überblick'
			}
		]
	},
	{
		key: 'wissen',
		label: 'Wissen',
		icon: ICONS.wissen,
		href: '/wissen',
		pages: [
			{ key: 'faqs', label: 'FAQs', href: '/faqs', icon: ICONS.faqs, text: 'Häufige Fragen' },
			{
				key: 'rechtliches',
				label: 'Rechtliches',
				href: '/rechtliches',
				icon: ICONS.recht,
				text: 'Aushang, Betriebsvereinbarungen, Tarifverträge'
			},
			{
				key: 'handbuch',
				label: 'Handbuch',
				href: '/handbuch',
				icon: BUCH,
				text: 'So nutzt du das Intranet'
			}
		]
	}
];

/** Bereiche mit Ziel; ein Bereich ohne fertige Unterseite erscheint nicht. */
export function navAreas(): NavArea[] {
	return AREAS.filter((a) => a.key === 'start' || a.pages.length > 0);
}

/** Bereich und Unterseite zur aktuellen Adresse. */
export function currentNav(
	areas: NavArea[],
	pathname: string
): { area: NavArea | null; page: NavPage | null } {
	for (const area of areas) {
		const page =
			area.pages.find((p) => pathname === p.href || pathname.startsWith(`${p.href}/`)) ?? null;
		if (page) return { area, page };
	}
	// Startseite und Bereichsübersichten (/aktuelles, /organisation, /wissen)
	return { area: areas.find((a) => a.href === pathname) ?? null, page: null };
}
