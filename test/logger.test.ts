import Logger from "../src/logger";
import Tracer from "../src/tracer";


describe("Logger", () => {

  describe("Main Functionality", () => {
    describe("Initialization", () => {
      test("Logger instance name should be assigned during creation", async () => {
        // some problems with open handles after tests completed https://stackoverflow.com/questions/53935108/jest-did-not-exit-one-second-after-the-test-run-has-completed-using-express
        const logger = new Logger("testservice", { config: { writeToConsole: false, tracerConfig: { useTracer: false } } });
        await logger.finish();
        expect(logger.serviceName).toBe("testservice");
      });
    });

    describe("Logger.error", () => {
      test("Should use console.error if logging to console enabled", async () => {
        const logger = new Logger("test", { config: { writeToConsole: true, tracerConfig: { useTracer: false } } });
        const consoleSpy = jest.spyOn(console, "error");

        logger.error("error", { err: "test error output to console" });

        expect(consoleSpy).toBeCalled();
        await logger.finish();
      });

      test("Should accept error as a first parameter, and properly log it", async () => {
        const logger = new Logger("test", { config: { writeToConsole: false, tracerConfig: { useTracer: false } } });
        const loggerSpy = jest.spyOn(logger, "write");

        const err = new Error("Oh crap!");
        logger.error(err, { err: "err" });

        expect(loggerSpy).toHaveBeenCalledWith("error", { err, "type": "error" }, undefined);
        await logger.finish();
      });
    });

  });

  // TODO: below group of tests (they are ok only if running one by one)
  describe("Logger.wrapCall", () => {
    beforeEach(() => {
      jest.resetAllMocks()
    })

    test("Should wrap function call request and response in sub log", async () => {
      const logger = new Logger("test", { createNewContext: true, config: { writeToConsole: false, tracerConfig: { useTracer: true } } });

      const TracerGetSubContextSpy = jest.spyOn(Tracer.prototype, "getSubContext");
      const TracerSendSpy = jest.spyOn(Tracer.prototype, "send");

      function fakeFunc(a: number, b: number) {
        return a + b;
      }

      const res = await logger.wrapCall("fakeCall", logger, fakeFunc, 1, 2);
      expect(res).toEqual(3);


      // subcontext "fakeCall" has been created
      expect(TracerGetSubContextSpy).toHaveBeenCalled();
      expect(TracerGetSubContextSpy.mock.calls[0][0]).toStrictEqual("fakeCall");

      await new Promise(r => setTimeout(r, 500));

      // function call args sent to collector
      expect(TracerSendSpy).toHaveBeenCalled();
      expect(TracerSendSpy.mock.calls[0][1]).toStrictEqual({
        action: "request",
        details: {
          data: {
            args: [
              1,
              2
            ]
          }
        }
      });

      // waiting for processing response
      await new Promise(r => setTimeout(r, 500));

      expect(TracerSendSpy.mock.calls[1][1]).toStrictEqual({
        action: "response",
        details: {
          data: {
            return: 3
          }
        }
      });

      await logger.finish();
    });

    test.skip("Should properly handle function errors in sub log", async () => {
      const logger = new Logger("test", { createNewContext: true, config: { writeToConsole: false, tracerConfig: { useTracer: true } } });

      const TracerGetSubContextSpy = jest.spyOn(Tracer.prototype, "getSubContext");
      const TracerSendSpy = jest.spyOn(Tracer.prototype, "send");

      let stack = "";
      let message = "";

      function fakeFunc(a: number, b: number) {
        throw new Error("Oh crap!");
      }

      try {
        logger.wrapCall("fakeCall", logger, fakeFunc, 1, 2);
      } catch (e: any) {
        stack = e.stack;
        message = e.message;
      }

      // subcontext "fakeCall" has been created
      expect(TracerGetSubContextSpy).toHaveBeenCalled();
      expect(TracerGetSubContextSpy.mock.calls[0][0]).toStrictEqual("fakeCall");

      // function call args sent to collector
      expect(TracerSendSpy).toHaveBeenCalled();
      expect(TracerSendSpy.mock.calls[0][1]).toStrictEqual({
        action: "request",
        details: {
          data: {
            args: [
              1,
              2
            ]
          }
        }
      });

      // waiting for processing response
      await new Promise(r => setTimeout(r, 500));

      expect(TracerSendSpy.mock.calls[1][1]).toStrictEqual({
        action: "error",
        details: {
          err: {
            message,
            stack
          },
          isError: true
        }
      });

      await logger.finish();
    });

    test.skip("Should properly wrap async function call request and response in sub log", async () => {
      const logger = new Logger("test", { createNewContext: true, config: { writeToConsole: false, tracerConfig: { useTracer: true } } });

      const TracerGetSubContextSpy = jest.spyOn(Tracer.prototype, "getSubContext");
      const TracerSendSpy = jest.spyOn(Tracer.prototype, "send");

      async function fakeFunc(a: number, b: number) {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(a + b);
          }, 500);
        });
      }

      const res = await logger.wrapCall("fakeCall", logger, fakeFunc, 1, 2);
      expect(res).toEqual(3);


      // subcontext "fakeCall" has been created
      expect(TracerGetSubContextSpy).toHaveBeenCalled();
      expect(TracerGetSubContextSpy.mock.calls[0][0]).toStrictEqual("fakeCall");

      // function call args sent to collector
      expect(TracerSendSpy).toHaveBeenCalled();
      expect(TracerSendSpy.mock.calls[0][1]).toStrictEqual({
        action: "request",
        details: {
          data: {
            args: [
              1,
              2
            ]
          }
        }
      });

      // waiting for processing response
      await new Promise(r => setTimeout(r, 1000));

      expect(TracerSendSpy.mock.calls[1][1]).toStrictEqual({
        action: "response",
        details: {
          data: {
            return: 3
          }
        }
      });
      await logger.finish();
    });

    // TODO: fix this test (jest not handling properly errors thrown in async functions)
    test.skip("Should properly handle sync function errors in sub log", async () => {
      const logger = new Logger("test", { createNewContext: true, config: { writeToConsole: false, tracerConfig: { useTracer: true } } });

      const TracerGetSubContextSpy = jest.spyOn(Tracer.prototype, "getSubContext");
      const TracerSendSpy = jest.spyOn(Tracer.prototype, "send");

      let stack = "";
      let message = "";

      const fakeFunc = async (a: number, b: number) => new Promise((resolve, reject) => {
        reject("God damn!");
      });

      await expect(async () => {
        // throw new Error("God damn!")
        await fakeFunc(1, 2);
        await new Promise(r => setTimeout(r, 500));

        // const res = await logger.wrapCall("fakeCall", logger, fakeFunc, 1, 2);
        // console.log(res)
      }).rejects.toThrowError("God damn!");


      // subcontext "fakeCall" has been created
      expect(TracerGetSubContextSpy).toHaveBeenCalled();
      expect(TracerGetSubContextSpy.mock.calls[0][0]).toStrictEqual("fakeCall");

      // function call args sent to collector
      expect(TracerSendSpy).toHaveBeenCalled();
      expect(TracerSendSpy.mock.calls[0][1]).toStrictEqual({
        action: "request",
        details: {
          data: {
            args: [
              1,
              2
            ]
          }
        }
      });

      // waiting for processing response
      await new Promise(r => setTimeout(r, 1000));

      expect(TracerSendSpy.mock.calls[1][1]).toStrictEqual({
        action: "error",
        details: {
          err: {
            message,
            stack
          },
          isError: true
        }
      });

      await logger.finish();
    });
  });


  describe("Static functions", () => {
    describe("simplifyArgs", () => {
      test("Should replace provided classes with string class name", async () => {
        class FakeClassA {
          constructor(public a: number, public b: string) {}
        }

        class FakeClassB {
          constructor(public a: number, public b: string) {}
        }

        const fca = new FakeClassA(1, "a");
        const fcb = new FakeClassB(1, "b");

        const args = [1, fca, 2, fcb];
        const newArgs = Logger.simplifyArgs(args, ["FakeClassA"]);

        expect(newArgs).toStrictEqual([1, "FakeClassA", 2, fcb]);
      });

      test("Should replace nested provided classes with string class name", async () => {
        class FakeClassA {
          constructor(public a: number, public b: string) {}
        }

        class FakeClassB {
          constructor(public a: number, public b: string) {}
        }

        const fca = new FakeClassA(1, "a");
        const fcb = new FakeClassB(1, "b");

        const nested = {
          a: "a",
          n: {
            n1: {
              fca
            },
            b: "b"
          }
        };

        const nestedReplaced = {
          a: "a",
          n: {
            n1: {
              fca: "FakeClassA"
            },
            b: "b"
          }
        };

        const args = [1, nested, 2, fcb];
        const newArgs = Logger.simplifyArgs(args, ["FakeClassA"]);

        expect(newArgs).toStrictEqual([1, nestedReplaced, 2, fcb]);
      });

      test("Should replace args of type Buffer", async () => {
        const buff = Buffer.from("abc");

        class FakeClassB {
          constructor(public a: number, public b: string) {}
        }

        const fcb = new FakeClassB(1, "b");

        const args = [1, buff, 2, fcb];
        const newArgs = Logger.simplifyArgs(args, ["FakeClassA"]);

        expect(newArgs).toStrictEqual([1, "Buffer", 2, fcb]);
      });


      test("Should replace nested args of type Buffer", async () => {
        const buff = Buffer.from("abc");

        class FakeClassB {
          constructor(public a: number, public b: string) {}
        }

        const nested = {
          a: "a",
          n: {
            n1: {
              buff
            },
            b: "b"
          }
        };

        const nestedReplaced = {
          a: "a",
          n: {
            n1: {
              buff: "Buffer"
            },
            b: "b"
          }
        };

        const fcb = new FakeClassB(1, "b");
        const args = [1, nested, 2, fcb];
        const newArgs = Logger.simplifyArgs(args, ["FakeClassA"]);

        expect(newArgs).toStrictEqual([1, nestedReplaced, 2, fcb]);
      });

    });

  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(() => resolve(true), 1000)); // avoid jest open handle error
  });
});
