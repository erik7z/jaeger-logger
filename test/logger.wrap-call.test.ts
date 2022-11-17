import Logger from '../src/logger';
import Tracer from '../src/tracer';

describe('Logger.wrapCall', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  afterAll(() => {
    const logger = new Logger('wrapCall-logger', {
      config: { writeToConsole: true, tracerConfig: { useTracer: false } },
    });
    logger.tracer.client.close();
  });
  test('Should wrap function call request and response in sub log', async () => {
    const logger = new Logger('wrapCall-logger', {
      createNewContext: true,
      config: { writeToConsole: false, tracerConfig: { useTracer: true } },
    });

    const TracerGetSubContextSpy = jest.spyOn(Tracer.prototype, 'getSubContext');
    const TracerSendSpy = jest.spyOn(Tracer.prototype, 'send');

    // eslint-disable-next-line unicorn/consistent-function-scoping
    function fakeFunction(a: number, b: number): number {
      return a + b;
    }

    const result = await logger.wrapCall('fakeCall', fakeFunction, 1, 2);
    expect(result).toEqual(3);

    // subcontext "fakeCall" has been created
    expect(TracerGetSubContextSpy).toHaveBeenCalled();
    expect(TracerGetSubContextSpy.mock.lastCall?.[0]).toStrictEqual('fakeCall');

    await new Promise((r) => setTimeout(r, 500));

    // function call args sent to collector
    expect(TracerSendSpy).toHaveBeenCalled();
    expect(TracerSendSpy.mock.calls[0][1]).toStrictEqual({
      action: 'request',
      details: {
        data: {
          args: [1, 2],
        },
      },
    });

    // waiting for processing response
    await new Promise((r) => setTimeout(r, 500));

    expect(TracerSendSpy.mock.calls[1][1]).toStrictEqual({
      action: 'response',
      details: {
        data: 3,
      },
    });
    logger.finish();
  });

  test('Should properly handle function errors in sub log', async () => {
    const logger = new Logger('wrapCall-logger', {
      createNewContext: true,
      config: { writeToConsole: false, tracerConfig: { useTracer: true } },
    });

    const TracerGetSubContextSpy = jest.spyOn(Tracer.prototype, 'getSubContext');
    const TracerSendSpy = jest.spyOn(Tracer.prototype, 'send');

    let stack = '';
    let message = '';

    // eslint-disable-next-line unicorn/consistent-function-scoping
    function fakeFunction(): void {
      throw new Error('Oh crap!');
    }

    try {
      await logger.wrapCall('fakeCall', fakeFunction, 1, 2);
    } catch (error) {
      if (error instanceof Error) {
        stack = error.stack ?? '';
        message = error.message;
      }
    }

    // subcontext "fakeCall" has been created
    expect(TracerGetSubContextSpy).toHaveBeenCalled();
    expect(TracerGetSubContextSpy.mock.lastCall?.[0]).toStrictEqual('fakeCall');

    // function call args sent to collector
    expect(TracerSendSpy).toHaveBeenCalled();
    expect(TracerSendSpy.mock.calls[0][1]).toStrictEqual({
      action: 'request',
      details: {
        data: {
          args: [1, 2],
        },
      },
    });

    // waiting for processing response
    await new Promise((r) => setTimeout(r, 500));

    expect(TracerSendSpy.mock.calls[1][1]).toStrictEqual({
      action: 'error',
      details: {
        err: {
          message,
          stack,
        },
        isError: true,
      },
    });

    await logger.finish();
  });

  test('Should properly wrap async function call request and response in sub log', async () => {
    const logger = new Logger('wrapCall-logger', {
      createNewContext: true,
      config: { writeToConsole: false, tracerConfig: { useTracer: true } },
    });

    const TracerGetSubContextSpy = jest.spyOn(Tracer.prototype, 'getSubContext');
    const TracerSendSpy = jest.spyOn(Tracer.prototype, 'send');

    async function fakeFunction(a: number, b: number): Promise<unknown> {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(a + b);
        }, 500);
      });
    }

    const result = await logger.wrapCall('fakeCall', fakeFunction, 1, 2);
    expect(result).toEqual(3);

    // subcontext "fakeCall" has been created
    expect(TracerGetSubContextSpy).toHaveBeenCalled();
    expect(TracerGetSubContextSpy.mock.lastCall?.[0]).toStrictEqual('fakeCall');

    // function call args sent to collector
    expect(TracerSendSpy).toHaveBeenCalled();
    expect(TracerSendSpy.mock.calls[0][1]).toStrictEqual({
      action: 'request',
      details: {
        data: {
          args: [1, 2],
        },
      },
    });

    // waiting for processing response
    await new Promise((r) => setTimeout(r, 1000));

    expect(TracerSendSpy.mock.calls[1][1]).toStrictEqual({
      action: 'response',
      details: {
        data: 3,
      },
    });
    await logger.finish();
  });

  test("Should properly handle wrapped function 'this' context", async () => {
    const logger = new Logger('wrapCall-logger', {
      createNewContext: true,
      config: { writeToConsole: false, tracerConfig: { useTracer: true } },
    });

    class FakeClass {
      constructor(private a: number) {}

      public fakeFunc(b: number): number {
        return this.a + b;
      }
    }

    const fake = new FakeClass(3);

    const result = await logger.wrapCall('fakeCall', fake.fakeFunc.bind(fake), 4);

    expect(result).toEqual(7);

    logger.finish();
  });

  test('Should properly handle sync function errors in sub log', async () => {
    const logger = new Logger('wrapCall-logger', {
      createNewContext: true,
      config: { writeToConsole: false, tracerConfig: { useTracer: true } },
    });

    const TracerGetSubContextSpy = jest.spyOn(Tracer.prototype, 'getSubContext');
    const TracerSendSpy = jest.spyOn(Tracer.prototype, 'send');

    const errorMessage = 'God damn!';

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fakeFunction = async (a: number, b: number): Promise<unknown> =>
      new Promise((_, reject) => reject(errorMessage));
    await expect(async () => {
      await logger.wrapCall('fakeCall', fakeFunction, 1, 2);
    }).rejects.toEqual(errorMessage);

    // subcontext "fakeCall" has been created
    expect(TracerGetSubContextSpy).toHaveBeenCalled();
    expect(TracerGetSubContextSpy.mock.lastCall?.[0]).toStrictEqual('fakeCall');

    // function call args sent to collector
    expect(TracerSendSpy).toHaveBeenCalled();
    expect(TracerSendSpy.mock.calls[0][1]).toStrictEqual({
      action: 'request',
      details: {
        data: {
          args: [1, 2],
        },
      },
    });

    // error details has been sent to collector
    expect(TracerSendSpy.mock.lastCall?.[1]).toStrictEqual({
      action: 'error',
      details: {
        err: {
          message: errorMessage,
        },
        isError: true,
      },
    });

    logger.finish();
  });

  test('Should return promise if function is async', async () => {
    const logger = new Logger('wrapCall-logger', {
      createNewContext: true,
      config: { writeToConsole: false, tracerConfig: { useTracer: true } },
    });
    const sum = async (a: number, b: number): Promise<number> => a + b;

    const promiseResult = logger.wrapCall('summing', sum, 1, 2);
    expect(promiseResult instanceof Promise).toBe(true);

    const result = await promiseResult;
    expect(result).toEqual(3);

    logger.finish();
  });
});
