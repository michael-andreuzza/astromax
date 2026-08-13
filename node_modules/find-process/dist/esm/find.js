import findPidByPort from './find_pid.js';
import findProcess from './find_process.js';
import log from './logger.js';
const findBy = {
    port(port, config) {
        return findPidByPort(port, config)
            .then(pid => {
            return findBy.pid(pid, config);
        }, () => {
            // return empty array when pid not found
            return [];
        });
    },
    pid(pid, config) {
        return findProcess({
            pid,
            config
        });
    },
    name(name, config) {
        return findProcess({
            name,
            config
        });
    }
};
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
function find(by, value, options) {
    const config = Object.assign({
        logLevel: 'warn',
        strict: typeof options === 'boolean' ? options : false
    }, typeof options === 'object' ? options : {});
    // strict is applicable only when finding by name and the value is a string,
    // in all other cases whatever is passed is overwritten to false
    if (by !== 'name' || typeof value !== 'string') {
        config.strict = false;
    }
    if (config.logLevel) {
        log.setLevel(config.logLevel);
    }
    return new Promise((resolve, reject) => {
        if (!(by in findBy)) {
            reject(new Error(`do not support find by "${by}"`));
        }
        else {
            const isNumber = /^\d+$/.test(String(value));
            if (by === 'pid' && !isNumber) {
                reject(new Error('pid must be a number'));
            }
            else if (by === 'port' && !isNumber) {
                reject(new Error('port must be a number'));
            }
            else {
                findBy[by](value, config).then(resolve, reject);
            }
        }
    });
}
export default find;
//# sourceMappingURL=find.js.map