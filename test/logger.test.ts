import Logger from "../src/logger";


describe("Logger", () => {

  describe("Main Functionality", () => {
    describe("Initialization", () => {
      test("Logger instance name should be assigned during creation", async () => {
        // some problems with open handles after tests completed https://stackoverflow.com/questions/53935108/jest-did-not-exit-one-second-after-the-test-run-has-completed-using-express
        const logger = new Logger("testservice");
        await logger.finish();
        expect(logger.serviceName).toBe("testservice");
      });
    });

    describe("Logger.error", () => {
      test("Should use console.error if logging to console enabled", async () => {
        const logger = new Logger("test", { config: { writeToConsole: true, tracerConfig: { useTracer: false } } });
        const consoleSpy = jest.spyOn(console, "error");

        logger.error("error", { err: "err" });

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
