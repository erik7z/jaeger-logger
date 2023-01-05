import { ITracerConfig, LogSpan } from './tracer';
import { opentracing } from 'jaeger-client';
declare type IData = {
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
export declare type ILogData = {
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
declare type ILoggerRequiredConfig = Required<Pick<ILoggerConfig, 'excludeClasses' | 'consoleDepth'>>;
export interface IUberTrace {
    'uber-trace-id': string;
    [k: string]: string | undefined;
}
export declare const defaultConfig: ILoggerConfig & ILoggerRequiredConfig;
export declare const LOGGER: unique symbol;
export default class Logger {
    readonly serviceName: string;
    readonly type: symbol;
    private readonly tracer;
    private readonly _context;
    readonly config: ILoggerConfig & ILoggerRequiredConfig;
    isToCloseContext: boolean;
    constructor(serviceName: string, options?: ILoggerOptions);
    /**
     * Every logger context should be closed at the end, otherwise spans are not saved.
     */
    finish(): void;
    /**
     * It closes the tracer if it exists
     */
    closeTracer(): void;
    /**
     * Proxying 'Tracer.Span.AddTags' method
     * It adds tags to the span.
     * @param keyValueMap - { [key: string]: any }
     * @returns The current instance of the class.
     */
    addTags(keyValueMap: {
        [key: string]: any;
    }): this;
    /**
     * It returns the value of the private variable _context.
     * @returns The context property is being returned.
     */
    get context(): LogSpan | undefined;
    /**
     * Logging "info" type of message
     *
     * @param {string} action - The action that is being logged.
     * @param {ILogData} logData - ILogData = defaultLogData
     * @param {LogSpan} [context] - This is the context of the log. It's used to group logs together.
     * @returns A Logger object
     */
    info(action: string, logData?: ILogData, context?: LogSpan): Logger;
    /**
     * Logging "error" message
     *
     * The first argument is a union type, which means it can be a string or an error. If it's a string, we use it as the
     * action. If it's an error, we use the default action and use the first argument as the error
     * @param {string | Error | unknown} actionOrError - This is the action that you want to log. It can be a string or an
     * error. If it's an error, the action will be set to 'error' and the error will be logged.
     * @param {ILogData} logData - ILogData = defaultLogData
     * @param {LogSpan} [context] - LogSpan - This is the context of the log. It's used to group logs together.
     * @returns A Logger object
     */
    error(actionOrError: string | Error | unknown, logData?: ILogData, context?: LogSpan): Logger;
    /**
     * logging db queries (only sequelize)
     */
    db: (query?: string, data?: ILogData['data']) => void;
    /**
     * Static error logger to use without 'new'
     * logs an error and throws it
     *
     * @deprecated **uses default config where connection to jaeger not set, so tracer will not work**
     */
    static logError(error: Error, context: ILogData, serviceName?: string): void;
    /**
     * Wrap function call input/output
     * Creates sub span in logger context and records function request/response
     *
     * @param contextName - name of the span
     * @param function_ - function to be called
     * @param arguments_ - arguments for provided function
     */
    wrapCall: <T = any>(contextName: string, function_: Function, ...arguments_: unknown[]) => T | Promise<T>;
    /**
     * Useful for getting nested logs.
     * Returns a new Logger instance with the given name and parentContext.
     * *don't forget to close this sub logger on completion!*
     */
    getSubLogger(name: string, parentContext?: opentracing.Span | undefined): Logger;
    /**
     * Export context data
     * Useful for transferring context to other microservice and create connected logs
     */
    extract(): IUberTrace;
    /**
     * Import context data
     * Useful for continuing logs of other microservice and create connected logs
     * @param contextName
     * @param trace
     */
    inject(contextName: string, trace: IUberTrace): Logger;
    /**
     * It takes an array of arguments and returns a new array of arguments with all the heavy objects removed
     *
     * @param {an y[]} arguments_ - any[] - the arguments to be simplified
     * @param {string[]} excludeClasses - An array of class names that you want to exclude from the logging.
     * @returns An array of objects
     */
    static simplifyArgs(arguments_: any, excludeClasses?: string[]): unknown[];
    /**
     * finds arg nested property by provided class name and replaces it with class name (string).
     * modifies original value.
     */
    static replaceClassesRecursive(argument: any, classNames: string[], depth?: number): any;
    /**
     * finds Buffers in args recursively and replaces them with string 'Buffer'.
     * modifies original value.
     */
    static replaceBufferRecursive(argument: unknown, depth?: number): unknown;
    /**
     * finds Streams in args recursively and replaces them with string 'Stream'.
     * modifies original value.
     */
    static replaceStreamRecursive(argument: unknown, depth?: number): unknown;
    /**
     * Useful for masking some values.
     *
     * It takes an object, a key to search for, a new value to replace the key with, and a depth to search. It returns a new
     * object with the key replaced with the new value
     * @param {any} oldObject - The object you want to replace the properties in.
     * @param {string} searchKey - The key to search for in the object
     * @param {string} newValue - The value you want to replace the searchKey with.
     * @param [depth=5] - The depth of search for the key.
     * @returns A new object with the same properties as the old object, but with the value of the property with the key
     * `searchKey` replaced with `newValue`.
     */
    static replacePropertiesRecursive(oldObject: any, searchKey: string, newValue: string, depth?: number): unknown;
    /**
     * Writes to the console and to the tracer
     * @param {string} action - The action that is being logged.
     * @param {ILogData} logData - ILogData = defaultLogData
     * @param context - The context object that is passed to the logger.
     * @returns The Logger instance.
     */
    private write;
    /**
     * Format & Log output to the console If the config says so
     */
    private consoleWrite;
}
export {};
