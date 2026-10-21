import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/** One local OAuth attempt, shared by the CLI helper and service API. */
export class OAuthAttempt {
    constructor(now = Date.now, ttlMs = 300_000) {
        this.now = now;
        this.expires = now() + ttlMs;
        this.state = randomBytes(32).toString('hex');
        this.verifier = randomBytes(32).toString('base64url');
        this.challenge = createHash('sha256').update(this.verifier).digest('base64url');
        this.consumed = false;
    }

    /** Consume before any asynchronous exchange; invalid requests leave it pending.
     * @param {unknown} code
     * @param {unknown} state
     */
    consume(code, state) {
        if (this.consumed || this.now() >= this.expires ||
            typeof code !== 'string' || code.length === 0 || code.length > 4096 || /[\x00-\x20\x7f]/.test(code) ||
            typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state) ||
            !timingSafeEqual(Buffer.from(state), Buffer.from(this.state))) {
            throw new Error('Invalid or expired OAuth callback');
        }
        this.consumed = true;
        return { code, codeVerifier: this.verifier };
    }
}

/** Dependency-injected HTTP boundary; rejected requests cannot exchange or save.
 * @param {object} options
 * @param {any} options.client
 * @param {OAuthAttempt} options.attempt
 * @param {(tokens: any) => void} options.save
 * @param {() => void} options.completed
 */
export function createOAuthCallback({ client, attempt, save, completed }) {
    return async (req, res) => {
        let exchange;
        try { exchange = attempt.consume(req.query.code, req.query.state); }
        catch { res.status(400).send('Invalid or expired OAuth callback'); return; }
        try {
            const { tokens } = await client.getToken(exchange);
            save({
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                scope: tokens.scope,
                token_type: tokens.token_type || 'Bearer',
                expires_at: tokens.expiry_date || (Date.now() + 3600000)
            });
            res.send('Authentication successful. You can close this window and use the MCP server.');
            completed();
        } catch {
            // Never reflect provider exceptions (which may contain token payloads).
            res.status(500).send('Authentication failed. Restart the authentication helper to try again.');
        }
    };
}
