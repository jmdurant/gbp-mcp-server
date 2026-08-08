/**
 * Load environment variables from the server's own .env, independent of the
 * current working directory.
 *
 * `dotenv/config` reads .env from process.cwd(), which breaks when this MCP
 * server is launched from another project (e.g. as a user-scoped server in
 * Claude Code): the cwd is the other project, so .env — and the Google
 * credentials it holds — aren't found, and startup fails in production mode.
 *
 * Resolving .env relative to this module (mirroring how tokenStorage resolves
 * .tokens.json) makes the server portable: credentials load no matter where it
 * is launched from. Importing this module for its side effect must come before
 * any module that reads the config. A missing .env is fine (dotenv no-ops),
 * which lets credentials come from the process environment instead.
 */
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// build/utils/loadEnv.js -> ../../.env = project root (same base as .tokens.json)
config({ path: join(__dirname, '../../.env') });
