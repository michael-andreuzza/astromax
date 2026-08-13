/**
 * Process information interface
 */
export interface ProcessInfo {
    pid: number;
    ppid: number;
    uid?: number;
    gid?: number;
    name: string;
    bin?: string;
    cmd: string;
}
/**
 * Configuration options for find operations
 */
export interface FindConfig {
    logLevel?: 'error' | 'warn' | 'info' | 'debug';
    strict?: boolean;
    verbose?: boolean;
    /** @internal */
    debug?: boolean;
}
/**
 * Condition for finding processes
 */
export interface FindCondition {
    pid?: number;
    name?: string | RegExp;
    config: FindConfig;
}
/**
 * Supported find methods
 */
export type FindMethod = 'port' | 'pid' | 'name';
/**
 * Find function signature
 */
export type FindFunction = (by: FindMethod, value: string | number, options?: FindConfig | boolean) => Promise<ProcessInfo[]>;
/**
 * Platform-specific finder function
 */
export type PlatformFinder = (cond: FindCondition) => Promise<ProcessInfo[]>;
/**
 * Utility function types
 */
export interface Utils {
    exec: (command: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => void;
    spawn: (command: string, args: string[], options: any) => any;
    stripLine: (text: string, count: number) => string;
    split: (line: string, max: number) => string[];
    extractColumns: (text: string, columns: number[], total: number) => string[][];
    parseTable: (text: string) => Record<string, string>[];
}
//# sourceMappingURL=types.d.ts.map