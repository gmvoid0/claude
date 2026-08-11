import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APPLICATION_FIELDS, APPLICATION_KEYS, SAVE_THRESHOLD,
  buildApplication, filledCount, isWorthSaving, impliesFeeExemption, toPlain, toText,
} from '../extension/src/lib/application.js';
import { mergeInputs } from '../extension/src/lib/merge.js';
import { computeEquity } from '../extension/src/lib/equity.js';

const KEYS = ['propertyValue', 'firstLien', 'program', 'state', 'street', 'city', 'zip',
              'interestRate', 'fico', 'payment', 'phone'];

const screen = {
  firstLien: { raw: '270900', label: 'Mortgage Balance', source: 'auto' },
  program: { raw: 'VA', label: 'Loan Type', source: 'auto' },
  state: { raw: 'TN', label: 'State', source: 'auto' },
  street: { raw: '189 LEDGERWOOD LN', source: 'auto' },
  city: { raw: 'ROCKWOOD', source: 'auto' },
  zip: { raw: '37854', source: 'auto' },
  interestRate: { raw: '6.5%', label: 'Interest Rate', source: 'auto' },
  fico: { raw: '712', label: 'FICO', source: 'auto' },
  payment: { raw: '1806.42', label: 'Mortgage Payment', source: 'auto' },
  phone: { raw: '3024239504', label: 'Phone', source: 'auto' },
};

function scenario({ manual = {}, app = {} } = {}) {
  const inputs = mergeInputs({ manual: { propertyValue: '400000', ...manual }, detected: screen, keys: KEYS });
  const result = computeEquity({
    propertyValue: inputs.propertyValue.num,
    firstLien: inputs.firstLien.num,
    program: inputs.program.normalized,
    state: inputs.state.normalized,
    financeFee: true,
  });
  const application = buildApplication({
    inputs, result, manual: app, address: '189 LEDGERWOOD LN, ROCKWOOD, TN 37854',
  });
  return { inputs, result, application };
}

test('the field list is exactly what was specified', () => {
  assert.deepEqual(APPLICATION_KEYS, [
    'rate', 'balance', 'fico', 'cashOut', 'value', 'payment',
    'income', 'employment', 'loanType', 'disability', 'address', 'phone',
  ]);
  assert.equal(APPLICATION_FIELDS.length, 12);
});

test('everything S.A.M already knows is filled in automatically', () => {
  const { application } = scenario();

  assert.equal(application.balance.value, '$270,900');
  assert.equal(application.value.value, '$400,000');
  assert.equal(application.fico.value, '712');
  assert.equal(application.payment.value, '$1,806');
  assert.equal(application.loanType.value, 'VA');
  assert.equal(application.rate.value, '6.5%');
  assert.equal(application.phone.value, '3024239504');
  assert.equal(application.address.value, '189 LEDGERWOOD LN, ROCKWOOD, TN 37854');

  // Cash-out comes from the calculation, not from the page.
  assert.equal(application.cashOut.value, '$120,681');
  assert.equal(application.cashOut.source, 'auto');
});

test('fields with no source stay empty and are marked as such', () => {
  const { application } = scenario();
  for (const key of ['income', 'employment', 'disability']) {
    assert.equal(application[key].value, '');
    assert.equal(application[key].source, 'none');
  }
});

test('what the agent types beats what was filled in', () => {
  const { application } = scenario({ app: { balance: '$310,000', income: '96000' } });
  assert.equal(application.balance.value, '$310,000');
  assert.equal(application.balance.source, 'manual');
  assert.equal(application.income.value, '96000');
});

test('a negative cash-out is left blank rather than written down', () => {
  const { application } = scenario({ manual: { propertyValue: '200000' } });
  assert.equal(application.cashOut.value, '', 'an underwater figure does not belong on an application');
});

/* --- when it is worth keeping ------------------------------------------- */

test('a record merely looked at is not worth saving', () => {
  // Every field here came from the lead. Nobody has done anything yet, so
  // this must not become a saved file just because the call connected.
  const { application } = scenario();
  assert.ok(filledCount(application) >= SAVE_THRESHOLD, 'auto-fill alone clears the count');
  assert.equal(isWorthSaving(application), false, 'but it still is not worth saving');
});

test('three fields including the agent\'s own work is worth saving', () => {
  const { application } = scenario({ app: { income: '96000' } });
  assert.ok(filledCount(application) >= SAVE_THRESHOLD);
  assert.equal(isWorthSaving(application), true);
});

test('a single stray keystroke on an empty form is not worth saving', () => {
  const application = buildApplication({ inputs: {}, result: null, manual: { income: '96000' } });
  assert.equal(filledCount(application), 1);
  assert.equal(isWorthSaving(application), false, 'below the three-field threshold');
});

test('blanking a field back out withdraws the save offer', () => {
  const withEntry = scenario({ app: { income: '96000' } });
  assert.equal(isWorthSaving(withEntry.application), true);

  const cleared = scenario({ app: { income: '' } });
  assert.equal(isWorthSaving(cleared.application), false);
});

/* --- the disability link ------------------------------------------------ */

test('a disability rating waives the VA funding fee', () => {
  assert.equal(impliesFeeExemption({ disability: { value: '30%' } }), true);
  assert.equal(impliesFeeExemption({ disability: { value: '10' } }), true);
  assert.equal(impliesFeeExemption({ disability: { value: '100%' } }), true);
});

test('a rating below the threshold, or none at all, does not', () => {
  assert.equal(impliesFeeExemption({ disability: { value: '0' } }), false);
  assert.equal(impliesFeeExemption({ disability: { value: '' } }), false);
  assert.equal(impliesFeeExemption({}), false);
  assert.equal(impliesFeeExemption(null), false);
});

test('the exemption actually changes the cash-out figure', () => {
  const base = { propertyValue: 400000, firstLien: 270900, program: 'VA', state: 'TN', financeFee: true };
  const withFee = computeEquity(base);
  const waived = computeEquity({ ...base, feeExempt: true });

  assert.ok(waived.estimatedCashToBorrower > withFee.estimatedCashToBorrower);
  assert.equal(waived.estimatedCashToBorrower - withFee.estimatedCashToBorrower, 8419);
});

/* --- output ------------------------------------------------------------- */

test('flattens to plain values for storage', () => {
  const { application } = scenario({ app: { income: '96000' } });
  const plain = toPlain(application);
  assert.equal(plain.income, '96000');
  assert.equal(plain.balance, '$270,900');
  assert.deepEqual(Object.keys(plain), APPLICATION_KEYS);
});

test('renders a readable block with every field present', () => {
  const { application } = scenario({ app: { income: '96000' } });
  const text = toText(application, { heading: 'RANDY D ROLLINS' });

  assert.match(text, /^RANDY D ROLLINS/);
  for (const field of APPLICATION_FIELDS) {
    assert.ok(text.includes(field.label), `${field.label} missing from the block`);
  }
  assert.match(text, /Income:\s+96000/);
  assert.match(text, /W2 \/ 1099:\s+—/, 'empty fields are shown rather than dropped');
});
