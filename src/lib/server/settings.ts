import { eq } from 'drizzle-orm';
import { db } from './db/index.ts';
import { settings } from './db/schema.ts';

/** Liest eine Einstellung; fehlt sie, gilt der übergebene Standard. */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
	const [row] = await db
		.select({ value: settings.value })
		.from(settings)
		.where(eq(settings.key, key));
	return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown, updatedBy: string | null) {
	await db
		.insert(settings)
		.values({ key, value, updatedBy })
		.onConflictDoUpdate({ target: settings.key, set: { value, updatedBy, updatedAt: new Date() } });
}
