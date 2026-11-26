const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
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

for (const file of ['fixture.js', 'fixture.cjs']) {
  test(file + ' rejects a JSDoc cast through unknown', () => {
    const code =
      'const result = /** @type {{ field: string }} */ (/** @type {unknown} */ (123));';
    assert.deepEqual(
      scanSyntax(file, code).map(item => item.rule),
      ['double-cast']
    );
  });

  test(file + ' rejects a JSDoc cast separated by ordinary parentheses', () => {
    const code =
      'const x = /** @type {string} */ (((/** @type {(unknown)} */ (((123))))));';
    assert.deepEqual(
      scanSyntax(file, code).map(item => item.rule),
      ['double-cast']
    );
  });

  test(
    file + ' allows a checked declaration and ordinary unknown narrowing',
    () => {
      const code = `
      /** @type {unknown} */ const input = (123);
      const value = /** @type {unknown} */ (input);
      if (typeof value === 'number') value.toFixed();
      /** @type {number} */ const result = (1);
    `;
      assert.deepEqual(scanSyntax(file, code), []);
    }
  );
}

test('refresh carries forward unchanged field declarations and reopens changed ones', t => {
  const root = fs.mkdtempSync(join(tmpdir(), 'lodgeflow-inventory-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(join(root, 'apps/admin'), { recursive: true });
  fs.mkdirSync(join(root, 'docs/refactoring'), { recursive: true });
  const file = join(root, 'apps/admin/fixture.ts');
  const snapshot = join(root, 'docs/refactoring/inventory-current.json');
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  fs.writeFileSync(
    file,
    "interface Booking { createdAt?: Date | null; state?: 'in progress' | null }"
  );
  execFileSync('git', ['add', 'apps/admin/fixture.ts'], { cwd: root });
  fs.writeFileSync(snapshot, JSON.stringify({ findings: [] }));
  function refresh() {
    execFileSync(
      process.execPath,
      [require.resolve('./inventory.cjs'), '--refresh'],
      { cwd: root }
    );
    return JSON.parse(fs.readFileSync(snapshot, 'utf8'));
  }
  const before = refresh();
  assert.equal(before.findings.length, 2);
  before.findings[0].disposition = 'Serialize present Date values';
  before.findings[1].disposition = 'Keep the stored state label';
  fs.writeFileSync(snapshot, JSON.stringify(before));

  fs.writeFileSync(
    file,
    '\ninterface Booking {\n  createdAt?: /* stored instant */ Date\n | null\n  state?: "in progress" | null;\n}'
  );
  const retained = refresh();
  assert.deepEqual(
    retained.findings.map(row => row.disposition),
    before.findings.map(row => row.disposition)
  );
  assert.notEqual(retained.sourceDigestSha256, before.sourceDigestSha256);
  fs.writeFileSync(
    file,
    "interface Booking { createdAt?: string | null; state?: 'in  progress' | null }"
  );
  const changed = refresh();
  assert.deepEqual(
    changed.findings.map(row => row.disposition),
    ['REVIEW REQUIRED', 'REVIEW REQUIRED']
  );
  assert.notEqual(changed.findings[0].syntax, before.findings[0].syntax);
});
