import test from 'node:test';
import assert from 'node:assert/strict';

import { splitName, joinName } from '../extension/src/lib/names.js';

test('the last word is the surname, everything before it the given name', () => {
  // This is what the dialer already does: First "RANDY D", Last "ROLLINS".
  assert.deepEqual(splitName('RANDY D ROLLINS'), { first: 'RANDY D', last: 'ROLLINS', suffix: '' });
  assert.deepEqual(splitName('JAMES KILGORE'), { first: 'JAMES', last: 'KILGORE', suffix: '' });
  assert.equal(splitName('Mary Anne Elizabeth Smith').last, 'Smith');
});

test('a name round-trips through the split unchanged', () => {
  for (const name of ['RANDY D ROLLINS', 'JAMES KILGORE', 'JANE ROLLINS']) {
    assert.equal(joinName(splitName(name)), name);
  }
});

test('suffixes stay with the surname rather than becoming one', () => {
  assert.deepEqual(splitName('JOHN SMITH JR'), { first: 'JOHN', last: 'SMITH', suffix: 'JR' });
  assert.deepEqual(splitName('ROBERT E LEE III'), { first: 'ROBERT E', last: 'LEE', suffix: 'III' });
  assert.equal(splitName('ANNA PATEL MD').last, 'PATEL');
});

test('"Last, First" is not silently reversed', () => {
  assert.deepEqual(splitName('ROLLINS, RANDY D'), { first: 'RANDY D', last: 'ROLLINS', suffix: '' });
  assert.equal(splitName('SMITH, JOHN JR').last, 'SMITH');
});

test('surname particles are kept together', () => {
  assert.deepEqual(splitName('RANDY VAN DYKE'), { first: 'RANDY', last: 'VAN DYKE', suffix: '' });
  assert.equal(splitName('MARIA DE LA CRUZ').last, 'DE LA CRUZ');
});

test('a single word is a given name, not a surname', () => {
  assert.deepEqual(splitName('CHER'), { first: 'CHER', last: '', suffix: '' });
});

test('empty input produces empty parts rather than throwing', () => {
  for (const bad of ['', '   ', null, undefined]) {
    assert.deepEqual(splitName(bad), { first: '', last: '', suffix: '' });
  }
  assert.equal(joinName(), '');
  assert.equal(joinName({}), '');
});
