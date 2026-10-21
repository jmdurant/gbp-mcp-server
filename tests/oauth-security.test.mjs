import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, writeFileSync, statSync, readdirSync, symlinkSync, rmSync, chmodSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {OAuthAttempt, createOAuthCallback} from '../src/utils/oauthAttempt.js';
import {writePrivateTokenFile} from '../src/utils/privateTokenFile.js';

test('invalid, non-scalar and unsolicited callbacks leave the intended attempt pending', () => {
    const attempt = new OAuthAttempt();
    for (const state of [undefined, '', 'bad', [attempt.state], {state:attempt.state}, 'é'.repeat(64)]) {
        assert.throws(() => attempt.consume('code', state), /Invalid/);
    }
    for (const code of [undefined, '', ['code'], {code:'code'}, 'bad\ncode', 'x'.repeat(4097)]) {
        assert.throws(() => attempt.consume(code, attempt.state), /Invalid/);
    }
    assert.equal(attempt.consumed, false);
    const exchange = attempt.consume('same-client-code', attempt.state);
    assert.equal(exchange.code, 'same-client-code');
    assert.equal(createHash('sha256').update(exchange.codeVerifier).digest('base64url'), attempt.challenge);
    assert.throws(() => attempt.consume('replay', attempt.state), /Invalid/);
});
test('attempt expiration is enforced at the boundary', () => {
    let now = 10;
    const attempt = new OAuthAttempt(() => now, 100);
    now = 110;
    assert.throws(() => attempt.consume('code', attempt.state), /expired/);
});
function response() {
    return {statusCode:200, body:'', status(code) {this.statusCode=code;return this;}, send(body) {this.body=body;return this;}};
}
test('HTTP handler rejects injection before exchange and allows exactly one pending exchange', async () => {
    const attempt = new OAuthAttempt();
    let exchanges=0, saves=0, completed=0, release;
    const callback = createOAuthCallback({attempt, client:{async getToken(args) {
        exchanges++; assert.equal(args.codeVerifier, attempt.verifier);
        await new Promise(resolve => {release=resolve;});
        return {tokens:{access_token:'synthetic-access',refresh_token:'synthetic-refresh'}};
    }}, save(tokens) {saves++;assert.equal(tokens.refresh_token,'synthetic-refresh');}, completed() {completed++;}});
    const rejected=response();
    await callback({query:{code:'attacker-code',state:'0'.repeat(64)}},rejected);
    assert.equal(rejected.statusCode,400); assert.equal(exchanges,0); assert.equal(saves,0);
    const good=response();
    const pending=callback({query:{code:'valid-code',state:attempt.state}},good);
    const duplicate=response();
    await callback({query:{code:'replay',state:attempt.state}},duplicate);
    assert.equal(duplicate.statusCode,400); assert.equal(exchanges,1); assert.equal(saves,0);
    release(); await pending;
    assert.equal(good.statusCode,200);assert.equal(saves,1);assert.equal(completed,1);
});
test('provider failure neither saves tokens nor reflects secret-bearing exception text', async () => {
    const attempt=new OAuthAttempt(); let saved=false;
    const callback=createOAuthCallback({attempt, client:{async getToken(){throw new Error('synthetic-secret');}},save(){saved=true;},completed(){assert.fail();}});
    const res=response();await callback({query:{code:'valid',state:attempt.state}},res);
    assert.equal(res.statusCode,500);assert.equal(saved,false);assert.doesNotMatch(res.body,/synthetic-secret/);
});
test('token publication is owner-only with umask 000 and replaces old permissive files', () => {
    const root=mkdtempSync(join(tmpdir(),'gbp-token-'));
    const old=process.umask(0);
    try {
        const target=join(root,'.tokens.json');
        writePrivateTokenFile(target,'synthetic-one');
        if(process.platform!=='win32')assert.equal(statSync(target).mode&0o777,0o600);
        chmodSync(target,0o666);writePrivateTokenFile(target,'synthetic-two');
        assert.equal(readFileSync(target,'utf8'),'synthetic-two');
        if(process.platform!=='win32')assert.equal(statSync(target).mode&0o777,0o600);
        writePrivateTokenFile(target,'');assert.equal(readFileSync(target,'utf8'),'');
        assert.deepEqual(readdirSync(root),['.tokens.json']);
    } finally {process.umask(old);rmSync(root,{recursive:true,force:true});}
});
test('symlink destination is refused and unrelated bytes remain intact', {skip:process.platform==='win32'}, () => {
    const root=mkdtempSync(join(tmpdir(),'gbp-token-'));
    try {
        const victim=join(root,'other');writeFileSync(victim,'unchanged');
        const target=join(root,'.tokens.json');symlinkSync(victim,target);
        assert.throws(()=>writePrivateTokenFile(target,'new'),/regular file/);
        assert.equal(readFileSync(victim,'utf8'),'unchanged');
        assert.equal(readdirSync(root).length,2);
        assert.throws(()=>writePrivateTokenFile(join(root,'missing','tokens'),'new'));
    } finally {rmSync(root,{recursive:true,force:true});}
});
test('both runtime layouts and npm package retain shared helpers and loopback enrollment', () => {
    const source=readFileSync(new URL('../authenticate.js',import.meta.url),'utf8');
    assert.match(source,/app\.listen\(PORT, '127\.0\.0\.1'/);
    assert.match(source,/createOAuthCallback\(/);assert.match(source,/code_challenge: attempt.challenge/);
    for(const helper of ['oauthAttempt','privateTokenFile']) {
        assert.ok(existsSync(new URL('../build/utils/'+helper+'.js',import.meta.url)));
    }
    const runtime=readFileSync(new URL('../src/utils/tokenStorage.ts',import.meta.url),'utf8');
    assert.doesNotMatch(runtime,/writeFileSync/);assert.match(runtime,/writePrivateTokenFile/);
});
