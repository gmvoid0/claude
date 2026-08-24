import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSpokenNumber, extractFacts, mergeProposals }
  from '../extension/src/lib/speech.js';

/* --- spoken numbers ----------------------------------------------------- */

test('written figures, with or without a scale word', () => {
  assert.equal(parseSpokenNumber('720'), 720);
  assert.equal(parseSpokenNumber('200,000'), 200000);
  assert.equal(parseSpokenNumber('6.5'), 6.5);
  assert.equal(parseSpokenNumber('200k'), 200000);
  assert.equal(parseSpokenNumber('1.2 million'), 1200000);
  assert.equal(parseSpokenNumber('450 thousand'), 450000);
});

test('number words', () => {
  assert.equal(parseSpokenNumber('two hundred thousand'), 200000);
  assert.equal(parseSpokenNumber('two hundred and fifty thousand'), 250000);
  assert.equal(parseSpokenNumber('ninety six thousand'), 96000);
  assert.equal(parseSpokenNumber('a hundred and eighty thousand'), 180000);
  assert.equal(parseSpokenNumber('twenty five hundred'), 2500);
  assert.equal(parseSpokenNumber('seven hundred twenty'), 720);
});

test('the two-part shorthand people actually use', () => {
  // "seven twenty" is a three-digit figure, never seven and twenty.
  assert.equal(parseSpokenNumber('seven twenty'), 720);
  assert.equal(parseSpokenNumber('four fifty'), 450);
  assert.equal(parseSpokenNumber('eight ten'), 810);
  assert.equal(parseSpokenNumber('six eighty'), 680);
});

test('decimals, spoken both ways', () => {
  assert.equal(parseSpokenNumber('six point five'), 6.5);
  assert.equal(parseSpokenNumber('six and a half'), 6.5);
  assert.equal(parseSpokenNumber('three point two five'), 3.25);
});

test('hedging words are ignored', () => {
  assert.equal(parseSpokenNumber('about two hundred thousand'), 200000);
  assert.equal(parseSpokenNumber('like seven twenty'), 720);
  assert.equal(parseSpokenNumber('roughly ninety six thousand'), 96000);
});

test('non-numbers return null', () => {
  for (const bad of ['', '   ', 'hello there', null, undefined, 'the mortgage']) {
    assert.equal(parseSpokenNumber(bad), null);
  }
});

/* --- what a call actually sounds like ----------------------------------- */

const factFor = (text, field) => extractFacts(text).find((f) => f.field === field);

test('credit score', () => {
  for (const line of [
    'my credit score is seven twenty',
    'my score is about 720',
    "credit score's like seven twenty",
    'I think my FICO is 720',
  ]) {
    const fact = factFor(line, 'fico');
    assert.ok(fact, `no reading from: ${line}`);
    assert.equal(fact.value, 720, `wrong reading from: ${line}`);
  }
});

test('balance owed', () => {
  for (const [line, expected] of [
    ['I owe about two hundred thousand', 200000],
    ['the balance is 200,000', 200000],
    ['we still owe like one eighty', 180000],
    ['my payoff is 245k', 245000],
  ]) {
    const fact = factFor(line, 'balance');
    assert.ok(fact, `no reading from: ${line}`);
    assert.equal(fact.value, expected, `wrong reading from: ${line}`);
  }
});

test('home value, including the under-scaled shorthand', () => {
  assert.equal(factFor("it's worth about four fifty", 'value').value, 450000);
  assert.equal(factFor('the house is worth 450,000', 'value').value, 450000);
  assert.equal(factFor('it appraised at six sixty', 'value').value, 660000);
});

test('income', () => {
  assert.equal(factFor('I make ninety six thousand a year', 'income').value, 96000);
  assert.equal(factFor('my income is about 96,000', 'income').value, 96000);
});

test('rate stays a rate and is never inflated', () => {
  assert.equal(factFor('my rate is six and a half', 'rate').value, 6.5);
  assert.equal(factFor('the interest rate is 6.5', 'rate').value, 6.5);
  assert.equal(factFor('I got a rate of three point two five', 'rate').value, 3.25);
});

