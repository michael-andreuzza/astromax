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
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const utils_1 = __importStar(require("./utils"));
function matchName(text, name) {
    if (!name) {
        return true;
    }
    // make sure text.match is valid, fix #30
    if (text && text.match) {
        return text.match(name) !== null;
    }
    return false;
}
function fetchBin(cmd) {
    const pieces = cmd.split(path.sep);
    const last = pieces[pieces.length - 1];
    if (last) {
        pieces[pieces.length - 1] = last.split(' ')[0];
    }
    const fixed = [];
    for (const part of pieces) {
        const optIdx = part.indexOf(' -');
        if (optIdx >= 0) {
            // case: /aaa/bbb/ccc -c
            fixed.push(part.substring(0, optIdx).trim());
            break;
        }
        else if (part.endsWith(' ')) {
            // case: node /aaa/bbb/ccc.js
            fixed.push(part.trim());
            break;
        }
        fixed.push(part);
    }
    return fixed.join(path.sep);
}
function fetchName(fullpath) {
    if (process.platform === 'darwin') {
        const idx = fullpath.indexOf('.app/');
        if (idx >= 0) {
            return path.basename(fullpath.substring(0, idx));
        }
    }
    return path.basename(fullpath);
}
const finders = {
    darwin(cond) {
        return new Promise((resolve, reject) => {
            let cmd;
            if ('pid' in cond && cond.pid !== undefined) {
                cmd = `ps -p ${cond.pid} -ww -o pid,ppid,uid,gid,args`;
            }
            else {
                cmd = 'ps ax -ww -o pid,ppid,uid,gid,args';
            }
            if (cond.config.verbose) {
                console.info('Query command: ' + cmd);
            }
            utils_1.default.exec(cmd, function (err, stdout, stderr) {
                (0, utils_1.debugLog)(cond.config, cmd, stdout || '', stderr || '');
                if (err) {
                    if ('pid' in cond && cond.pid !== undefined) {
                        // when pid not exists, call `ps -p ...` will cause error, we have to
                        // ignore the error and resolve with empty array
                        resolve([]);
                    }
                    else {
                        reject(err);
                    }
                }
                else {
                    const stderrStr = stderr.toString().trim();
                    if (stderrStr) {
                        reject(new Error(stderrStr));
                        return;
                    }
                    const data = utils_1.default.stripLine(stdout.toString(), 1);
                    const columns = utils_1.default.extractColumns(data, [0, 1, 2, 3, 4], 5).filter(column => {
                        if (column[0] && cond.pid !== undefined) {
                            return column[0] === String(cond.pid);
                        }
                        else if (column[4] && cond.name) {
                            return matchName(column[4], cond.name);
                        }
                        else {
                            return !!column[0];
                        }
                    });
                    let list = columns.map(column => {
                        const cmd = String(column[4]);
                        const bin = fetchBin(cmd);
                        return {
                            pid: parseInt(column[0], 10),
                            ppid: parseInt(column[1], 10),
                            uid: parseInt(column[2], 10),
                            gid: parseInt(column[3], 10),
                            name: fetchName(bin),
                            bin,
                            cmd: column[4]
                        };
                    });
                    if (cond.config.strict && cond.name) {
                        list = list.filter(item => item.name === cond.name);
                    }
                    resolve(list);
                }
            });
        });
    },
    win32(cond) {
        return new Promise((resolve, reject) => {
            const cmd = '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance -className win32_process | select Name,ProcessId,ParentProcessId,CommandLine,ExecutablePath';
            const lines = [];
            if (cond.config.verbose) {
                console.info('Query command: ' + cmd);
            }
            const proc = utils_1.default.spawn('powershell.exe', ['/c', cmd], { detached: false, windowsHide: true });
            proc.stdout.on('data', (data) => {
                lines.push(data.toString());
            });
            proc.on('error', (err) => {
                reject(new Error('Command \'' + cmd + '\' failed with reason: ' + err.toString()));
            });
            proc.on('close', (code) => {
                (0, utils_1.debugLog)(cond.config, cmd, lines.join(''), '');
                if (code !== 0) {
                    return reject(new Error('Command \'' + cmd + '\' terminated with code: ' + code));
                }
                const list = utils_1.default.parseTable(lines.join(''))
                    .filter(row => {
                    if (cond.pid !== undefined) {
                        return row.ProcessId === String(cond.pid);
                    }
                    else if (cond.name) {
                        const rowName = row.Name || ''; // fix #40
                        if (cond.config.strict) {
                            return rowName === cond.name || (rowName.endsWith('.exe') && rowName.slice(0, -4) === cond.name);
                        }
                        else {
                            // fix #9
                            return matchName(row.CommandLine || rowName, cond.name);
                        }
                    }
                    else {
                        return true;
                    }
                })
                    .map(row => ({
                    pid: parseInt(row.ProcessId, 10),
                    ppid: parseInt(row.ParentProcessId, 10),
                    bin: row.ExecutablePath,
                    name: row.Name || '',
                    cmd: row.CommandLine
                }));
                resolve(list);
            });
        });
    },
    android(cond) {
        return new Promise((resolve, reject) => {
            const cmd = 'ps';
            if (cond.config.verbose) {
                console.info('Query command: ' + cmd);
            }
            utils_1.default.exec(cmd, function (err, stdout, stderr) {
                (0, utils_1.debugLog)(cond.config, cmd, stdout || '', stderr || '');
                if (err) {
                    if (cond.pid !== undefined) {
                        // when pid not exists, call `ps -p ...` will cause error, we have to
                        // ignore the error and resolve with empty array
                        resolve([]);
                    }
                    else {
                        reject(err);
                    }
                }
                else {
                    const stderrStr = stderr.toString().trim();
                    if (stderrStr) {
                        reject(new Error(stderrStr));
                        return;
                    }
                    const data = utils_1.default.stripLine(stdout.toString(), 1);
                    const columns = utils_1.default.extractColumns(data, [0, 3], 4).filter(column => {
                        if (column[0] && cond.pid !== undefined) {
                            return column[0] === String(cond.pid);
                        }
                        else if (column[1] && cond.name) {
                            return matchName(column[1], cond.name);
                        }
                        else {
                            return !!column[0];
                        }
                    });
                    let list = columns.map(column => {
                        const cmd = String(column[1]);
                        const bin = fetchBin(cmd);
                        return {
                            pid: parseInt(column[0], 10),
                            ppid: 0,
                            name: fetchName(bin),
                            bin,
                            cmd: column[1]
                        };
                    });
                    if (cond.config.strict && cond.name) {
                        list = list.filter(item => item.name === cond.name);
                    }
                    resolve(list);
                }
            });
        });
    }
};
// Alias for other platforms
finders.linux = finders.darwin;
finders.sunos = finders.darwin;
finders.freebsd = finders.darwin;
function findProcess(cond) {
    const platform = process.platform;
    const finder = finders[platform];
    if (!finder) {
        return Promise.reject(new Error(`Platform "${platform}" is not supported`));
    }
    return finder(cond);
}
exports.default = findProcess;
//# sourceMappingURL=find_process.js.map