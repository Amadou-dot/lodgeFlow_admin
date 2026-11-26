const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const { devNull, tmpdir } = require('node:os');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { scanSyntax } = require('./syntax.cjs');
const inventoryCommand = require.resolve('./inventory.cjs');

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
    file + ' groups a single expression cast beneath an annotated declaration',
    () => {
      const code = `
      /** @type {unknown} */ const x = (/** @type {unknown} */ (123));
      if (typeof x === "number") x.toFixed();
    `;
      assert.deepEqual(scanSyntax(file, code), []);
      const incompatible =
        '/** @type {string} */ const text = (/** @type {unknown} */ (123));';
      assert.deepEqual(scanSyntax(file, incompatible), []);
    }
  );

  test(
    file + ' uses the effective directly attached expression annotation',
    () => {
      const cast = annotations =>
        'const x = /** @type {string} */ (' + annotations + ' (123));';
      assert.deepEqual(
        scanSyntax(file, cast('/** @type {unknown} */ /** @type {number} */')),
        []
      );
      assert.deepEqual(
        scanSyntax(
          file,
          cast('/** @type {number} */ /** @type {unknown} */')
        ).map(row => row.rule),
        ['double-cast']
      );
    }
  );

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
  const temp = fs.mkdtempSync(join(tmpdir(), 'lodgeflow-inventory-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const root = join(temp, 'fixture');
  const callerIndex = join(temp, 'caller.index');
  const previousIndex = process.env.GIT_INDEX_FILE;
  process.env.GIT_INDEX_FILE = callerIndex;
  t.after(() => {
    if (previousIndex === undefined) delete process.env.GIT_INDEX_FILE;
    else process.env.GIT_INDEX_FILE = previousIndex;
  });
  fs.mkdirSync(join(root, 'apps/admin'), { recursive: true });
  fs.mkdirSync(join(root, 'docs/refactoring'), { recursive: true });
  const file = join(root, 'apps/admin/fixture.ts');
  const snapshot = join(root, 'docs/refactoring/inventory-current.json');
  const options = {
    cwd: root,
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !key.toUpperCase().startsWith('GIT_')
        )
      ),
      GIT_CEILING_DIRECTORIES: temp,
      GIT_CONFIG_GLOBAL: devNull,
      GIT_CONFIG_NOSYSTEM: '1',
    },
  };
  execFileSync('git', ['init', '--quiet', '--template='], options);
  fs.writeFileSync(
    file,
    "interface Booking { createdAt?: Date | null; state?: 'in progress' | null }"
  );
  execFileSync('git', ['add', 'apps/admin/fixture.ts'], options);
  fs.writeFileSync(snapshot, JSON.stringify({ findings: [] }));
  function refresh() {
    execFileSync(process.execPath, [inventoryCommand, '--refresh'], options);
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
  assert.equal(
    fs.existsSync(callerIndex),
    false,
    'the caller-selected index must remain untouched'
  );
  assert.ok(fs.statSync(join(root, '.git/index')).isFile());
});
