import { constants, openSync, closeSync, fchmodSync, fsyncSync, writeFileSync, renameSync, unlinkSync, lstatSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join, basename } from 'node:path';

/** Publish token bytes atomically. The containing directory must be operator-owned.
 * POSIX uses 0600; Windows deployments must also use a private user-profile ACL.
 * @param {string} path
 * @param {string} data
 */
export function writePrivateTokenFile(path, data) {
    let previous;
    try { previous = lstatSync(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous && (!previous.isFile() || previous.isSymbolicLink())) {
        throw new Error('Token destination must be a regular file');
    }
    const temporary = join(dirname(path), `.${basename(path)}-${randomBytes(16).toString('hex')}.tmp`);
    let fd;
    let created = false;
    try {
        fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
        created = true;
        fchmodSync(fd, 0o600);
        writeFileSync(fd, data, 'utf8');
        fsyncSync(fd);
        closeSync(fd);
        fd = undefined;
        // Replacement fixes old permissive modes without exposing new bytes.
        renameSync(temporary, path);
        created = false;
    } finally {
        if (fd !== undefined) closeSync(fd);
        if (created) unlinkSync(temporary);
    }
}
