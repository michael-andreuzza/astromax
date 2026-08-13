"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const logger_1 = __importDefault(require("./logger"));
const utils_1 = __importStar(require("./utils"));
const ensureDir = (path) => new Promise((resolve, reject) => {
    if (fs.existsSync(path)) {
        resolve();
    }
    else {
        fs.mkdir(path, err => {
            err ? reject(err) : resolve();
        });
    }
});
/**
 * Execute command and return stdout/stderr as a promise
 */
function execCmd(cmd, config) {
    return new Promise((resolve, reject) => {
        utils_1.default.exec(cmd, function (err, stdout, stderr) {
            (0, utils_1.debugLog)(config, cmd, stdout || '', stderr || '');
            if (err) {
                reject(err);
            }
            else {
                resolve({ stdout: stdout.toString(), stderr: stderr.toString().trim() });
            }
        });
    });
}
/**
 * Check if column's address field ends with :port
 */
function matchPort(column, port) {
    const matches = String(column[0]).match(/:(\d+)$/);
    return matches != null && matches[1] === String(port);
}
function isValidPid(pid) {
    return !isNaN(pid) && pid > 0;
}
function findPidBySs(port, config) {
    return execCmd('ss -tunlp', config).then(({ stdout, stderr }) => {
        if (stderr) {
            logger_1.default.warn(stderr);
        }
        // strip header line
        // Columns: Netid(0) State(1) Recv-Q(2) Send-Q(3) Local Address:Port(4) Peer Address:Port(5) Process(6)
        const data = utils_1.default.stripLine(stdout, 1);
        const columns = utils_1.default.extractColumns(data, [4, 6], 7)
            .find(column => matchPort(column, port));
        if (columns && columns[1]) {
            const pidMatch = String(columns[1]).match(/pid=(\d+)/);
            if (pidMatch) {
                const pid = parseInt(pidMatch[1], 10);
                if (isValidPid(pid)) {
                    return pid;
                }
            }
        }
        throw new Error(`pid of port (${port}) not found`);
    });
}
function findPidByNetstatLinux(port, config) {
    return execCmd('netstat -tunlp', config).then(({ stdout, stderr }) => {
        if (stderr) {
            // netstat -p ouputs warning if user is no-root
            logger_1.default.warn(stderr);
        }
        // replace header
        const data = utils_1.default.stripLine(stdout, 2);
        const columns = utils_1.default.extractColumns(data, [3, 6], 7)
            .find(column => matchPort(column, port));
        if (columns && columns[1]) {
            const pid = parseInt(columns[1].split('/', 1)[0], 10);
            if (isValidPid(pid)) {
                return pid;
            }
        }
        throw new Error(`pid of port (${port}) not found`);
    });
}
function findPidByNetstatDarwin(port, config) {
    return execCmd('netstat -anv -p TCP && netstat -anv -p UDP', config).then(({ stdout, stderr }) => {
        if (stderr) {
            logger_1.default.warn(stderr);
        }
        // Drop group header, e.g. "Active Internet connections"
        const table = utils_1.default.stripLine(stdout, 1);
        // Get the next line with the column headers
        const headers = table.slice(0, table.indexOf('\n'));
        // Drop the header line to get the table body
        const body = utils_1.default.stripLine(table, 1);
        // In macOS >=Sequoia, columns include `rxbytes` and `txbytes`, which
        // shifts the PID column to index 10. Detect this with a search
        // for rxbytes. (Parsing the headers more robustly isn't possible
        // because some colmn names contain spaces, and others are only separated
        // by a single space.)
        const pidColumn = headers.indexOf('rxbytes') >= 0 ? 10 : 8;
        const found = utils_1.default.extractColumns(body, [0, 3, pidColumn], 10)
            .filter(row => {
            return !!String(row[0]).match(/^(udp|tcp)/);
        })
            .find(row => {
            const matches = String(row[1]).match(/\.(\d+)$/);
            if (matches && matches[1] === String(port)) {
                return true;
            }
            return false;
        });
        if (found && found[2].length) {
            // PID column can be "pid" or "processname:pid"
            const pidCell = String(found[2]);
            const pidMatch = pidCell.match(/:(\d+)$/);
            const pid = pidMatch ? parseInt(pidMatch[1], 10) : parseInt(pidCell, 10);
            if (isValidPid(pid)) {
                return pid;
            }
        }
        throw new Error(`pid of port (${port}) not found`);
    });
}
function findPidByLsof(port, config) {
    return execCmd(`lsof -nP -i :${port}`, config).then(({ stdout, stderr }) => {
        if (stderr) {
            logger_1.default.warn(stderr);
        }
        // strip header line
        // lsof columns: COMMAND(0) PID(1) USER(2) ...
        const data = utils_1.default.stripLine(stdout, 1);
        const columns = utils_1.default.extractColumns(data, [1], 2);
        for (const col of columns) {
            const pid = parseInt(col[0], 10);
            if (isValidPid(pid)) {
                return pid;
            }
        }
        throw new Error(`pid of port (${port}) not found`);
    });
}
const finders = {
    darwin(port, config) {
        return findPidByNetstatDarwin(port, config)
            .catch((err) => {
            (0, utils_1.debugLog)(config, `netstat failed (${err.message}), falling back to lsof`);
            return findPidByLsof(port, config);
        });
    },
    linux(port, config) {
        return findPidBySs(port, config)
            .catch((err) => {
            (0, utils_1.debugLog)(config, `ss failed (${err.message}), falling back to netstat`);
            return findPidByNetstatLinux(port, config);
        })
            .catch((err) => {
            (0, utils_1.debugLog)(config, `netstat failed (${err.message}), falling back to lsof`);
            return findPidByLsof(port, config);
        });
    },
    win32(port, config) {
        return execCmd('netstat -ano', config).then(({ stdout, stderr }) => {
            if (stderr) {
                throw new Error(stderr);
            }
            // replace header
            const data = utils_1.default.stripLine(stdout, 4);
            // Extract address(1), and both possible PID positions:
            // TCP has State at index 3, PID at index 4 (5 columns)
            // UDP has no State column, PID at index 3 (4 columns)
            const columns = utils_1.default.extractColumns(data, [1, 3, 4], 5)
                .find(column => matchPort(column, port));
            if (columns) {
                // TCP: PID at index 4 → columns[2]; UDP: PID at index 3 → columns[1]
                const pidStr = columns[2] !== '' ? columns[2] : columns[1];
                const pid = parseInt(pidStr, 10);
                if (isValidPid(pid)) {
                    return pid;
                }
            }
            throw new Error(`pid of port (${port}) not found`);
        });
    },
    android(port, config) {
        return new Promise((resolve, reject) => {
            // on Android Termux, an warning will be emitted when executing `netstat`
            // with option `-p` says 'showing only processes with your user ID', but
            // it can still fetch the information we need. However, NodeJS treat this
            // warning as an error, `util.exec()` will get nothing but the error. To
            // get the true output of the command, we need to save it to a tmpfile and
            // read that file instead.
            const dir = os.tmpdir() + '/.find-process';
            const file = dir + '/' + process.pid;
            const cmd = 'netstat -tunp >> "' + file + '"';
            ensureDir(dir).then(() => {
                utils_1.default.exec(cmd, (_execErr, execStdout, execStderr) => {
                    (0, utils_1.debugLog)(config, cmd, execStdout || '', execStderr || '');
                    fs.readFile(file, 'utf8', (err, data) => {
                        fs.unlink(file, () => { });
                        if (err) {
                            reject(err);
                        }
                        else {
                            data = utils_1.default.stripLine(data, 2);
                            const columns = utils_1.default.extractColumns(data, [3, 6], 7)
                                .find(column => matchPort(column, port));
                            if (columns && columns[1]) {
                                const pid = parseInt(columns[1].split('/', 1)[0], 10);
                                if (isValidPid(pid)) {
                                    resolve(pid);
                                }
                                else {
                                    reject(new Error(`pid of port (${port}) not found`));
                                }
                            }
                            else {
                                reject(new Error(`pid of port (${port}) not found`));
                            }
                        }
                    });
                });
            });
        });
    }
};
// Alias for other platforms
finders.freebsd = finders.darwin;
finders.sunos = finders.darwin;
function findPidByPort(port, config = {}) {
    const platform = process.platform;
    return new Promise((resolve, reject) => {
        if (!(platform in finders)) {
            return reject(new Error(`platform ${platform} is unsupported`));
        }
        const finder = finders[platform];
        finder(port, config).then(resolve, reject);
    });
}
exports.default = findPidByPort;
//# sourceMappingURL=find_pid.js.map