import Tracer, { ITracerConfig, LogContext, getDefaultTracer } from "./tracer";
import { opentracing } from "jaeger-client";
import deepmerge from "deepmerge";
import * as _ from "lodash";

export type ILogData = {
  [key: string]: any;
  queNumber?: any;
  type?: "error" | "info";
  message?: string;
  data?: any;
  err?: any;
};

export interface ILoggerConfig {
  writeToConsole?: boolean;
  tracerConfig?: Partial<ITracerConfig>;
  excludeMethods?: string[];
  excludeClasses?: string[];
  consoleDepth?: number;
}

export interface ILoggerOptions {
  config?: ILoggerConfig;
  parentContext?: LogContext;
  createNewContext?: boolean;
}

type ILoggerRequiredConfig = Required<Pick<ILoggerConfig, "excludeClasses" | "consoleDepth">>;

export const defaultConfig: ILoggerConfig & ILoggerRequiredConfig = {
  excludeMethods: ["assertInitialized"],
  excludeClasses: ["Transaction", "Logger"],
  consoleDepth: 3,
};

export const LOGGER = Symbol("LOGGER");

export default class Logger {
  public readonly type = LOGGER;
  public readonly tracer: Tracer;
  public readonly context: LogContext | undefined;
  public readonly config: ILoggerConfig & ILoggerRequiredConfig;
  public isToCloseContext = true;

  // TODO: simplify options
  constructor(public readonly serviceName: string, options: ILoggerOptions = {}) {
    const { config: optionsConfig = {}, parentContext, createNewContext } = options;
    this.config = deepmerge(defaultConfig, optionsConfig);

    this.tracer = getDefaultTracer(serviceName, this.config.tracerConfig);
    // TODO: simplify newcontext/subcontext
    if (parentContext || createNewContext) {
      // create new context or create subcontext if parent context provided
      this.context = this.tracer.getSubContext(serviceName, parentContext);
    }
  }

  /**
   * Every logger context should be closed at the end, otherwise spans are not saved.
   */
  finish() {
    if (this.context) this.context.finish();
  }

  write(
    action: string,
    logData: ILogData = { type: "info", message: "", data: null, queNumber: 0 },
    context = this.context
  ): Logger {
    const { type, message, data, err, queNumber } = logData;
    const details = `(${this.serviceName}):${queNumber || ""}: ${action || ""}`;
    this.consoleWrite(type ?? "error", message ?? "", details, data, err);

    if (context && this.config?.tracerConfig?.useTracer) {
      this.tracer.write(action, logData, context);
    }
    return this;
  }

  /**
   * Format & Log output to the console If the config says so
   */
  private consoleWrite(type: "error" | "info", message: string, details: string, data: any, err: any): void {
    if (!this.config.writeToConsole) return;

    let color = "\x1b[33m%s\x1b[0m : \x1b[36m%s\x1b[0m";
    if (type === "info") {
      console.log(color, details, message || "");
    } else {
      color = "\x1b[31m%s\x1b[0m";
      details = "";
      console.error(color, details, message || "", err);
    }
    if (data) {
      data.args = Logger.simplifyArgs(data.args, this.config.excludeClasses);
      console.dir(data, { colors: true, depth: this.config.consoleDepth });
    }
  }

  info(action: string, logData: ILogData = { message: "", data: null, queNumber: 0 }, context?: LogContext): Logger {
    return this.write(action, { ...logData, type: "info" }, context);
  }

  error(actionOrError: string | Error | unknown, logData: ILogData = { message: "", data: null, queNumber: 0 }, context?: LogContext): Logger {
    let action = 'error';
    if(typeof actionOrError === 'string') action = actionOrError;
    else {
      logData = {...logData, err: actionOrError};
    }

    return this.write(action, { ...logData, type: "error" }, context);
  }

