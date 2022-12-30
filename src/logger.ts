import Tracer, { ITracerConfig, LogSpan, getDefaultTracer } from './tracer';
import { opentracing } from 'jaeger-client';
import deepmerge from 'deepmerge';
import * as _ from 'lodash';
import { isArray } from 'lodash';
// eslint-disable-next-line unicorn/prefer-node-protocol
import { Stream } from 'stream';

type IData = {
  args?: any[];
  query?: string;
  model?: {
    name: string;
    [key: string]: unknown;
  };
  type?: string;
  instance?: {
    dataValues: unknown;
    [key: string]: unknown;
  };
};

export type ILogData = {
  queNumber?: number;
  type?: 'error' | 'info';
  message?: string;
  data?: any | IData;
  err?: any;
  [key: string]: unknown;
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
  parentContext?: LogSpan;
  createNewContext?: boolean;
}

type ILoggerRequiredConfig = Required<Pick<ILoggerConfig, 'excludeClasses' | 'consoleDepth'>>;

export interface IUberTrace {
  'uber-trace-id': string;

  [k: string]: string | undefined;
}

export const defaultConfig: ILoggerConfig & ILoggerRequiredConfig = {
  excludeMethods: ['assertInitialized'],
  excludeClasses: ['Transaction', 'Logger'],
  consoleDepth: 3,
};

const defaultLogData: ILogData = { type: 'info', message: '', data: undefined, queNumber: 0 };

export const LOGGER = Symbol('LOGGER');

export default class Logger {
  public readonly type = LOGGER;
  private readonly tracer: Tracer | undefined;
  private readonly _context: LogSpan | undefined;
  public readonly config: ILoggerConfig & ILoggerRequiredConfig;
  public isToCloseContext = true;

  // TODO: simplify options
  constructor(public readonly serviceName: string, options: ILoggerOptions = {}) {
    const { config: optionsConfig = {}, parentContext, createNewContext } = options;
    this.config = deepmerge(defaultConfig, optionsConfig);

    if (this.config?.tracerConfig?.useTracer) {
      this.tracer = getDefaultTracer(serviceName, this.config.tracerConfig);
    }
    // TODO: simplify newcontext/subcontext
    if (this.tracer && (parentContext || createNewContext)) {
      // create new context or create subcontext if parent context provided
      this._context = this.tracer.getSubContext(serviceName, parentContext);
    }
  }

  // TODO: refactor to automatically close all subcontexts
  /**
   * Every logger context should be closed at the end, otherwise spans are not saved.
   */
  public finish(): void {
    if (this.context) {
      this.context.finish();
    }
  }

  public closeTracer(): void {
    if (this.tracer) {
      this.tracer.client.close();
    }
  }

  /**
   * Proxying 'Tracer.Span.AddTags' method
   * It adds tags to the span.
   * @param keyValueMap - { [key: string]: any }
   * @returns The current instance of the class.
   */
  public addTags(keyValueMap: { [key: string]: any }): this {
    if (this.context) {
      this.context.addTags(keyValueMap);
    }

    return this;
  }

  public get context() {
    return this._context;
  }

  /**
   *
   * Logging "info" type of message
   *
   * @param {string} action - The action that is being logged.
   * @param {ILogData} logData - ILogData = defaultLogData
   * @param {LogSpan} [context] - This is the context of the log. It's used to group logs together.
   * @returns A Logger object
   */
  public info(action: string, logData: ILogData = defaultLogData, context?: LogSpan): Logger {
    return this.write(action, { ...logData, type: 'info' }, context);
  }

