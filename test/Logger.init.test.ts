﻿import Logger from "../src/logger";


describe("Logger.init", () => {
  test("Logger instance name should be assigned during creation", async () => {
    // some problems with open handles after tests completed https://stackoverflow.com/questions/53935108/jest-did-not-exit-one-second-after-the-test-run-has-completed-using-express
    const logger = new Logger("testservice", { config: { writeToConsole: false, tracerConfig: { useTracer: false } } });
    await logger.finish();
    expect(logger.serviceName).toBe("testservice");
  });
});
