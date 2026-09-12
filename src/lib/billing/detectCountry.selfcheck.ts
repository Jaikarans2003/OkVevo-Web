/**
 * Server detectCountry: CF-IPCountry → geo-IP → USD.
 * Run: npx tsx src/lib/billing/detectCountry.selfcheck.ts
 */
import assert from 'node:assert/strict';

import {
  clientIpFromForwardedFor,
  countryFromCfIpCountry,
  currencyFromCountry,
  detectCountry,
  isPublicIp,
} from './detectCountry.ts';

assert.equal(currencyFromCountry('IN'), 'INR');
assert.equal(currencyFromCountry('US'), 'USD');
assert.equal(currencyFromCountry(null), 'USD');

assert.equal(countryFromCfIpCountry('in'), 'IN');
assert.equal(countryFromCfIpCountry('XX'), null);
assert.equal(countryFromCfIpCountry('T1'), null);
assert.equal(countryFromCfIpCountry('IND'), null);

assert.equal(clientIpFromForwardedFor('203.0.113.10, 169.254.1.1'), '203.0.113.10');
assert.equal(isPublicIp('127.0.0.1'), false);
assert.equal(isPublicIp('10.0.0.1'), false);
assert.equal(isPublicIp('192.168.1.1'), false);
assert.equal(isPublicIp('172.16.0.1'), false);
assert.equal(isPublicIp('203.0.113.10'), true);

const cf = await detectCountry(new Headers({ 'cf-ipcountry': 'IN' }), async () => {
  throw new Error('geo must not run when CF-IPCountry is set');
});
assert.equal(cf.currency, 'INR');
assert.equal(cf.country, 'IN');
assert.equal(cf.source, 'cf-ipcountry');

const geo = await detectCountry(
  new Headers({ 'x-forwarded-for': '203.0.113.50' }),
  async (url) => {
    const href = String(url);
    if (href.includes('country.is')) {
      return new Response(JSON.stringify({ country: 'IN' }), { status: 200 });
    }
    throw new Error(`unexpected ${href}`);
  }
);
assert.equal(geo.currency, 'INR');
assert.equal(geo.source, 'geo-ip');

const fallback = await detectCountry(new Headers(), async () => {
  throw new Error('no network');
});
assert.equal(fallback.currency, 'USD');
assert.equal(fallback.source, 'default');

const privateIp = await detectCountry(
  new Headers({ 'x-forwarded-for': '127.0.0.1' }),
  async () => {
    throw new Error('must not geo-lookup private IP');
  }
);
assert.equal(privateIp.source, 'default');

console.log('detectCountry.selfcheck: ok');
