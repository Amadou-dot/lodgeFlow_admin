const assert = require('node:assert/strict');
const test = require('node:test');
const { scanSyntax } = require('./syntax.cjs');

for (const [file, code, rules] of [
  ['fixture.ts', 'const a: any = 0; type B = Promise<any>;', ['any', 'any']],
  ['fixture.cjs', '/** @param {Array<any>} a */\nfunction f(a) {}', ['any']],
  ['fixture.js', '/** @type {any} */\nconst x = 0;', ['any']],
  ['fixture.ts', '((x as (unknown))) as string;', ['double-cast']],
  ['fixture.ts', '<string>(<(unknown)>x);', ['double-cast']],
  [
    'fixture.ts',
    'const value: unknown = "as unknown as any"; /* any */ if (typeof value === "string") value.trim();',
    [],
  ],
  ['fixture.js', '// @type {any}\nconst text = "/** @type {any} */";', []],
]) {
  test(file + ' ' + code, () => {
    assert.deepEqual(
      scanSyntax(file, code).map(item => item.rule),
      rules
    );
  });
}
