import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('⚡ Starting Algorithmic Backtester Full-Stack Dev Environment...\n');

const server = spawn('npm', ['--prefix', 'server', 'run', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

const client = spawn('npm', ['--prefix', 'client', 'run', 'dev'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true
});

function cleanup() {
  console.log('\n🛑 Shutting down server and client processes...');
  server.kill('SIGINT');
  client.kill('SIGINT');
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
