import test from 'node:test';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import express from 'express';
import {requireMcpToken} from '../build/server/access.js';

for (const [name, configured, header, expected] of [
  ['missing server token fails closed', undefined, undefined, 503],
  ['short server token fails closed', 'short', 'Bearer short', 503],
  ['anonymous requests are rejected', 'a'.repeat(40), undefined, 401],
  ['wrong token is rejected', 'a'.repeat(40), 'Bearer ' + 'b'.repeat(40), 401],
  ['query strings cannot authenticate', 'a'.repeat(40), undefined, 401],
  ['correct bearer token is accepted', 'a'.repeat(40), 'Bearer ' + 'a'.repeat(40), 200],
]) {
  test(name, async () => {
    const app = express();
    app.use('/mcp', requireMcpToken(configured));
    app.post('/mcp', (_req, res) => res.json({ok:true}));
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/mcp?token=${'a'.repeat(40)}`, {
        method:'POST', headers:header ? {Authorization:header} : {},
      });
      assert.equal(response.status, expected);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
}
