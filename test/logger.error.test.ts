import Logger from '../src/logger';

describe('Logger.error', () => {
  afterAll(() => {
    const logger = new Logger('error-logger', { config: { writeToConsole: true, tracerConfig: { useTracer: true } } });

    logger.closeTracer();
  });
  test('Should use console.error if logging to console enabled', async () => {
    const logger = new Logger('error-logger', { config: { writeToConsole: true, tracerConfig: { useTracer: false } } });
    const consoleSpy = jest.spyOn(console, 'error');

    logger.error('error', { err: 'test error output to console' });

    expect(consoleSpy).toBeCalled();
    logger.finish();
  });

  test('Should accept error as a first parameter, and properly log it', async () => {
    const logger = new Logger('error-logger', {
      config: { writeToConsole: false, tracerConfig: { useTracer: false } },
    });
    const loggerSpy = jest.spyOn(logger as any, 'write');

    const error = new Error('Oh crap!');
    logger.error(error, { err: 'err' });

    expect(loggerSpy).toHaveBeenCalledWith('error', { err: error, type: 'error' }, undefined);
    logger.finish();
  });
});
