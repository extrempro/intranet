import { createECDH, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generateRequestDetails, generateVAPIDKeys } from 'web-push';

describe('Web Push mit web-push', () => {
	it('verschlüsselt (aes128gcm) und signiert mit VAPID', () => {
		const client = createECDH('prime256v1');
		client.generateKeys();
		const keys = generateVAPIDKeys();
		const details = generateRequestDetails(
			{
				endpoint: 'https://fcm.googleapis.com/fcm/send/test',
				keys: {
					p256dh: client.getPublicKey().toString('base64url'),
					auth: randomBytes(16).toString('base64url')
				}
			},
			JSON.stringify({ title: 'Test', link: '/' }),
			{
				TTL: 60,
				urgency: 'high',
				vapidDetails: { subject: 'mailto:it@example.org', ...keys }
			}
		);
		expect(details.method).toBe('POST');
		expect(details.headers['Content-Encoding']).toBe('aes128gcm');
		expect(details.headers.Urgency).toBe('high');
		expect(String(details.headers.Authorization)).toMatch(/^vapid t=.+, k=/);
		expect((details.body as Buffer).length).toBeGreaterThan(30);
	});
});
