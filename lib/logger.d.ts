import Tracer, { ITracerConfig, LogContext } from './tracer';
import { opentracing } from 'jaeger-client';
export declare type ILogData = {
    [key: string]: unknown;
    queNumber?: number;
    type?: 'error' | 'info';
    message?: string;
    data?: {
        args?: any[];
        query?: string;
        model?: {
            name: string;
        };
        type?: string;
        instance?: {
            dataValues: unknown;
        };
    };
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
declare type ILoggerRequiredConfig = Required<Pick<ILoggerConfig, 'excludeClasses' | 'consoleDepth'>>;
export declare const defaultConfig: ILoggerConfig & ILoggerRequiredConfig;
export declare const LOGGER: unique symbol;
export default class Logger {
    readonly serviceName: string;
    readonly type: symbol;
    readonly tracer: Tracer;
    readonly context: LogContext | undefined;
    readonly config: ILoggerConfig & ILoggerRequiredConfig;
    isToCloseContext: boolean;
    constructor(serviceName: string, options?: ILoggerOptions);
    /**
     * Every logger context should be closed at the end, otherwise spans are not saved.
     */
    finish(): void;
    write(action: string, logData?: ILogData, context?: opentracing.Span | undefined): Logger;
    /**
     * Format & Log output to the console If the config says so
     */
    private consoleWrite;
    info(action: string, logData?: ILogData, context?: LogContext): Logger;
    error(actionOrError: string | Error | unknown, logData?: ILogData, context?: LogContext): Logger;
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
     * @param func - function to be called
     * @param args - arguments for provided function
     */
    wrapCall: <T = unknown>(contextName: string, function_: Function, ...arguments_: any) => T | Promise<T> | Promise<{
        args?: any[] | undefined;
        query?: string | undefined;
        model?: {
            name: string;
        } | undefined;
        type?: string | undefined;
        instance?: {
            dataValues: unknown;
        } | undefined;
    } | undefined>;
    /**
     * Useful for getting nested logs.
     * Returns a new Logger instance with the given name and parentContext.
     * *don't forget to close this sub logger on completion!*
     */
    getSubLogger(name: string, parentContext?: opentracing.Span | undefined): Logger;
    /**
     * It takes an array of arguments and returns a new array of arguments with all the heavy objects removed
     *
     * @param {any[]} args - any[] - the arguments to be simplified
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
}
export {};
