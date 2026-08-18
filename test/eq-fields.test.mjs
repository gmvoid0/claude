/**
 * The application, restated as Easy Qualifier's form.
 *
 * The point of this file is that an agent reads down the panel and types
 * into EQ. So the names have to be EQ's, the order has to be EQ's, and
 * anything not actually known has to look unknown.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { eqFields, eqFieldsText } from '../extension/src/lib/eq-fields.js';
import { sizeLoan } from '../extension/src/lib/sizing.js';

const field = (rows, key) => rows.find((r) => r.key === key);

function scenario(overrides = {}) {
  const application = {
    fullName: { value: 'RANDY D ROLLINS' },
    value: { value: '$400,000' },
    balance: { value: '$270,900' },
    cashOut: { value: '$96,000' },
    fico: { value: '712' },
    income: { value: '$7,400' },
    monthlyDebt: { value: '$950' },
    loanType: { value: 'CONV' },
    occupancy: { value: 'Primary Residence' },
    propertyType: { value: 'Single family residence' },
    employment: { value: 'W2' },
    ...overrides.application,
  };
  const sizing = sizeLoan({ annualPropertyTax: 1733, payoff: 270900, cashOut: 96000 });
  return eqFields({
    application,
    sizing,
    inputs: { zip: { value: '37854' }, secondLien: { num: null }, ...overrides.inputs },
    tax: { amount: 1733, year: 2025, source: 'Zillow' },
    rules: { insuranceAllowance: 1000 },
    ...overrides.top,
  });
}

test('the fields carry Easy Qualifier names, in Easy Qualifier order', () => {
  // "Appraised Value", not "Home value". Renaming a field halfway through a
  // call is how a payoff lands in a cash-out box.
  const rows = scenario();
  assert.deepEqual(rows.map((r) => r.eq), [
    'Borrower Name',
    'Loan Type',
    'Loan Purpose',
    'Refinance Purpose',
    'Appraised Value',
    'Loan Amount',
    'Second Loan Amount',
    'Occupancy',
    'Property Type',
    'ZIP Code',
    'Qualifying Credit Score',
    'Borrower Income',
    'Monthly Debt',
    'Taxes (annual)',
    'Homeowners Insurance (annual)',
    'Employment Options',
  ]);
});

test('what the application knows comes across as typed', () => {
  const rows = scenario();
  assert.equal(field(rows, 'borrowerName').value, 'RANDY D ROLLINS');
  assert.equal(field(rows, 'appraisedValue').value, '$400,000');
  assert.equal(field(rows, 'creditScore').value, '712');
  assert.equal(field(rows, 'income').value, '$7,400');
  assert.equal(field(rows, 'monthlyDebt').value, '$950');
  assert.equal(field(rows, 'zip').value, '37854');
  assert.equal(field(rows, 'occupancy').value, 'Primary Residence');
});

test('the loan amount is the one calculated figure, and says so', () => {
  const rows = scenario();
  const loan = field(rows, 'loanAmount');
  assert.equal(loan.value, '$385,503');
  assert.equal(loan.kind, 'computed');
  assert.match(loan.note, /x 1\.035/);
  assert.equal(loan.required, true);
});

test('a loan type is translated into the word Easy Qualifier uses', () => {
  // Its list is confirmed from the live capture: Conventional, not CONV.
  assert.equal(field(scenario(), 'loanType').value, 'Conventional');
  for (const [ours, theirs] of [['VA', 'VA'], ['FHA', 'FHA'], ['USDA', 'USDA']]) {
    const rows = scenario({ application: { loanType: { value: ours } } });
    assert.equal(field(rows, 'loanType').value, theirs);
  }
});

test('a loan type EQ has no word for is left empty and named', () => {
  // Lead screens carry all sorts in that column, including an agent ID once.
  const rows = scenario({ application: { loanType: { value: 'HELOC' } } });
  assert.equal(field(rows, 'loanType').value, null);
  assert.match(field(rows, 'loanType').note, /HELOC.*not one of EQ/);
});

test('cash-out decides the refinance purpose', () => {
  assert.equal(field(scenario(), 'refinancePurpose').value, 'Cash Out');
  const rateTerm = scenario({ application: { cashOut: { value: '0' } } });
  assert.equal(field(rateTerm, 'refinancePurpose').value, 'Rate/Term');
});

test('the assumed figures are marked as assumptions, not readings', () => {
  // The $1,000 insurance premium is a guess with a number on it, and it is
  // already inside the escrow line of the loan amount. An agent should see
  // it sitting there rather than find out later.
  const rows = scenario();
  const insurance = field(rows, 'annualInsurance');
  assert.equal(insurance.value, '$1,000');
  assert.equal(insurance.kind, 'assumed');
  assert.match(insurance.note, /escrow line/);

  assert.equal(field(rows, 'loanPurpose').kind, 'assumed');
  assert.equal(field(rows, 'borrowerName').kind, 'read');
});

test('a dropdown whose wording is not confirmed is flagged rather than asserted', () => {
  // Only Loan Type came back from the live capture. Filling "Self-employed"
  // into a list that says "Self Employed" is a fill that silently does
  // nothing, which is worse than leaving it to the agent.
  const rows = scenario();
  assert.equal(field(rows, 'loanType').checkList, false, 'this one is confirmed');
  for (const key of ['loanPurpose', 'refinancePurpose', 'occupancy', 'propertyType', 'employment']) {
    assert.equal(field(rows, key).checkList, true, key);
  }
});

test('a required field nothing can fill is still listed, empty', () => {
  // Visible before the quote comes back wrong, rather than after.
  const rows = eqFields({ application: {}, sizing: null, inputs: {}, tax: null });
  const name = rows.find((r) => r.key === 'borrowerName');
  assert.equal(name.value, null);
  assert.equal(name.missing, true);
  assert.equal(name.required, true);

  const loan = rows.find((r) => r.key === 'loanAmount');
  assert.equal(loan.value, null);
  assert.match(loan.note, /waiting on/);
});

test('the tax line names the year and where it was read', () => {
  const rows = scenario();
  assert.equal(field(rows, 'annualTaxes').value, '$1,733');
  assert.match(field(rows, 'annualTaxes').note, /2025, from Zillow/);

  const none = eqFields({ application: {}, sizing: null, inputs: {}, tax: null });
  assert.match(none.find((r) => r.key === 'annualTaxes').note, /not read yet/);

  // A figure the agent typed says so, rather than claiming Zillow said it.
  const typed = eqFields({
    application: {}, sizing: null, inputs: {}, tax: { amount: 1733, source: 'typed' },
  });
  assert.match(typed.find((r) => r.key === 'annualTaxes').note, /entered by hand/);
});

test('the list copies as one field per line', () => {
  const text = eqFieldsText(scenario());
  assert.match(text, /Borrower Name:\s+RANDY D ROLLINS/);
  assert.match(text, /Loan Amount:\s+\$385,503/);
  assert.match(text, /Second Loan Amount:\s+—/, 'an empty field is visibly empty');
});
