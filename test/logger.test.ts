import Logger from "../src/logger";


describe("Logger", () => {
  describe("Main functionality", () => {
    test("Logger instance name should be assigned during creation", async () => {
      // some problems with open handles after tests completed https://stackoverflow.com/questions/53935108/jest-did-not-exit-one-second-after-the-test-run-has-completed-using-express
      const logger = new Logger("testservice");
      await logger.finish();
      expect(logger.serviceName).toBe("testservice");
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

    });

  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(() => resolve(true), 1000)); // avoid jest open handle error
  });
});
