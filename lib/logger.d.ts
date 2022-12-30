import Tracer, { ITracerConfig, LogSpan } from './tracer';
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
    readonly tracer: Tracer | undefined;
    readonly context: LogSpan | undefined;
    readonly config: ILoggerConfig & ILoggerRequiredConfig;
    isToCloseContext: boolean;
    constructor(serviceName: string, options?: ILoggerOptions);
    /**
     * Every logger context should be closed at the end, otherwise spans are not saved.
     */
    finish(): void;
    closeTracer(): void;
    write(action: string, logData?: ILogData, context?: opentracing.Span | undefined): Logger;
    /**
     * Format & Log output to the console If the config says so
     */
    private consoleWrite;
    info(action: string, logData?: ILogData, context?: LogSpan): Logger;
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
}
export {};