  /**
   *
   * Log "error" message
   *
   * The first argument is a union type, which means it can be a string or an error. If it's a string, we use it as the
   * action. If it's an error, we use the default action and use the first argument as the error
   * @param {string | Error | unknown} actionOrError - This is the action that you want to log. It can be a string or an
   * error. If it's an error, the action will be set to 'error' and the error will be logged.
   * @param {ILogData} logData - ILogData = defaultLogData
   * @param {LogSpan} [context] - LogSpan - This is the context of the log. It's used to group logs together.
   * @returns A Logger object
   */
  public error(actionOrError: string | Error | unknown, logData: ILogData = defaultLogData, context?: LogSpan): Logger {
    let action = 'error';
    if (typeof actionOrError === 'string') action = actionOrError;
    else {
      logData = { ...logData, err: actionOrError };
    }

    return this.write(action, { ...logData, type: 'error' }, context);
  }

  /**
   * logging db queries (only sequelize)
   */
  public db = (query = '', data: ILogData['data'] = {}): void => {
    const databaseInstance = data.model?.name ?? '';
    const queryType = data.type ?? '';
    const subLog = this.getSubLogger(`sequelize${databaseInstance ? ': ' + databaseInstance : ''}`, this.context);
    if (subLog.context != undefined) {
      subLog.context.addTags({
        [opentracing.Tags.DB_INSTANCE]: databaseInstance,
        [opentracing.Tags.DB_STATEMENT]: query,
      });
      subLog.info(`${queryType} ${databaseInstance}`, { data: { query, args: [data.instance?.dataValues] } });
      subLog.finish();
    }
  };

  /**
   * Static error logger to use without 'new'
   * logs an error and throws it
   *
   * @deprecated **uses default config where connection to jaeger not set, so tracer will not work**
   */
  public static logError(error: Error, context: ILogData, serviceName = 'Unknown service'): void {
    const logger = new Logger(serviceName);
    logger.error(error.message, context);
    throw error;
  }

  /**
   * Wrap function call input/output
   * Creates sub span in logger context and records function request/response
   *
   * @param contextName - name of the span
   * @param function_ - function to be called
   * @param arguments_ - arguments for provided function
   */
  public wrapCall = <T = ILogData['data']>(
    contextName: string,
    function_: Function,
    ...arguments_: unknown[]
  ): T | Promise<T> => {
    const subLogger = this.getSubLogger(contextName, this.context);

    try {
      subLogger.info('request', { action: contextName, data: { args: arguments_ } });
      const response = function_.apply(function_, arguments_);

      const promise = Promise.resolve(response)
        .then((data: ILogData['data']) => {
          subLogger.info('response', { action: contextName, data: data || response });

          return data;
        })
        .catch((error) => {
          // for async functions
          subLogger.error('error', { action: contextName, err: error });

          throw error;
        })
        .finally(() => {
          subLogger.finish();
        });

      if (response instanceof Promise) {
        return promise;
      }

      return response;
    } catch (error) {
      // in case decorated function not async
      subLogger.error('error', { action: contextName, err: error });

      throw error;
    }
  };

  /**
   * Useful for getting nested logs.
   * Returns a new Logger instance with the given name and parentContext.
   * *don't forget to close this sub logger on completion!*
   */
  public getSubLogger(name: string, parentContext = this.context): Logger {
    return new Logger(name, { parentContext, config: this.config });
  }

  /**
   * Export context data
   * Useful for transferring context to other microservice and create connected logs
   */
  public extract(): IUberTrace {
    const uberTrace = {};
    if (this.context && this.tracer) {
      this.tracer.client.inject(this.context, opentracing.FORMAT_TEXT_MAP, uberTrace);
    }
    return uberTrace as IUberTrace;
  }

  /**
   * Import context data
   * Useful for continuing logs of other microservice and create connected logs
   * @param contextName
   * @param trace
   */
  public inject(contextName: string, trace: IUberTrace): Logger {
    let span_context;
    if (this.tracer) {
      span_context = this.tracer.client.extract(opentracing.FORMAT_TEXT_MAP, trace);
    }
    return this.getSubLogger(contextName, span_context as unknown as opentracing.Span);
  }

