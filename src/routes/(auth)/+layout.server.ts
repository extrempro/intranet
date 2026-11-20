import { accentStyle, mainBranding } from '#lib/server/tenant-branding.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async () => {
	const branding = await mainBranding();
	return {
		marke: {
			name: branding.name,
			kurz: branding.short,
			logoHell: branding.logoHell,
			logoDunkel: branding.logoDunkel
		},
		rechtliches: { datenschutz: branding.datenschutz, impressum: branding.impressum },
		akzent: accentStyle(branding)
	};
};
