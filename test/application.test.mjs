import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APPLICATION_FIELDS, APPLICATION_KEYS, CO_BORROWER_KEYS, SAVE_THRESHOLD,
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

  // Cash-out is deliberately NOT filled — see the dedicated test below.
  assert.equal(application.cashOut.value, '');
});

test('cash-out is never pre-filled with the maximum', () => {
  // The headline figure is the ceiling the equity supports. Most borrowers
  // take a fraction of it, so writing it onto the application would record a
  // request nobody made.
  const { result, application } = scenario();

  assert.ok(result.estimatedCashToBorrower > 0, 'there is a ceiling to show');
  assert.equal(application.cashOut.value, '', 'but the field stays empty');
  assert.equal(application.cashOut.source, 'none');
  assert.equal(application.cashOut.placeholder, 'up to $120,681',
    'the ceiling is offered as guidance, not as an answer');
});

test('an entered cash-out is kept exactly as typed', () => {
  const { application } = scenario({ app: { cashOut: '25000' } });
  assert.equal(application.cashOut.value, '25000');
  assert.equal(application.cashOut.source, 'manual');
});

test('no ceiling hint when there is no cash available', () => {
  const { application } = scenario({ manual: { propertyValue: '200000' } });
  assert.equal(application.cashOut.placeholder, '');
});

test('fields with no source stay empty and are marked as such', () => {
  const { application } = scenario();
  for (const key of ['income', 'employment', 'disability', 'cashOut']) {
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

/* --- the co-borrower ---------------------------------------------------- */

test('only the fields that differ per person appear on the co-borrower', () => {
  // Rate, balance, value, payment and loan type belong to the property and
  // the loan. Repeating them would invite two answers to one question.
  assert.deepEqual(CO_BORROWER_KEYS,
    ['coName', 'coFico', 'coIncome', 'coEmployment', 'coDisability', 'coPhone']);

  for (const key of ['rate', 'balance', 'value', 'payment', 'loanType', 'cashOut', 'address']) {
    assert.ok(!CO_BORROWER_KEYS.includes(`co${key[0].toUpperCase()}${key.slice(1)}`),
      `${key} must not be duplicated onto the co-borrower`);
  }
});

test('the co-borrower is absent until asked for', () => {
  const { inputs, result } = scenario();
  const without = buildApplication({ inputs, result, manual: {} });
  for (const key of CO_BORROWER_KEYS) {
    assert.equal(without[key], undefined);
  }

  const withCo = buildApplication({ inputs, result, manual: {}, coBorrower: true });
  for (const key of CO_BORROWER_KEYS) {
    assert.ok(withCo[key], `${key} should exist once the section is on`);
  }
});

test('nothing on the co-borrower is ever filled in automatically', () => {
  // No lead screen carries a second borrower, so inventing a source for one
  // would be worse than an empty field.
  const { inputs, result } = scenario();
  const application = buildApplication({ inputs, result, manual: {}, coBorrower: true });

  for (const key of CO_BORROWER_KEYS) {
    assert.equal(application[key].value, '', `${key} must start empty`);
    assert.equal(application[key].source, 'none');
  }
});

test('co-borrower entries count toward saving', () => {
  const { inputs, result } = scenario();
  const application = buildApplication({
    inputs, result, coBorrower: true,
    manual: { coName: 'JANE ROLLINS', coFico: '698', coIncome: '54000' },
  });

  assert.equal(application.coName.source, 'manual');
  assert.equal(isWorthSaving(application), true);
});

test('a co-borrower disability waives the funding fee too', () => {
  // The exemption follows the veteran, and the veteran may be either borrower.
  assert.equal(impliesFeeExemption({ coDisability: { value: '40%' } }), true);
  assert.equal(impliesFeeExemption({ disability: { value: '' }, coDisability: { value: '30' } }), true);
  assert.equal(impliesFeeExemption({ coDisability: { value: '0' } }), false);
});

test('the co-borrower is written out under its own heading', () => {
  const { inputs, result } = scenario();
  const application = buildApplication({
    inputs, result, coBorrower: true,
    manual: { coName: 'JANE ROLLINS', coFico: '698' },
  });

  const text = toText(application, { heading: 'RANDY D ROLLINS' });
  assert.match(text, /CO-BORROWER/);
  assert.match(text, /JANE ROLLINS/);
  assert.ok(text.indexOf('CO-BORROWER') > text.indexOf('Mortgage balance'),
    'the primary borrower comes first');

  const plain = toPlain(application);
  assert.equal(plain.coName, 'JANE ROLLINS');
  assert.equal(plain.coFico, '698');
});

test('no co-borrower heading when there is no co-borrower', () => {
  const { application } = scenario();
  assert.ok(!toText(application).includes('CO-BORROWER'));
  assert.equal('coName' in toPlain(application), false);
});