  /**
   * logging db queries (only sequelize)
   */
  db = (query: string = "", data: any = {}) => {
    const dbInstance = data.model?.name ?? "";
    const queryType = data.type ?? "";
    const subLog = this.getSubLogger(`sequelize${dbInstance ? ": " + dbInstance : ""}`, this.context);
    if (subLog.context != null) {
      subLog.context.addTags({
        [opentracing.Tags.DB_INSTANCE]: dbInstance,
        [opentracing.Tags.DB_STATEMENT]: query,
      });
      subLog.info(`${queryType} ${dbInstance}`, { data: { query, args: [data.instance?.dataValues] } });
      subLog.finish();
    }
  };

  /**
   * Static error logger to use without 'new'
   * logs an error and throws it
   * @deprecated **uses default config where connection to jaeger not set, so tracer will not work**
   */
  public static logError(e: Error, ctx: any | ILogData, serviceName = "Unknown service"): void {
    const logger = new Logger(serviceName);
    logger.error(e.message, ctx);
    throw e;
  }



  /**
   * Wrap function call input/output
   * Creates sub span in logger context and records function request/response
   * @param contextName - name of the span
   * @param parentLogger // TODO: try to use self logger instead of passing in params
   * @param func - function to be called
   * @param args - arguments for provided function
   */
  public wrapCall = <T = any>(contextName: string, func: any, ...args: any):T => {
    contextName = contextName ?? func.name;
    const subLogger = this.getSubLogger(contextName, this.context);
    try {
      subLogger.info('request', { action: func.name, data: { args } });
      const response = func.apply(this, args);

      Promise.resolve(response).then((data) => {
        subLogger.info('response', { action: contextName, data: { return: data || response } });
      }).catch((e) => { // for async functions
        subLogger.error('error', { action: contextName, err: e });
        throw e;
      }).finally(() => {
        subLogger.finish();
      });

      return response;
    } catch (e) { // in case decorated function not async
      subLogger.error('error', { action: contextName, err: e });
      throw e;
    }
  }

  /**
   * Useful for getting nested logs.
   * Returns a new Logger instance with the given name and parentContext.
   * *don't forget to close this sub logger on completion!*
   */
  public getSubLogger(name: string, parentContext = this.context): Logger {
    return new Logger(name, { parentContext, config: this.config });
  }

  /**
   * It takes an array of arguments and returns a new array of arguments with all the heavy objects removed
   * @param {any[]} args - any[] - the arguments to be simplified
   * @param {string[]} excludeClasses - An array of class names that you want to exclude from the logging.
   * @returns An array of objects
   */
  public static simplifyArgs(args: any[], excludeClasses: string[] = []): any[] {
    // TODO: filter out objects by size
    return (args || []).map((arg) => {
      if (arg instanceof Object || arg instanceof Buffer) {
        arg = _.cloneDeep(arg);
        arg = Logger.replaceBufferRecursive(arg);
        arg = Logger.replaceClassesRecursive(arg, excludeClasses);
      }

      return arg;
    });
  }

  /**
   * finds arg nested property by provided class name and replaces it with class name (string).
   * modifies original value.
   */
  public static replaceClassesRecursive(arg: any, classNames: string[], depth = 3) {
    if (depth <= 0) return arg;
    if (_.isObject(arg) && classNames.includes(arg.constructor?.name)) {
      return arg.constructor?.name;
    }
    _.forIn(arg, (value, key) => {
      if (_.isObject(value)) {
        if (classNames.includes(value.constructor?.name)) arg[key] = value.constructor?.name;
        else return Logger.replaceClassesRecursive(value, classNames, depth - 1);
      }
    });
    return arg;
  }

  /**
   * finds Buffers in args recursively and replaces them with string 'Buffer'.
   * modifies original value.
   */
  public static replaceBufferRecursive(arg: any, depth = 3) {
    if (Buffer.isBuffer(arg)) return "Buffer";

    if (depth > 0) {
      if (_.isObject(arg)) {
        _.forIn(arg, (value, key) => {
          // @ts-ignore
          arg[key] = Logger.replaceBufferRecursive(value, depth - 1);
        });
      }
    }

    return arg;
  }
}
