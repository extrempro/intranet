import { describe, expect, it } from 'vitest';
import {
	deviceLabel,
	isAllowedPushEndpoint,
	isValidSubscriptionKeys,
	safePushLink
} from './push.ts';

describe('Web Push', () => {
	it('erlaubt nur bekannte Push-Dienste über HTTPS', () => {
		expect(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
		expect(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(
			true
		);
		expect(isAllowedPushEndpoint('https://web.push.apple.com/QF')).toBe(true);
		expect(isAllowedPushEndpoint('http://fcm.googleapis.com/x')).toBe(false);
		expect(isAllowedPushEndpoint('https://fcm.googleapis.com.evil.example/x')).toBe(false);
		expect(isAllowedPushEndpoint('https://169.254.169.254/latest')).toBe(false);
		expect(isAllowedPushEndpoint('https://intranet.local/x')).toBe(false);
		expect(isAllowedPushEndpoint('https://user:pw@fcm.googleapis.com/x')).toBe(false);
		expect(isAllowedPushEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false);
		expect(isAllowedPushEndpoint('kein link')).toBe(false);
	});

	it('prüft die Schlüssel des Abos', () => {
		const p = 'B'.repeat(87);
		expect(isValidSubscriptionKeys(p, 'A'.repeat(22))).toBe(true);
		expect(isValidSubscriptionKeys(p, 'A+/'.repeat(8))).toBe(false);
		expect(isValidSubscriptionKeys('kurz', 'A'.repeat(22))).toBe(false);
	});

	it('beschreibt Geräte und Ziele', () => {
		expect(
			deviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36')
		).toBe('Chrome auf Windows');
		expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Version/18.0 Safari/604.1')).toBe(
			'Safari auf iPhone/iPad'
		);
		expect(safePushLink('/neuigkeiten/1')).toBe('/neuigkeiten/1');
		expect(safePushLink('//evil.example')).toBe('/benachrichtigungen');
		expect(safePushLink('https://evil.example')).toBe('/benachrichtigungen');
	});
});
