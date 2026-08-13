"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugLog = debugLog;
const child_process_1 = require("child_process");
const chalk_1 = __importDefault(require("chalk"));
const UNIT_MB = 1024 * 1024;
const utils = {
    /**
     * exec command with maxBuffer size
     */
    exec(cmd, callback) {
        const options = {
            maxBuffer: 2 * UNIT_MB,
            windowsHide: true,
            encoding: 'utf8'
        };
        (0, child_process_1.exec)(cmd, options, callback);
    },
    /**
     * spawn command
     */
    spawn(cmd, args, options) {
        return (0, child_process_1.spawn)(cmd, args, options);
    },
    /**
     * Strip top lines of text
     *
     * @param  {String} text
     * @param  {Number} num
     * @return {String}
     */
    stripLine(text, num) {
        let idx = 0;
        while (num-- > 0) {
            const nIdx = text.indexOf('\n', idx);
            if (nIdx >= 0) {
                idx = nIdx + 1;
            }
        }
        return idx > 0 ? text.substring(idx) : text;
    },
    /**
     * Split string and stop at max parts
     *
     * @param  {Number} line
     * @param  {Number} max
     * @return {Array}
     */
    split(line, max) {
        const cols = line.trim().split(/\s+/);
        if (cols.length > max) {
            cols[max - 1] = cols.slice(max - 1).join(' ');
        }
        return cols;
    },
    /**
     * Extract columns from table text
     *
     * Example:
     *
     * ```
     * extractColumns(text, [0, 2], 3)
     * ```
     *
     * From:
     * ```
     * foo       bar        bar2
     * valx      valy       valz
     * ```
     *
     * To:
     * ```
     * [ ['foo', 'bar2'], ['valx', 'valz'] ]
     * ```
     *
     * @param  {String} text  raw table text
     * @param  {Array} idxes  the column index list to extract
     * @param  {Number} max   max column number of table
     * @return {Array}
     */
    extractColumns(text, idxes, max) {
        const lines = text.split(/(\r\n|\n|\r)/);
        const columns = [];
        if (!max) {
            max = Math.max.apply(null, idxes) + 1;
        }
        lines.forEach(line => {
            const cols = utils.split(line, max);
            const column = [];
            idxes.forEach(idx => {
                column.push(cols[idx] || '');
            });
            columns.push(column);
        });
        return columns;
    },
    /**
     * parse table text to array
     *
     * From:
     * ```
     * Header1 : foo
     * Header2 : bar
     * Header3 : val
     *
     * Header1 : foo2
     * Header2 : bar2
     * Header3 : val2
     * ```
     *
     * To:
     * ```
     * [{ Header1: 'foo', Header2: 'bar', Header3: 'val' }, ...]
     * ```
     *
     * @param  {String} data raw table data
     * @return {Array}
     */
    parseTable(data) {
        const lines = data.split(/(\r\n\r\n|\r\n\n|\n\r\n|\n\n)/).filter(line => {
            return line && line.trim().length > 0;
        }).map((e) => e.split(/(\r\n|\n|\r)/).filter(line => line.trim().length > 0));
        // Join multi-ligne value
        lines.forEach((line) => {
            for (let index = 0; line[index];) {
                const entry = line[index];
                if (entry.startsWith(' ')) {
                    line[index - 1] += entry.trimLeft();
                    line.splice(index, 1);
                }
                else {
                    index += 1;
                }
            }
        });
        return lines.map(line => {
            const row = {};
            line.forEach((string) => {
                const splitterIndex = string.indexOf(':');
                const key = string.slice(0, splitterIndex).trim();
                row[key] = string.slice(splitterIndex + 1).trim();
            });
            return row;
        });
    }
};
function debugLog(config, msg, stdout, stderr) {
    if (!config.debug)
        return;
    let text = `[debug] ${msg}\n`;
    if (stdout !== undefined || stderr !== undefined) {
        text += `[debug] stdout:\n${(stdout || '').trim() || '(empty)'}\n` +
            `[debug] stderr:\n${(stderr || '').trim() || '(empty)'}\n`;
    }
    text += '\n';
    process.stderr.write(chalk_1.default.gray(text));
}
exports.default = utils;
//# sourceMappingURL=utils.js.map