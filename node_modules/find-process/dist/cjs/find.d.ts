import { ProcessInfo, FindConfig, FindMethod } from './types';
/**
 * find process by condition
 *
 * return Promise: [{
 *   pid: <process id>,
 *   ppid: <process parent id>,
 *   uid: <user id (*nix)>,
 *   gid: <user group id (*nix)>,
 *   name: <command name>,
 *   cmd: <process run args>
 * }, ...]
 *
 * If no process found, resolve process with empty array (only reject when error occured)
 *
 * @param {String} by condition: port/pid/name ...
 * @param {Mixed} condition value
 * @param {Boolean|Option}
 * @return {Promise}
 */
declare function find(by: FindMethod, value: string | RegExp | number, options?: FindConfig | boolean): Promise<ProcessInfo[]>;
export default find;
//# sourceMappingURL=find.d.ts.map