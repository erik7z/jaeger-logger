import Logger from "../src/logger";


describe("Logger", () => {
  test("Logger instance name should be assigned during creation", async () => {
    // some problems with open handles after tests completed https://stackoverflow.com/questions/53935108/jest-did-not-exit-one-second-after-the-test-run-has-completed-using-express

    const logger = new Logger("testservice");
    expect(logger.serviceName).toBe("testservice");
    await logger.finish()
    expect(1 + 2).toBe(3);
  });


  test("1+1", async () => {
    expect(1 + 1).toBe(2);
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(() => resolve(true), 1000)); // avoid jest open handle error
  });
});
