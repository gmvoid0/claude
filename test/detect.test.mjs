import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreLabel, scoreCandidate, assignFields, cleanLabel }
  from '../extension/src/lib/detect.js';

/**
 * The labels below are taken verbatim from the agent screen this was built
 * against, including the awkward ones ("Address1", "PostCode", "Last") and
 * the near-collisions ("Mortgage Balance" vs "Mortgage Payment").
 */

const c = (label, raw, labelSource = 'cell') => ({ uid: label, label, raw, labelSource });

test('the two mortgage fields do not collide', () => {
  assert.ok(scoreLabel('firstLien', 'Mortgage Balance') >= 100);
  assert.equal(scoreLabel('firstLien', 'Mortgage Payment'), 0);

  assert.ok(scoreLabel('payment', 'Mortgage Payment') >= 100);
  assert.equal(scoreLabel('payment', 'Mortgage Balance'), 0);
});

test('a balance label is never read as a home value', () => {
  for (const label of ['Mortgage Balance', 'Loan Balance', 'Payoff', 'Principal Balance']) {
    assert.equal(scoreLabel('propertyValue', label), 0, `${label} must not score as value`);
  }
});

test('agent-screen labels map to the right fields', () => {
  const expected = [
    ['Mortgage Balance', 'firstLien'],
    ['Mortgage Payment', 'payment'],
    ['Loan Type', 'program'],
    ['State', 'state'],
    ['FICO', 'fico'],
    ['Interest Rate', 'interestRate'],
    ['Address1', 'street'],
    ['City', 'city'],
    ['PostCode', 'zip'],
    ['Last', 'lastName'],
    ['First', 'firstName'],
  ];
  for (const [label, field] of expected) {
    assert.ok(scoreLabel(field, label) >= 90, `${label} -> ${field} scored too low`);
  }
});

test('noise on the same screen matches nothing', () => {
  const noise = [
    'MI', 'Gender', 'Lead Code', 'DialCode', 'Alt. Phone', 'Call Notes',
    'Best Call Time', 'Customer Time', 'RECORDING FILE', 'Channel', 'Address3',
  ];
  const fields = ['propertyValue', 'firstLien', 'secondLien', 'program', 'state', 'payment'];
  for (const label of noise) {
    for (const field of fields) {
      assert.equal(scoreLabel(field, label), 0, `"${label}" wrongly matched ${field}`);
    }
  }
});

test('"Status" does not match the state field', () => {
  assert.equal(scoreLabel('state', 'STATUS'), 0);
  assert.equal(scoreLabel('state', 'Call Status'), 0);
  assert.ok(scoreLabel('state', 'State') >= 100);
});

test('home value labels from other sources still work', () => {
  for (const label of ['Appraised Value', 'Estimated Home Value', 'Zestimate', 'Market Value', 'Property Value']) {
    assert.ok(scoreLabel('propertyValue', label) >= 75, `${label} scored too low`);
  }
});

test('long prose is not treated as a label', () => {
  const prose = 'The estimated value of your home may change over time depending on the market';
  assert.equal(scoreLabel('propertyValue', prose), 0);
});

test('discovery source is weighted — a visible label beats the name attribute', () => {
  const visible = scoreCandidate('firstLien', { ...c('Mortgage Balance', '270900'), labelSource: 'cell' });
  const attr = scoreCandidate('firstLien', { ...c('Mortgage Balance', '270900'), labelSource: 'name' });
  assert.ok(visible > attr);
});

test('implausible values are penalised but not discarded', () => {
  const sane = scoreCandidate('firstLien', c('Mortgage Balance', '270900'));
  const silly = scoreCandidate('firstLien', c('Mortgage Balance', '6.06'));
  assert.ok(silly > 0, 'still offered so the agent can see what was read');
  assert.ok(silly < sane, 'but ranked below a plausible figure');
});

test('unparseable content in a money field is heavily penalised', () => {
  const good = scoreCandidate('firstLien', c('Mortgage Balance', '270900'));
  const junk = scoreCandidate('firstLien', c('Mortgage Balance', 'call back tuesday'));
  assert.ok(junk < good * 0.5);
});

test('assignFields resolves a whole screen at once', () => {
  const candidates = [
    c('FICO', ''),
    c('First', 'RANDY D'),
    c('Last', 'ROLLINS'),
    c('Address1', '189 LEDGERWOOD LN'),
    c('Mortgage Payment', '6.06'),
    c('Address3', ''),
    c('City', 'ROCKWOOD'),
    c('State', 'TN'),
    c('PostCode', '37854'),
    c('Mortgage Balance', '270900'),
    c('Lead Code', ''),
    c('Gender', 'U - Undefined'),
    c('Interest Rate', ''),
    c('Loan Type', 'VA'),
    c('Call Notes', 'ROCKET MORTGAGE LLC'),
  ];

  const assigned = assignFields(candidates);

  assert.equal(assigned.firstLien.candidate.raw, '270900');
  assert.equal(assigned.payment.candidate.raw, '6.06');
  assert.equal(assigned.program.candidate.raw, 'VA');
  assert.equal(assigned.state.candidate.raw, 'TN');
  assert.equal(assigned.city.candidate.raw, 'ROCKWOOD');
  assert.equal(assigned.zip.candidate.raw, '37854');
  assert.equal(assigned.street.candidate.raw, '189 LEDGERWOOD LN');
  assert.equal(assigned.lastName.candidate.raw, 'ROLLINS');

  // Nothing on this screen is a home value — it must stay unassigned rather
  // than being filled with a plausible-looking number.
  assert.equal(assigned.propertyValue, undefined);
});

test('one element is never assigned to two fields', () => {
  const shared = c('Balance', '250000');
  const assigned = assignFields([shared, c('Mortgage Balance', '270900')]);
  const used = Object.values(assigned).map((a) => a.candidate.uid);
  assert.equal(new Set(used).size, used.length);
  // The more specific label wins the first-lien slot.
  assert.equal(assigned.firstLien.candidate.raw, '270900');
});

test('a populated field outranks an identical empty one', () => {
  const assigned = assignFields([
    { ...c('Mortgage Balance', ''), uid: 'empty' },
    { ...c('Mortgage Balance', '270900'), uid: 'full' },
  ]);
  assert.equal(assigned.firstLien.candidate.uid, 'full');
});

test('cleanLabel strips the punctuation labels carry', () => {
  assert.equal(cleanLabel('  Mortgage Balance:  '), 'Mortgage Balance');
  assert.equal(cleanLabel('Loan Type*'), 'Loan Type');
  assert.equal(cleanLabel(' State :'), 'State');
  assert.equal(cleanLabel('   '), null);
  assert.equal(cleanLabel(null), null);
});
