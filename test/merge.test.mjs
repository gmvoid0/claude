import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeInputs, decideExternalValue, leadAddress }
  from '../extension/src/lib/merge.js';

const KEYS = ['propertyValue', 'firstLien', 'program', 'state', 'street', 'city', 'zip'];

const detectedScreen = {
  firstLien: { raw: '270900', label: 'Mortgage Balance', source: 'auto' },
  program: { raw: 'VA', label: 'Loan Type', source: 'auto' },
  state: { raw: 'TN', label: 'State', source: 'auto' },
  street: { raw: '189 LEDGERWOOD LN', label: 'Address1', source: 'auto' },
  city: { raw: 'ROCKWOOD', label: 'City', source: 'auto' },
  zip: { raw: '37854', label: 'PostCode', source: 'auto' },
};

/* --- source precedence -------------------------------------------------- */

test('detected values are used when the agent has typed nothing', () => {
  const inputs = mergeInputs({ detected: detectedScreen, keys: KEYS });

  assert.equal(inputs.firstLien.value, '270900');
  assert.equal(inputs.firstLien.num, 270900);
  assert.equal(inputs.firstLien.source, 'auto');
  assert.equal(inputs.firstLien.sourceLabel, 'Mortgage Balance');
  assert.equal(inputs.program.normalized, 'VA');
  assert.equal(inputs.state.normalized, 'TN');
  assert.equal(inputs.propertyValue.value, '');
  assert.equal(inputs.propertyValue.source, 'none');
});

test('what the agent types beats what was detected', () => {
  const inputs = mergeInputs({
    manual: { firstLien: '310000' },
    detected: detectedScreen,
    keys: KEYS,
  });

  assert.equal(inputs.firstLien.value, '310000');
  assert.equal(inputs.firstLien.num, 310000);
  assert.equal(inputs.firstLien.source, 'manual');
});

test('a field the agent cleared stays cleared', () => {
  // Regression: an empty manual entry used to fall through to detection, so
  // deleting the last character snapped the page value straight back in.
  const inputs = mergeInputs({
    manual: { firstLien: '' },
    detected: detectedScreen,
    keys: KEYS,
  });

  assert.equal(inputs.firstLien.value, '');
  assert.equal(inputs.firstLien.source, 'manual');
  assert.equal(inputs.firstLien.num, null);
});

test('a bound field outranks auto-detection and is labelled as bound', () => {
  const inputs = mergeInputs({
    detected: {
      ...detectedScreen,
      firstLien: { raw: '99999', label: 'pinned field', source: 'bound' },
    },
    keys: KEYS,
  });

  assert.equal(inputs.firstLien.value, '99999');
  assert.equal(inputs.firstLien.source, 'bound');
});

test('a child frame fills only what this frame could not find', () => {
  const inputs = mergeInputs({
    detected: detectedScreen,
    frameFields: {
      firstLien: { raw: '111111', label: 'Balance', source: 'auto' },
      propertyValue: { raw: '$661,400', label: 'Zestimate', source: 'auto', isAvm: true },
    },
    keys: KEYS,
  });

  assert.equal(inputs.firstLien.value, '270900', 'this frame wins');
  assert.equal(inputs.propertyValue.value, '$661,400', 'frame fills the gap');
  assert.equal(inputs.propertyValue.num, 661400);
  assert.equal(inputs.propertyValue.isAvm, true);
  assert.match(inputs.propertyValue.sourceLabel, /frame/);
});

test('blank and whitespace-only detected values are treated as absent', () => {
  const inputs = mergeInputs({
    detected: { firstLien: { raw: '   ', label: 'Mortgage Balance', source: 'auto' } },
    keys: KEYS,
  });
  assert.equal(inputs.firstLien.source, 'none');
});

test('implausible amounts are flagged but still surfaced', () => {
  const inputs = mergeInputs({
    detected: { firstLien: { raw: '6.06', label: 'Mortgage Balance', source: 'auto' } },
    keys: KEYS,
  });
  assert.equal(inputs.firstLien.num, 6.06);
  assert.equal(inputs.firstLien.implausible, true);
});