  /**
   * It takes an array of arguments and returns a new array of arguments with all the heavy objects removed
   *
   * @param {an y[]} arguments_ - any[] - the arguments to be simplified
   * @param {string[]} excludeClasses - An array of class names that you want to exclude from the logging.
   * @returns An array of objects
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static simplifyArgs(arguments_: any, excludeClasses: string[] = []): unknown[] {
    // TODO: filter out objects by size

    function applyFilters(arguments__: any) {
      arguments__ = _.cloneDeep(arguments__);
      arguments__ = Logger.replaceStreamRecursive(arguments__);
      arguments__ = Logger.replaceBufferRecursive(arguments__);
      arguments__ = Logger.replaceClassesRecursive(arguments__, excludeClasses);
      return arguments__;
    }

    if (isArray(arguments_)) {
      return (arguments_ || []).map((argument: unknown) => {
        if (argument instanceof Object || argument instanceof Buffer) {
          argument = applyFilters(argument);
        }
        return argument;
      });
    } else if (arguments_ instanceof Object || arguments_ instanceof Buffer || arguments_ instanceof Stream) {
      arguments_ = applyFilters(arguments_);
    }

    return arguments_;
  }

  /**
   * finds arg nested property by provided class name and replaces it with class name (string).
   * modifies original value.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static replaceClassesRecursive(argument: any, classNames: string[], depth = 3): any {
    if (depth <= 0) return argument;

    if (_.isObject(argument) && classNames.includes(argument.constructor?.name)) {
      return argument.constructor?.name;
    }

    _.forIn(argument, (value, key) => {
      if (_.isObject(value)) {
        if (classNames.includes(value.constructor?.name)) argument[key] = value.constructor?.name;
        else return Logger.replaceClassesRecursive(value, classNames, depth - 1);
      }
    });

    return argument;
  }

  /**
   * finds Buffers in args recursively and replaces them with string 'Buffer'.
   * modifies original value.
   */
  public static replaceBufferRecursive(argument: unknown, depth = 3): unknown {
    if (Buffer.isBuffer(argument)) return 'Buffer';

    if (depth > 0 && _.isObject(argument)) {
      _.forIn(argument, (value, key) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        argument[key] = Logger.replaceBufferRecursive(value, depth - 1);
      });
    }

    return argument;
  }

  /**
   * finds Streams in args recursively and replaces them with string 'Stream'.
   * modifies original value.
   */
  public static replaceStreamRecursive(argument: unknown, depth = 3): unknown {
    if (argument instanceof Stream) return 'Stream';

    if (depth > 0 && _.isObject(argument)) {
      _.forIn(argument, (value, key) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        argument[key] = Logger.replaceStreamRecursive(value, depth - 1);
      });
    }

    return argument;
  }

  /**
   * Writes to the console and to the tracer
   * @param {string} action - The action that is being logged.
   * @param {ILogData} logData - ILogData = defaultLogData
   * @param context - The context object that is passed to the logger.
   * @returns The Logger instance.
   */
  private write(action: string, logData: ILogData = defaultLogData, context = this.context): Logger {
    const { type, message, data, err, queNumber } = logData;
    const details = `(${this.serviceName}):${queNumber || ''}: ${action || ''}`;
    this.consoleWrite(type ?? 'error', message ?? '', details, data, err);

    if (context && this.tracer) {
      this.tracer.write(action, logData, context);
    }
    return this;
  }

  /**
   * Format & Log output to the console If the config says so
   */
  private consoleWrite(
    type: 'error' | 'info',
    message: string,
    details: string,
    data: ILogData['data'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: any,
  ): void {
    if (!this.config.writeToConsole) return;

    let color = '\u001B[33m%s\u001B[0m : \u001B[36m%s\u001B[0m';
    if (type === 'info') {
      console.log(color, details, message || '');
    } else {
      color = '\u001B[31m%s\u001B[0m';
      details = '';
      console.error(color, details, message || '', error);
    }
    if (data) {
      data = Logger.simplifyArgs(data, this.config.excludeClasses);
      console.dir(data, { colors: true, depth: this.config.consoleDepth });
    }
  }
}