test('monthly payment', () => {
  assert.equal(factFor('my payment is about eighteen hundred', 'payment').value, 1800);
  assert.equal(factFor('I pay 2,400 a month', 'payment').value, 2400);
});

test('disability rating', () => {
  assert.equal(factFor("I'm thirty percent service connected", 'disability').value, 30);
  assert.equal(factFor('my disability is 100 percent', 'disability').value, 100);
});

test('loan type and employment come out as choices', () => {
  assert.equal(factFor("it's a VA loan", 'loanType').value, 'VA');
  assert.equal(factFor('I have an FHA', 'loanType').value, 'FHA');
  assert.equal(factFor('conventional I think', 'loanType').value, 'CONV');
  assert.equal(factFor('I get a W2', 'employment').value, 'W2');
  assert.equal(factFor("I'm self-employed", 'employment').value, '1099');
});

/* --- the failure modes that matter -------------------------------------- */

test('a figure is never attached to a field it cannot belong to', () => {
  // 6.5 is a rate; it is not a $6,500 balance or a 6 credit score.
  const facts = extractFacts('my rate is six and a half');
  assert.equal(facts.find((f) => f.field === 'balance'), undefined);
  assert.equal(facts.find((f) => f.field === 'fico'), undefined);
});

test('implausible readings are dropped rather than proposed', () => {
  // A score of 12 is not a score, so nothing should be offered.
  assert.equal(factFor('my credit score is twelve', 'fico'), undefined);
  // Nor is a two-dollar house a house.
  assert.equal(factFor('the house is worth two dollars', 'value'), undefined);
});

test('a sentence with no numbers proposes nothing', () => {
  assert.deepEqual(extractFacts('yeah that sounds good let me think about it'), []);
  assert.deepEqual(extractFacts(''), []);
});

test('several facts in one breath are all picked up', () => {
  const facts = extractFacts(
    "so I owe about two hundred thousand, my score is seven twenty, and it's a VA loan",
  );
  const byField = Object.fromEntries(facts.map((f) => [f.field, f.value]));

  assert.equal(byField.balance, 200000);
  assert.equal(byField.fico, 720);
  assert.equal(byField.loanType, 'VA');
});

test('each reading carries the words it came from', () => {
  const fact = factFor('my credit score is seven twenty', 'fico');
  assert.match(fact.evidence, /score/);
  assert.match(fact.evidence, /seven twenty/);
  assert.ok(fact.confidence > 0 && fact.confidence <= 1);
});

test('an inferred scale is reported with lower confidence than a stated one', () => {
  const stated = factFor('I owe two hundred thousand', 'balance');
  const inferred = factFor('I owe about one eighty', 'balance');
  assert.ok(inferred.confidence < stated.confidence,
    'a figure whose magnitude was inferred should be trusted less');
});

/* --- accumulating across a call ----------------------------------------- */

test('a corrected figure replaces the earlier one', () => {
  // People correct themselves; the last thing said is what they meant.
  const first = extractFacts('my score is seven twenty');
  const second = extractFacts('sorry, my score is actually 680');
  const merged = mergeProposals(first, second);

  assert.equal(merged.filter((p) => p.field === 'fico').length, 1);
  assert.equal(merged.find((p) => p.field === 'fico').value, 680);
});

test('a proposal already dealt with does not come back', () => {
  const facts = extractFacts('my score is seven twenty');
  const resolved = new Set(['fico:720']);
  assert.deepEqual(mergeProposals([], facts, { resolved }), []);
});

test('proposals for different fields accumulate', () => {
  let pending = mergeProposals([], extractFacts('I owe two hundred thousand'));
  pending = mergeProposals(pending, extractFacts('my score is seven twenty'));
  pending = mergeProposals(pending, extractFacts("it's a VA loan"));

  assert.deepEqual(pending.map((p) => p.field).sort(), ['balance', 'fico', 'loanType']);
});
