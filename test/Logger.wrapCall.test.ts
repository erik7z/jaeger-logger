import Logger from '../src/logger';
import Tracer from '../src/tracer';

describe('Logger.wrapCall', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('Should wrap function call request and response in sub log', async () => {
    const logger = new Logger('test1', {
      createNewContext: true,
      config: { writeToConsole: false, tracerConfig: { useTracer: true } },
    });

    const TracerGetSubContextSpy = jest.spyOn(Tracer.prototype, 'getSubContext');
    const TracerSendSpy = jest.spyOn(Tracer.prototype, 'send');

    function fakeFunc(a: number, b: number): number {
      return a + b;
    }

    const res = await logger.wrapCall('fakeCall', fakeFunc, 1, 2);
    expect(res).toEqual(3);

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
        data: {
          return: 3,
        },
      },
    });
    logger.finish();
  });

  test('Should properly handle function errors in sub log', async () => {
    const logger = new Logger('test', {
      createNewContext: true,
      config: { writeToConsole: false, tracerConfig: { useTracer: true } },
    });

    const TracerGetSubContextSpy = jest.spyOn(Tracer.prototype, 'getSubContext');
    const TracerSendSpy = jest.spyOn(Tracer.prototype, 'send');

    let stack = '';
    let message = '';

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function fakeFunc(a: number, b: number): void {
      throw new Error('Oh crap!');
    }

    try {
      await logger.wrapCall('fakeCall', fakeFunc, 1, 2);
    } catch (e: any) {
      stack = e.stack;
      message = e.message;
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

    logger.finish();
  });

  test('Should properly wrap async function call request and response in sub log', async () => {
    const logger = new Logger('test', {
      createNewContext: true,
      config: { writeToConsole: false, tracerConfig: { useTracer: true } },
    });

    const TracerGetSubContextSpy = jest.spyOn(Tracer.prototype, 'getSubContext');
    const TracerSendSpy = jest.spyOn(Tracer.prototype, 'send');

    async function fakeFunc(a: number, b: number): Promise<unknown> {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(a + b);
        }, 500);
      });
    }

    const res = await logger.wrapCall('fakeCall', fakeFunc, 1, 2);
    expect(res).toEqual(3);

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
        data: {
          return: 3,
        },
      },
    });
    logger.finish();
  });

  test("Should properly handle wrapped function 'this' context", async () => {
    const logger = new Logger('test', {
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

    const res = await logger.wrapCall('fakeCall', fake.fakeFunc.bind(fake), 4);

    expect(res).toEqual(7);

    logger.finish();
  });

  test('Should properly handle sync function errors in sub log', async () => {
    const logger = new Logger('test', {
      createNewContext: true,
      config: { writeToConsole: false, tracerConfig: { useTracer: true } },
    });

    const TracerGetSubContextSpy = jest.spyOn(Tracer.prototype, 'getSubContext');
    const TracerSendSpy = jest.spyOn(Tracer.prototype, 'send');

    const errMessage = 'God damn!';

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fakeFunc = async (a: number, b: number): Promise<unknown> => new Promise((_, reject) => reject(errMessage));
    await expect(async () => {
      await logger.wrapCall('fakeCall', fakeFunc, 1, 2);
    }).rejects.toEqual(errMessage);

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
          message: errMessage,
        },
        isError: true,
      },
    });

    logger.finish();
  });

  test('Should return promise if function is async', async () => {
    const logger = new Logger('test', {
      createNewContext: true,
      config: { writeToConsole: false, tracerConfig: { useTracer: true } },
    });
    const sum = async (a: number, b: number): Promise<number> => a + b;

    const promiseRes = logger.wrapCall('summing', sum, 1, 2);
    expect(promiseRes instanceof Promise).toBe(true);

    const res = await promiseRes;
    expect(res).toEqual(3);

    logger.finish();
  });
});
