/**
 * Navigation (Kap. 6). Es erscheinen nur Bereiche und Unterseiten, die es
 * schon gibt; neue Seiten werden hier eingetragen.
 */
export interface NavPage {
	key: string;
	label: string;
	href: string;
}

export interface NavArea {
	key: string;
	label: string;
	/** SVG-Pfad (24×24, Strich) */
	icon: string;
	href: string;
	pages: NavPage[];
}

const ICONS = {
	start: 'M5 12h-2l9 -9l9 9h-2M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7',
	aktuelles:
		'M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1 -4 0v-13a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1v12a3 3 0 0 0 3 3h11M8 8h4M8 12h4M8 16h4',
	organisation: 'M3 21h18M5 21v-14l8 -4v18M19 21v-10l-6 -4',
	wissen:
		'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0 -18M12 16v.01M12 13a2 2 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483'
};

/** Alle Bereiche in Reihenfolge; Unterseiten nur, wenn fertig. */
const AREAS: NavArea[] = [
	{ key: 'start', label: 'Start', icon: ICONS.start, href: '/', pages: [] },
	{
		key: 'aktuelles',
		label: 'Aktuelles',
		icon: ICONS.aktuelles,
		href: '',
		pages: [
			{ key: 'neuigkeiten', label: 'Neuigkeiten', href: '/neuigkeiten' },
			{ key: 'plaene', label: 'Pläne (KBB)', href: '/plaene' }
		]
	},
	{
		key: 'organisation',
		label: 'Organisation',
		icon: ICONS.organisation,
		href: '',
		pages: [{ key: 'organigramm', label: 'Organigramm', href: '/organigramm' }]
	},
	{ key: 'wissen', label: 'Wissen', icon: ICONS.wissen, href: '', pages: [] }
];

/** Bereiche mit Ziel; ein Bereich ohne fertige Unterseite erscheint nicht. */
export function navAreas(): NavArea[] {
	return AREAS.filter((a) => a.key === 'start' || a.pages.length > 0).map((a) => ({
		...a,
		href: a.key === 'start' ? '/' : a.pages[0].href
	}));
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
	return {
		area: pathname === '/' ? (areas.find((a) => a.key === 'start') ?? null) : null,
		page: null
	};
}
