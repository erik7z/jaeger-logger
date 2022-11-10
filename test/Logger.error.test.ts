import Logger from '../src/logger';
describe('Logger.error', () => {
  test('Should use console.error if logging to console enabled', () => {
    const logger = new Logger('test', { config: { writeToConsole: true, tracerConfig: { useTracer: false } } });
    const consoleSpy = jest.spyOn(console, 'error');

    logger.error('error', { err: 'test error output to console' });

    expect(consoleSpy).toBeCalled();
    logger.finish();
  });

  test('Should accept error as a first parameter, and properly log it', () => {
    const logger = new Logger('test', { config: { writeToConsole: false, tracerConfig: { useTracer: false } } });
    const loggerSpy = jest.spyOn(logger, 'write');

    const err = new Error('Oh crap!');
    logger.error(err, { err: 'err' });

    expect(loggerSpy).toHaveBeenCalledWith('error', { err, type: 'error' }, undefined);
    logger.finish();
  });
});
