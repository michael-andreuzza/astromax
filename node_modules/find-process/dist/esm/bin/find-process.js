#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import log from 'loglevel';
import find from '../index.js';
import pkg from '../../../package.json.js';
const logger = log.getLogger('find-process');
let type, keyword = '';
program
    .version(pkg.version)
    .option('-t, --type <type>', 'find process by keyword type (pid|port|name)')
    .option('-p, --port', 'find process by port')
    .option('-v, --verbose', 'print execute command')
    .option('-d, --debug', 'print debug info for issue reporting')
    .arguments('<keyword>')
    .action(function (kw) {
    keyword = kw;
})
    .on('--help', () => {
    console.log();
    console.log('  Examples:');
    console.log();
    console.log('    $ find-process node          # find by name "node"');
    console.log('    $ find-process 111           # find by pid "111"');
    console.log('    $ find-process -p 80         # find by port "80"');
    console.log('    $ find-process -t port 80    # find by port "80"');
    console.log();
})
    .showHelpAfterError()
    .parse(process.argv);
const opts = program.opts();
// check keyword
if (!keyword) {
    console.error(chalk.red('Error: search keyword cannot be empty!'));
    program.outputHelp();
    process.exit(1);
}
// check type
if (opts.port) {
    type = 'port';
}
else if (!opts.type) {
    // pid or port
    if (/^\d+$/.test(String(keyword))) {
        type = 'pid';
        keyword = Number(keyword);
    }
    else {
        type = 'name';
    }
}
else {
    type = opts.type;
}
logger.debug('find process by: type = %s, keyword = "%s"', type, keyword);
const config = {
    verbose: opts.verbose || false,
    debug: opts.debug || false
};
const DIVIDER = '='.repeat(60) + '\n';
if (config.debug) {
    const header = `[debug] Platform : ${process.platform}\n` +
        `[debug] Node     : ${process.version}\n` +
        `[debug] Version  : ${pkg.version}\n\n`;
    process.stderr.write(chalk.gray(header));
}
function printDebugFooter() {
    const footer = '[debug] Please copy the above output and attach it to your issue:\n' +
        '[debug] https://github.com/yibn2008/find-process/issues\n';
    process.stderr.write(chalk.gray(footer));
    process.stderr.write('\n' + DIVIDER);
}
find(type, keyword, config)
    .then((list) => {
    if (config.debug) {
        printDebugFooter();
    }
    // exclude the find-process CLI process itself
    list = list.filter(item => item.pid !== process.pid);
    if (list.length) {
        console.log('Found %s process' + (list.length === 1 ? '' : 'es') + '\n', list.length);
        for (const item of list) {
            console.log(chalk.cyan('[%s]'), item.name || 'unknown');
            console.log('pid: %s', chalk.white(item.pid));
            console.log('cmd: %s', chalk.white(item.cmd));
            console.log();
        }
    }
    else {
        console.log('No process found');
    }
}, (err) => {
    if (config.debug) {
        printDebugFooter();
    }
    console.error(chalk.red(err.stack || err));
    process.exit(1);
});
//# sourceMappingURL=find-process.js.map