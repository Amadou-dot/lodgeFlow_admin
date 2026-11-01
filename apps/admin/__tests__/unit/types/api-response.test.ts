import path from 'node:path';
import ts from 'typescript';

const appRoot = path.resolve(__dirname, '../../..');
const fixturePath = path.join(appRoot, '__tests__/api-response.fixture.ts');
const config = ts.readConfigFile(
  path.join(appRoot, 'tsconfig.json'),
  ts.sys.readFile
);
if (config.error) throw new Error('Unable to read the admin TypeScript config');
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, appRoot);

function compileFixture(source: string) {
  const options = { ...parsed.options, incremental: false };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, createNew) =>
    fileName === fixturePath
      ? ts.createSourceFile(fileName, source, languageVersion, true)
      : getSourceFile(fileName, languageVersion, onError, createNew);
  const program = ts.createProgram([fixturePath], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
    .map(diagnostic => ({
      code: diagnostic.code,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    }));
}

test('response success narrows to required data and failure to its error', () => {
  expect(
    compileFixture(`
      import type { ApiAcknowledgement, ApiResponse } from '@/types/api-response';
      import type { CustomersResponse, CustomerLockResponse, CustomerUnlockResponse } from '@/types/customer-responses';
      export function resultValue(result: ApiResponse<{ id: string }>): string {
        if (!result.success) return result.error;
        return result.data.id;
      }
      export const empty: ApiResponse<null> = { success: true, data: null };
      export const denied: ApiResponse<never> = { success: false, error: 'Denied' };
      export const deleted: ApiAcknowledgement = { success: true, message: 'Deleted' };
      export const listDenied: CustomersResponse = { success: false, error: 'Denied' };
      export const locked: CustomerLockResponse = { success: true, data: { locked: true, lockedAt: '2030-01-01T00:00:00.000Z' } };
      export const unlocked: CustomerUnlockResponse = { success: true, data: { locked: false, unlockedAt: '2030-01-01T00:00:00.000Z' } };
    `)
  ).toEqual([]);
}, 30000);

test('response construction rejects missing and contradictory fields', () => {
  const errors = compileFixture(`
    import type { ApiAcknowledgement, ApiResponse } from '@/types/api-response';
    import type { CustomersResponse, CustomerLockResponse, CustomerUnlockResponse } from '@/types/customer-responses';
    export const missingData: ApiResponse<number> = { success: true };
    export const missingError: ApiResponse<number> = { success: false };
    export const successError: ApiResponse<number> = { success: true, data: 1, error: 'Rejected' };
    export const failureData: ApiResponse<number> = { success: false, error: 'Denied', data: 1 };
    export const uncertain: ApiResponse<number> = { success: Math.random() > 0.5, data: 1 };
    export const acknowledgementData: ApiAcknowledgement = { success: true, data: null };
    export const missingPagination: CustomersResponse = { success: true, data: [] };
    export const incorrectLock: CustomerLockResponse = { success: true, data: { locked: false, lockedAt: '2030-01-01T00:00:00.000Z' } };
    export const incorrectUnlock: CustomerUnlockResponse = { success: true, data: { locked: false, lockedAt: '2030-01-01T00:00:00.000Z' } };
  `);
  expect(errors).toHaveLength(9);
  expect(errors.every(error => [2322, 2353, 2561].includes(error.code))).toBe(
    true
  );
}, 30000);
