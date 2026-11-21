import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import {
	deleteTeamsSessionCookie,
	setTeamsSessionCookie,
	TEAMS_SESSION_COOKIE
} from './session.ts';

function fake() {
	const calls: { name: string; opts: Record<string, unknown> }[] = [];
	const cookies = {
		set: (name: string, _v: string, opts: Record<string, unknown>) => calls.push({ name, opts }),
		delete: (name: string, opts: Record<string, unknown>) => calls.push({ name, opts })
	} as unknown as Cookies;
	return { cookies, calls };
}

describe('Teams-Sitzungscookie', () => {
	it('ist partitioniert, SameSite=None, nur HTTPS und nicht per Skript lesbar', () => {
		const { cookies, calls } = fake();
		setTeamsSessionCookie(cookies, 't', new Date(Date.now() + 1000));
		expect(calls[0].name).toBe(TEAMS_SESSION_COOKIE);
		expect(TEAMS_SESSION_COOKIE.startsWith('__Host-')).toBe(true);
		expect(calls[0].opts).toMatchObject({
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'none',
			partitioned: true
		});
	});

	it('wird mit denselben Merkmalen gelöscht', () => {
		const { cookies, calls } = fake();
		deleteTeamsSessionCookie(cookies);
		expect(calls[0].opts).toMatchObject({ sameSite: 'none', partitioned: true, path: '/' });
	});
});
