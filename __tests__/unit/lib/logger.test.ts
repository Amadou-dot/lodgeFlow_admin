/**
 * Logger reads NODE_ENV when the module is instantiated, so each test loads a
 * fresh copy under the desired environment via jest.isolateModules.
 */

type LoggerInstance = typeof import('@/lib/logger').logger;

function loadLogger(nodeEnv: string): LoggerInstance {
  const originalEnv = process.env.NODE_ENV;
  let logger: LoggerInstance;

  Object.defineProperty(process.env, 'NODE_ENV', {
    value: nodeEnv,
    configurable: true,
    writable: true,
  });
  try {
    jest.isolateModules(() => {
      logger = require('@/lib/logger').logger;
    });
  } finally {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      configurable: true,
      writable: true,
    });
  }

  return logger!;
}

describe('logger', () => {
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('is silent in the test environment', () => {
    const logger = loadLogger('test');

    logger.info('info');
    logger.warn('warn');
    logger.error('error');
    logger.debug('debug');

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('logs structured data in development', () => {
    const logger = loadLogger('development');

    logger.info('hello', { requestId: 'abc' });

    expect(warnSpy).toHaveBeenCalledWith(
      '[INFO]',
      expect.objectContaining({
        level: 'info',
        message: 'hello',
        requestId: 'abc',
      }),
      { requestId: 'abc' }
    );
  });

  it('logs plain messages in production', () => {
    const logger = loadLogger('production');

    logger.warn('careful', { requestId: 'abc' });

    expect(warnSpy).toHaveBeenCalledWith('careful', { requestId: 'abc' });
  });

  it('includes the stack for Error objects in development', () => {
    const logger = loadLogger('development');
    const error = new Error('boom');

    logger.error('failed', error);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'failed',
        error: 'boom',
        stack: expect.stringContaining('boom'),
      }),
      expect.objectContaining({ error: 'boom' })
    );
  });

  it('omits the stack in production', () => {
    const logger = loadLogger('production');
    const error = new Error('boom');

    logger.error('failed', error);

    expect(errorSpy).toHaveBeenCalledWith(
      'failed',
      expect.objectContaining({ error: 'boom', stack: undefined })
    );
  });

  it('stringifies non-Error values passed to error()', () => {
    const logger = loadLogger('development');

    logger.error('failed', 'raw failure');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'raw failure' }),
      expect.objectContaining({ error: 'raw failure' })
    );
  });

  it('emits debug logs only in development', () => {
    const devLogger = loadLogger('development');
    devLogger.debug('dev debug');
    expect(warnSpy).toHaveBeenCalledWith(
      '[DEBUG]',
      expect.objectContaining({ message: 'dev debug' })
    );

    warnSpy.mockClear();

    const prodLogger = loadLogger('production');
    prodLogger.debug('prod debug');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
