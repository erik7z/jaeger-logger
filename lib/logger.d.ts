import Tracer, { ITracerConfig, LogContext } from './tracer';
import { opentracing } from 'jaeger-client';
export declare type ILogData = {
    [key: string]: any;
    queNumber?: any;
    type?: 'error' | 'info';
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
    db: (query?: string, data?: any) => void;
    /**
     * Static error logger to use without 'new'
     * logs an error and throws it
     * @deprecated **uses default config where connection to jaeger not set, so tracer will not work**
     */
    static logError(e: Error, ctx: any | ILogData, serviceName?: string): void;
    /**
     * Wrap function call input/output
     * Creates sub span in logger context and records function request/response
     * @param contextName - name of the span
     * @param func - function to be called
     * @param args - arguments for provided function
     */
    wrapCall: <T = any>(contextName: string, func: any, ...args: any) => T;
    /**
     * Useful for getting nested logs.
     * Returns a new Logger instance with the given name and parentContext.
     * *don't forget to close this sub logger on completion!*
     */
    getSubLogger(name: string, parentContext?: opentracing.Span | undefined): Logger;
    /**
     * It takes an array of arguments and returns a new array of arguments with all the heavy objects removed
     * @param {any[]} args - any[] - the arguments to be simplified
     * @param {string[]} excludeClasses - An array of class names that you want to exclude from the logging.
     * @returns An array of objects
     */
    static simplifyArgs(args: any[], excludeClasses?: string[]): any[];
    /**
     * finds arg nested property by provided class name and replaces it with class name (string).
     * modifies original value.
     */
    static replaceClassesRecursive(arg: any, classNames: string[], depth?: number): any;
    /**
     * finds Buffers in args recursively and replaces them with string 'Buffer'.
     * modifies original value.
     */
    static replaceBufferRecursive(arg: any, depth?: number): any;
}
export {};
