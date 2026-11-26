const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const { join } = require('node:path');
const { scanSyntax } = require('./syntax.cjs');

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();
const files = execFileSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\0')
  .filter(file => /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(file));
const originalScope = file =>
  /^(apps\/(admin|customer)|packages\/database)\//.test(file) &&
  !/\.d\.ts$|(?:^|\/)(?:node_modules|\.next|dist|build|coverage|generated)\//.test(
    file
  );
const covered = file => /^apps\/admin\/(?:__tests__|scripts)\//.test(file);
const forbidden = finding => ['any', 'double-cast'].includes(finding.rule);
const mode = process.argv[2];
if (!['--check', '--refresh'].includes(mode))
  throw new Error('Choose --check or --refresh');

const findings = [];
const broad = {
  files: files.length,
  explicitAny: 0,
  chainedUnknownAssertions: 0,
};
const digest = createHash('sha256');
for (const file of files) {
  if (mode === '--check' && !covered(file)) continue;
  const source = fs.readFileSync(join(root, file));
  const scanned = scanSyntax(file, source.toString('utf8'));
  if (mode === '--check') {
    findings.push(...scanned.filter(forbidden));
  } else {
    broad.explicitAny += scanned.filter(
      finding => finding.rule === 'any'
    ).length;
    broad.chainedUnknownAssertions += scanned.filter(
      finding => finding.rule === 'double-cast'
    ).length;
    if (originalScope(file)) {
      digest.update(file).update('\0').update(source).update('\0');
      findings.push(...scanned);
    }
  }
}
if (mode === '--check') {
  for (const { file, line, column, rule } of findings)
    console.error(`${file}:${line}:${column} ${rule}`);
  console.log(
    `Checked ${files.filter(covered).length} tracked admin test/script files; ${findings.length} prohibited nodes.`
  );
  process.exitCode = findings.length ? 1 : 0;
} else {
  const destination = join(root, 'docs/refactoring/inventory-current.json');
  const previous = JSON.parse(fs.readFileSync(destination, 'utf8'));
  const identity = finding =>
    JSON.stringify([finding.file, finding.rule, finding.owner, finding.syntax]);
  const dispositions = new Map(
    previous.findings.map(item => [identity(item), item.disposition])
  );
  for (const finding of findings)
    finding.disposition =
      dispositions.get(identity(finding)) ?? 'REVIEW REQUIRED';
  const counts = Object.fromEntries(
    [
      'any',
      'double-cast',
      'same-type-positionals',
      'mixed-representation',
      'optional-null',
      'document-interface',
      'record-index',
    ].map(rule => [
      rule,
      findings.filter(finding => finding.rule === rule).length,
    ])
  );
  const inventory = {
    baseline: 'inventory-candidates.json',
    sourceScope:
      'Tracked ts, tsx, js, jsx, mjs, cjs in apps/admin, apps/customer and packages/database. Excludes .d.ts and node_modules, .next, dist, build, coverage and generated directories.',
    digestMethod:
      'SHA-256 over git ls-files order: path, NUL, working-tree file bytes, NUL.',
    filesScanned: files.filter(originalScope).length,
    sourceDigestSha256: digest.digest('hex'),
    counts,
    workspaceO01: broad,
    findings,
  };
  fs.writeFileSync(destination, JSON.stringify(inventory, null, 2) + '\n');
  console.log(
    JSON.stringify({
      counts,
      broad,
      pendingReview: findings.filter(f => f.disposition === 'REVIEW REQUIRED')
        .length,
    })
  );
}
