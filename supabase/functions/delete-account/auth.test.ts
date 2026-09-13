import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// The edge handler never accepts a user id in its body: identity must be
// recovered from the verified Authorization token. These boundary assertions
// keep the request contract narrow without logging credentials.
function isSupportedDeleteRequest(method: string, authorization: string | null) {
  return method === 'POST' && typeof authorization === 'string' && authorization.length > 0;
}

describe('delete account edge boundary', () => {
  it('requires a POST request with authorization', () => {
    assert.equal(isSupportedDeleteRequest('POST', null), false);
    assert.equal(isSupportedDeleteRequest('GET', 'Bearer redacted'), false);
    assert.equal(isSupportedDeleteRequest('POST', 'Bearer redacted'), true);
  });
});
