import { createHmac, timingSafeEqual } from 'crypto';
import type { IWebhookFunctions } from 'n8n-workflow';

/**
 * Maximum allowed difference between the webhook timestamp and the current time (5 minutes).
 * Protects against replay attacks.
 */
const MAX_TIMESTAMP_AGE_SECONDS = 300;

export const SIGNING_SECRET_CREDENTIAL = 'gotoHumanWebhookSigningSecretApi';

const SECRET_PREFIX = 'whsec_';
const SIGNATURE_VERSION = 'v1';

export type WebhookVerificationResult = { valid: true } | { valid: false; reason: string };

const ok: WebhookVerificationResult = { valid: true };
const fail = (reason: string): WebhookVerificationResult => ({ valid: false, reason });

/**
 * Verifies a webhook request signed according to the Standard Webhooks / Svix scheme:
 *
 * - Headers: `webhook-id`, `webhook-timestamp` (unix seconds), `webhook-signature`
 * - Signed content: `{webhook-id}.{webhook-timestamp}.{raw body}`
 * - Key: the signing secret (`whsec_<base64>`) with the prefix removed and base64-decoded
 * - Signature: base64 HMAC-SHA256, sent as one or more space-delimited `v1,<signature>` entries
 *
 * If no signing secret is set in the credential, verification is skipped (valid).
 * If a signing secret is set, unsigned or wrongly signed requests are rejected.
 * Never throws. On failure, `reason` explains why (safe to return to the caller).
 */
export async function verifyWebhookSignature(
	this: IWebhookFunctions,
): Promise<WebhookVerificationResult> {
	let signingSecret = '';
	try {
		const credential = await this.getCredentials(SIGNING_SECRET_CREDENTIAL);
		const rawSecret = credential?.signingSecret;
		signingSecret = typeof rawSecret === 'string' ? rawSecret.trim() : '';
	} catch {
		// Optional credential not selected (or not readable): no signing secret configured
	}

	// Verification is opt-in: without a signing secret, accept the request.
	if (!signingSecret) {
		return ok;
	}

	try {
		const req = this.getRequestObject();

		const id = req.header('webhook-id');
		const timestamp = req.header('webhook-timestamp');
		const signatureHeader = req.header('webhook-signature');

		const missingHeaders = [
			['webhook-id', id],
			['webhook-timestamp', timestamp],
			['webhook-signature', signatureHeader],
		]
			.filter(([, value]) => typeof value !== 'string' || value === '')
			.map(([name]) => name);
		if (
			missingHeaders.length > 0 ||
			typeof id !== 'string' ||
			typeof timestamp !== 'string' ||
			typeof signatureHeader !== 'string'
		) {
			return fail(`Missing signature header(s): ${missingHeaders.join(', ')}`);
		}

		const timestampError = checkTimestamp(timestamp);
		if (timestampError) {
			return fail(timestampError);
		}

		const rawBody: unknown = req.rawBody;
		const bodyBuffer = Buffer.isBuffer(rawBody)
			? rawBody
			: typeof rawBody === 'string'
				? Buffer.from(rawBody)
				: null;
		if (!bodyBuffer) {
			return fail('Raw request body is not available for signature verification');
		}

		const key = getSigningKey(signingSecret);
		if (key.length === 0) {
			return fail(
				'The webhook signing secret in the credential is invalid. Copy it again from gotoHuman (it starts with "whsec_").',
			);
		}

		const expected = createHmac('sha256', key)
			.update(Buffer.concat([Buffer.from(`${id}.${timestamp}.`), bodyBuffer]))
			.digest();

		if (!hasMatchingSignature(signatureHeader, expected)) {
			return fail(
				'Signature does not match. Check that the signing secret in the credential matches the one in gotoHuman.',
			);
		}
		return ok;
	} catch {
		return fail('Signature verification failed unexpectedly');
	}
}

/**
 * Format check for the signing secret credential. Returns an error message, or `null` if valid.
 */
export function getSigningSecretFormatError(secret: unknown): string | null {
	const trimmed = typeof secret === 'string' ? secret.trim() : '';
	if (!trimmed) {
		return null; // empty is allowed: signature verification is then skipped
	}
	if (!trimmed.startsWith(SECRET_PREFIX)) {
		return `The signing secret must start with "${SECRET_PREFIX}". Copy it from the webhook configuration in gotoHuman.`;
	}
	if (getSigningKey(trimmed).length === 0) {
		return 'The signing secret is not valid base64. Copy it again from gotoHuman.';
	}
	return null;
}

function getSigningKey(secret: string): Buffer {
	const base64Secret = secret.startsWith(SECRET_PREFIX)
		? secret.slice(SECRET_PREFIX.length)
		: secret;
	return Buffer.from(base64Secret, 'base64');
}

/**
 * The header may contain several space-delimited `<version>,<signature>` entries
 * (e.g. during secret rotation). The request is valid if any `v1` entry matches.
 * Entries of other versions are ignored. Comparison is constant-time.
 */
function hasMatchingSignature(signatureHeader: string, expected: Buffer): boolean {
	let matched = false;
	for (const entry of signatureHeader.split(/\s+/)) {
		const separatorIndex = entry.indexOf(',');
		if (separatorIndex === -1) {
			continue;
		}
		const version = entry.slice(0, separatorIndex);
		const signature = entry.slice(separatorIndex + 1);
		if (version !== SIGNATURE_VERSION || !signature) {
			continue;
		}

		const actual = Buffer.from(signature, 'base64');
		if (actual.length === expected.length && timingSafeEqual(actual, expected)) {
			matched = true; // keep looping so timing doesn't reveal which entry matched
		}
	}
	return matched;
}

/**
 * Checks the timestamp (unix seconds) is within the allowed window around now.
 * Returns an error message, or `null` if valid.
 */
function checkTimestamp(timestamp: string): string | null {
	if (!/^\d+$/.test(timestamp.trim())) {
		return 'Invalid webhook-timestamp header';
	}
	const timestampSec = parseInt(timestamp, 10);
	const currentTimeSec = Math.floor(Date.now() / 1000);
	if (Math.abs(currentTimeSec - timestampSec) > MAX_TIMESTAMP_AGE_SECONDS) {
		return 'Webhook timestamp is outside the allowed 5 minute window (possible replay, or clock mismatch)';
	}
	return null;
}
