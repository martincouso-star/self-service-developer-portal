import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import { createApp } from './server';

describe('health', () => {
  it('returns ok and the service name', async () => {
    const server = createApp();
    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address() as AddressInfo;
    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/health`,
      );
      assert.equal(response.status, 200);
      const body = (await response.json()) as { status: string; service: string };
      assert.equal(body.status, 'ok');
      assert.equal(typeof body.service, 'string');
      assert.notEqual(body.service, '');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
      });
    }
  });
});
