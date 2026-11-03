import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSameOrigin, HttpError, readBoundedJson, sessionForRequest, staffForRequest, validPrivateKey } from '../server/security-core.ts';

const site = 'https://dealer.example';
const environment = { STAFF_EMAILS: 'owner@example.com', PRIVATE_API_KEY: 'a7c4f1'.repeat(11), SITE_URL: site };
const request = (headers: Record<string, string> = {}) => new Request(`${site}/api/admin/vehicles`, { headers });

test('staff access is denied for anonymous and non-allowlisted identities', () => {
  assert.throws(() => staffForRequest(request(), environment), (error: unknown) => error instanceof HttpError && error.status === 401);
  const customer = request({ 'oai-authenticated-user-id': 'customer-id', 'oai-authenticated-user-email': 'customer@example.com' });
  assert.equal(sessionForRequest(customer, environment).staff, false);
  assert.throws(() => staffForRequest(customer, environment), (error: unknown) => error instanceof HttpError && error.status === 403);
});
test('staff must have both platform identity and exact configured email', () => {
  assert.throws(() => staffForRequest(request({ 'oai-authenticated-user-email': 'owner@example.com' }), environment));
  const owner = request({ 'oai-authenticated-user-id': 'site-owner', 'oai-authenticated-user-email': 'OWNER@example.com' });
  assert.equal(staffForRequest(owner, environment).id, 'site-owner');
  assert.throws(() => staffForRequest(request({ 'oai-authenticated-user-id': 'x', 'oai-authenticated-user-email': 'owner@example.com.attacker.example' }), environment));
});
test('service access rejects incorrect keys and documented placeholders', () => {
  assert.throws(() => staffForRequest(request({ authorization: 'Bearer incorrect' }), environment));
  assert.equal(staffForRequest(request({ authorization: `Bearer ${environment.PRIVATE_API_KEY}` }), environment).method, 'service');
  assert.equal(validPrivateKey('replace-with-a-new-random-secret-of-at-least-32-characters'), false);
  assert.throws(() => staffForRequest(request({ authorization: `Bearer ${'a'.repeat(64)}` }), { PRIVATE_API_KEY: '' }));
});
test('cross-origin mutations and absent or null browser origins are rejected', () => {
  assert.doesNotThrow(() => assertSameOrigin(request({ origin: site }), environment));
  for (const origin of ['https://attacker.example', `${site}.attacker.example`, 'null', `${site}/fake`]) {
    assert.throws(() => assertSameOrigin(request({ origin }), environment));
  }
  assert.throws(() => assertSameOrigin(request(), environment));
  assert.doesNotThrow(() => assertSameOrigin(request({ authorization: `Bearer ${environment.PRIVATE_API_KEY}` }), environment));
});
test('body limits apply to streamed bodies even without Content-Length', async () => {
  const req = new Request(`${site}/api/enquiries`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'a'.repeat(250) }) });
  await assert.rejects(() => readBoundedJson(req, 100), (error: unknown) => error instanceof HttpError && error.status === 413);
  await assert.rejects(() => readBoundedJson(new Request(site, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' })), (error: unknown) => error instanceof HttpError && error.status === 400);
  assert.deepEqual(await readBoundedJson(new Request(site, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"Test visitor"}' })), { name: 'Test visitor' });
});
