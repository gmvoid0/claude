import test from 'node:test';
import assert from 'node:assert/strict';

import { parseAddress, compareAddresses, joinAddress, zillowSearchUrl }
  from '../extension/src/lib/address.js';

/**
 * The stakes here are asymmetric. Failing to match costs the agent one
 * keystroke. Matching two different properties attaches one home's value to
 * another borrower and produces a confident, wrong cash-out figure — so
 * these tests lean hard on the false-positive side.
 */

test('parses a dialer-style address', () => {
  const a = parseAddress('189 LEDGERWOOD LN');
  assert.equal(a.number, '189');
  assert.equal(a.core, 'LEDGERWOOD');
  assert.equal(a.zip, null);
});

test('parses a listing-style address with city, state and ZIP', () => {
  const a = parseAddress('809 SE 37th St, Battle Ground, WA 98604');
  assert.equal(a.number, '809');
  assert.equal(a.core, '37');          // directional and suffix stripped, ordinal normalised
  assert.equal(a.zip, '98604');
});

test('the real pairing from the agent screen matches exactly', () => {
  const r = compareAddresses(
    '809 SE 37TH ST, BATTLE GROUND, WA 98604',
    '809 SE 37th St, Battle Ground, WA 98604',
  );
  assert.equal(r.confidence, 'exact');
});

test('matches across abbreviation and casing differences', () => {
  const pairs = [
    ['189 LEDGERWOOD LN', '189 Ledgerwood Lane, Rockwood, TN 37854'],
    ['809 SE 37TH ST', '809 Southeast 37th Street, Battle Ground, WA'],
    ['12 OAK AVE', '12 Oak Avenue'],
    ['4400 N MAIN ST', '4400 North Main St'],
  ];
  for (const [lead, listing] of pairs) {
    assert.equal(compareAddresses(lead, listing).confidence, 'exact',
      `${lead} should match ${listing}`);
  }
});

test('a unit number does not prevent a match', () => {
  const r = compareAddresses('500 PARK BLVD APT 12', '500 Park Blvd, Austin, TX 78701');
  assert.equal(r.confidence, 'exact');
});

test('a different house number never matches', () => {
  const r = compareAddresses('189 LEDGERWOOD LN', '187 Ledgerwood Ln, Rockwood, TN 37854');
  assert.equal(r.confidence, 'none');
  assert.match(r.reason, /house number/);
});

test('a different street never matches', () => {
  const r = compareAddresses('189 LEDGERWOOD LN', '189 Maple Ct, Rockwood, TN 37854');
  assert.equal(r.confidence, 'none');
});

test('a ZIP mismatch is decisive even when the street reads the same', () => {
  // Same street name and number in two different towns is not exotic.
  const r = compareAddresses(
    '100 MAIN ST, SPRINGFIELD, IL 62701',
    '100 Main St, Springfield, MA 01103',
  );
  assert.equal(r.confidence, 'none');
  assert.match(r.reason, /ZIP/);
});

test('missing or unusable addresses never match', () => {
  assert.equal(compareAddresses('', '809 SE 37th St').confidence, 'none');
  assert.equal(compareAddresses(null, null).confidence, 'none');
  assert.equal(compareAddresses('189 LEDGERWOOD LN', '').confidence, 'none');
  assert.equal(compareAddresses('  ', '  ').confidence, 'none');
});

test('a near-miss street name is offered, not applied', () => {
  const r = compareAddresses('1200 SUNSET RIDGE DR', '1200 Sunset Ridgeway Dr, Reno, NV');
  assert.notEqual(r.confidence, 'exact');
});

test('joins lead fields into one line', () => {
  assert.equal(
    joinAddress({ street: '809 SE 37TH ST', city: 'BATTLE GROUND', state: 'WA', zip: '98604' }),
    '809 SE 37TH ST, BATTLE GROUND, WA 98604',
  );
  assert.equal(joinAddress({ street: '189 LEDGERWOOD LN' }), '189 LEDGERWOOD LN');
  assert.equal(joinAddress({}), '');
});

test('builds a Zillow search URL', () => {
  const url = zillowSearchUrl('809 SE 37TH ST, BATTLE GROUND, WA, 98604');
  assert.ok(url.startsWith('https://www.zillow.com/homes/'));
  assert.ok(url.endsWith('_rb/'));
  assert.ok(!/\s/.test(url), 'must be URL-encoded');
  assert.equal(zillowSearchUrl(''), null);
});
