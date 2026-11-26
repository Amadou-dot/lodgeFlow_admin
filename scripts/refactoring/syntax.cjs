const { createRequire } = require('node:module');
const ts = createRequire(require.resolve('../../apps/admin/package.json'))(
  'typescript'
);

const isAssertion = node =>
  ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);
// Emit a complete declaration with stable whitespace, punctuation and literal quoting.
const declarationPrinter = ts.createPrinter(
  { removeComments: true },
  {
    substituteNode: (_hint, node) =>
      ts.isStringLiteral(node)
        ? ts.factory.createStringLiteral(node.text)
        : node,
  }
);

function assertedType(node) {
  if (isAssertion(node)) return node.type;
  if (
    ts.isParenthesizedExpression(node) &&
    node.flags & ts.NodeFlags.JavaScriptFile
  )
    return ts.getJSDocTypeTag(node)?.typeExpression?.type;
}

function bareType(node) {
  while (node && ts.isParenthesizedTypeNode(node)) node = node.type;
  return node;
}
function bareExpression(node) {
  while (ts.isParenthesizedExpression(node) && !assertedType(node))
    node = node.expression;
  return node;
}

function scanSyntax(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const findings = [];
  const seen = new Set();
  function add(node, rule, syntax = node.getText(source)) {
    const { line, character } = source.getLineAndCharacterOfPosition(
      node.getStart(source)
    );
    let owner = node.parent;
    while (
      owner &&
      !(
        ts.isInterfaceDeclaration(owner) ||
        ts.isTypeAliasDeclaration(owner) ||
        ts.isFunctionDeclaration(owner) ||
        ts.isVariableDeclaration(owner)
      )
    )
      owner = owner.parent;
    findings.push({
      file,
      line: line + 1,
      column: character + 1,
      rule,
      owner: owner?.name?.getText(source) ?? '<module>',
      syntax,
    });
  }
  function visit(node) {
    if (seen.has(node)) return;
    seen.add(node);
    if (node.kind === ts.SyntaxKind.AnyKeyword) add(node, 'any');
    if (assertedType(node)) {
      const inner = bareExpression(node.expression);
      if (bareType(assertedType(inner))?.kind === ts.SyntaxKind.UnknownKeyword)
        add(node, 'double-cast');
    }
    if (node.parameters) {
      const primitives = [
        ts.SyntaxKind.StringKeyword,
        ts.SyntaxKind.NumberKeyword,
        ts.SyntaxKind.BooleanKeyword,
      ];
      for (let i = 1; i < node.parameters.length; i++) {
        const left = node.parameters[i - 1];
        const right = node.parameters[i];
        const kind = bareType(left.type)?.kind;
        if (primitives.includes(kind) && bareType(right.type)?.kind === kind)
          add(right, 'same-type-positionals');
      }
    }
    if (ts.isUnionTypeNode(node)) {
      const types = node.types.map(type => bareType(type).getText(source));
      if (
        types.includes('string') &&
        (types.includes('number') || types.includes('Date'))
      )
        add(node, 'mixed-representation');
    }
    if (
      ts.isPropertySignature(node) &&
      node.questionToken &&
      bareType(node.type) &&
      ts.isUnionTypeNode(bareType(node.type)) &&
      bareType(node.type).types.some(
        type => bareType(type).getText(source) === 'null'
      )
    )
      add(
        node.name,
        'optional-null',
        declarationPrinter.printNode(ts.EmitHint.Unspecified, node, source)
      );
    if (
      ts.isInterfaceDeclaration(node) &&
      node.heritageClauses?.some(clause =>
        clause.types.some(type =>
          ['Document', 'mongoose.Document'].includes(
            type.expression.getText(source)
          )
        )
      )
    )
      add(node.name, 'document-interface');
    if (ts.isElementAccessExpression(node)) {
      const target = bareExpression(node.expression);
      if (
        isAssertion(target) &&
        /^Record\s*<\s*string\s*,\s*unknown\s*>$/.test(
          bareType(target.type).getText(source)
        )
      )
        add(node, 'record-index');
    }
    for (const doc of node.jsDoc ?? []) visit(doc);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}

module.exports = { scanSyntax };
