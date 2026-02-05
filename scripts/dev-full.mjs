import { spawn } from 'node:child_process';
import process from 'node:process';

const isWindows = process.platform === 'win32';

function run(command, args) {
  return spawn(command, args, {
    stdio: 'inherit',
    shell: isWindows,
  });
}

async function main() {
  const init = run('npm', ['--prefix', 'backend', 'run', 'db:init']);
  await new Promise((resolve, reject) => {
    init.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`db:init failed with code ${code}`));
    });
  });

  const backend = run('npm', ['--prefix', 'backend', 'run', 'dev']);
  const frontend = run('npm', ['run', 'dev']);

  const shutdown = () => {
    backend.kill('SIGINT');
    frontend.kill('SIGINT');
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  backend.on('exit', (code) => {
    if (code !== 0) process.exit(code ?? 1);
  });
  frontend.on('exit', (code) => {
    if (code !== 0) process.exit(code ?? 1);
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
