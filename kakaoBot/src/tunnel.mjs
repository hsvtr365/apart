import { spawn } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { BotError } from './errors.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export class SiteTunnel {
  constructor({ launch = spawn } = {}) { this.launch = launch; this.child = null; this.nextAttempt = 0; this.stopped = false; }
  async ensure() {
    if (this.stopped) return false;
    if (this.child && this.child.exitCode === null && !this.child.signalCode) return true;
    if (Date.now() < this.nextAttempt) return false;
    const free = await new Promise(resolve => {
      const server = createServer();
      server.once('error', () => resolve(false));
      server.listen({ host: '127.0.0.1', port: 28006, exclusive: true }, () => server.close(() => resolve(true)));
    });
    if (!free) throw new BotError('tunnel-port-in-use');
    const child = this.launch('ssh', ['-N', '-o', 'HostName=100.92.167.33', '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=10', '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=30',
      '-o', 'ServerAliveCountMax=3', '-o', 'ControlMaster=no', '-o', 'ControlPath=none',
      '-L', '127.0.0.1:28006:127.0.0.1:28004', 'oci-heartlink-db'], { stdio: 'ignore' });
    this.child = child;
    let failed = false;
    child.on('error', () => { failed = true; });
    for (let attempt = 0; attempt < 100 && !this.stopped; attempt++) {
      if (failed || child.exitCode !== null || child.signalCode) break;
      const ready = await new Promise(resolve => {
        const socket = connect({ host: '127.0.0.1', port: 28006 });
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('error', () => resolve(false));
        socket.setTimeout(100, () => { socket.destroy(); resolve(false); });
      });
      if (ready) return true;
      await delay(100);
    }
    child.kill('SIGTERM'); this.child = null; this.nextAttempt = Date.now() + 30_000;
    return false;
  }
  async close() {
    this.stopped = true;
    const child = this.child;
    this.child = null;
    if (child && child.exitCode === null && !child.signalCode) {
      await new Promise(resolve => {
        const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
        child.once('exit', () => { clearTimeout(timer); resolve(); }); child.kill('SIGTERM');
      });
    }
  }
}