test('an unrecognised loan type normalises to null rather than guessing', () => {
  const inputs = mergeInputs({
    detected: { program: { raw: '190', label: 'Loan Type', source: 'auto' } },
    keys: KEYS,
  });
  assert.equal(inputs.program.value, '190');
  assert.equal(inputs.program.normalized, null);
});

/* --- the Zillow hand-off ------------------------------------------------ */

const zillow = {
  value: 661400,
  address: '809 SE 37th St, Battle Ground, WA 98604',
  siteLabel: 'Zillow',
  valueLabel: 'Zestimate',
  at: Date.now(),
};

function inputsFor({ street, city, state, zip, propertyValue = '' }) {
  return mergeInputs({
    manual: propertyValue ? { propertyValue } : {},
    detected: {
      street: { raw: street, source: 'auto' },
      city: { raw: city, source: 'auto' },
      state: { raw: state, source: 'auto' },
      zip: { raw: zip, source: 'auto' },
    },
    keys: KEYS,
  });
}

const matchingLead = () => inputsFor({
  street: '809 SE 37TH ST', city: 'BATTLE GROUND', state: 'WA', zip: '98604',
});

test('a matching address fills the value in', () => {
  const decision = decideExternalValue({ inputs: matchingLead(), external: zillow });

  assert.equal(decision.status, 'applied');
  assert.equal(decision.comparison.confidence, 'exact');
  assert.equal(decision.value.num, 661400);
  assert.equal(decision.value.source, 'external');
  assert.equal(decision.value.isAvm, true);
  assert.equal(decision.value.sourceLabel, 'Zillow Zestimate');
});

test('a different property is offered, never applied', () => {
  const decision = decideExternalValue({
    inputs: inputsFor({ street: '189 LEDGERWOOD LN', city: 'ROCKWOOD', state: 'TN', zip: '37854' }),
    external: zillow,
  });

  assert.equal(decision.status, 'offered');
  assert.equal(decision.comparison.confidence, 'none');
});

test('the house next door is never applied', () => {
  const decision = decideExternalValue({
    inputs: inputsFor({ street: '811 SE 37TH ST', city: 'BATTLE GROUND', state: 'WA', zip: '98604' }),
    external: zillow,
  });
  assert.equal(decision.status, 'offered');
});

test('a value the agent typed is never overwritten', () => {
  // Regression: a matching Zillow tab used to re-apply on every render and
  // clobber whatever the agent had entered.
  const decision = decideExternalValue({
    inputs: inputsFor({
      street: '809 SE 37TH ST', city: 'BATTLE GROUND', state: 'WA', zip: '98604',
      propertyValue: '640000',
    }),
    external: zillow,
  });

  assert.equal(decision.status, 'offered', 'must not overwrite a typed value');
  assert.equal(decision.comparison.confidence, 'exact', 'but should still say it matches');
});

test('a lead with no address never auto-fills', () => {
  const decision = decideExternalValue({
    inputs: inputsFor({ street: '', city: '', state: '', zip: '' }),
    external: zillow,
  });
  assert.equal(decision.status, 'offered');
  assert.match(decision.comparison.reason, /address/i);
});

test('a stale valuation expires instead of lingering', () => {
  const decision = decideExternalValue({
    inputs: matchingLead(),
    external: { ...zillow, at: Date.now() - 60 * 60 * 1000 },
    ttlMs: 30 * 60 * 1000,
  });
  assert.equal(decision.status, 'expired');
});

test('no valuation at all is a no-op', () => {
  assert.equal(decideExternalValue({ inputs: matchingLead(), external: null }).status, 'none');
  assert.equal(decideExternalValue({ inputs: matchingLead(), external: {} }).status, 'none');
});

test('builds the lead address from the separate fields', () => {
  assert.equal(
    leadAddress(matchingLead()),
    '809 SE 37TH ST, BATTLE GROUND, WA 98604',
  );
  assert.equal(leadAddress(inputsFor({ street: '', city: '', state: '', zip: '' })), '');
});
