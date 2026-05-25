const { spawn } = require('child_process');
const readline = require('readline');
const electronPath = require('electron');

const STDERR_FILTERS = [
  /Missing converter for bitField: irsdk_PaceFlags/,
];

const child = spawn(electronPath, ['.', ...process.argv.slice(2)], {
  stdio: ['inherit', 'pipe', 'pipe'],
});

child.stdout.pipe(process.stdout);

readline.createInterface({ input: child.stderr }).on('line', (line) => {
  if (!STDERR_FILTERS.some((re) => re.test(line))) {
    process.stderr.write(line + '\n');
  }
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
