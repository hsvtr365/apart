import { readFileSync, writeFileSync, mkdirSync, chmodSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const label = 'com.village20.mac-bot', target = `gui/${process.getuid()}/${label}`;
const plist = path.join(os.homedir(), 'Library/LaunchAgents', label + '.plist');
const command = process.argv[2];
const launch = args => execFileSync('/bin/launchctl', args, { stdio: 'ignore' });
try {
  if (process.platform !== 'darwin') throw new Error();
  if (command === 'install') {
    const logs = path.join(root, 'data/mac'); mkdirSync(logs, { recursive: true, mode: 0o700 }); chmodSync(logs, 0o700);
    const xml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    const source = readFileSync(path.join(root, 'deploy/com.village20.mac-bot.plist.template'), 'utf8')
      .replace('__NODE_ABSOLUTE_PATH__', xml(process.execPath)).replaceAll('/Users/suji/app/kakaoBot', xml(root));
    mkdirSync(path.dirname(plist), { recursive: true });
    if (existsSync(plist) && readFileSync(plist, 'utf8') !== source) throw new Error();
    writeFileSync(plist, source, { mode: 0o600 });
    try { launch(['print', target]); console.log('Service is already installed.'); }
    catch { launch(['bootstrap', `gui/${process.getuid()}`, plist]); console.log('Service installed. Recheck permissions in this GUI LaunchAgent context.'); }
  } else if (command === 'remove') {
    if (existsSync(plist) && !readFileSync(plist, 'utf8').includes(root)) throw new Error();
    try { launch(['bootout', target]); } catch {}
    if (existsSync(plist)) unlinkSync(plist);
    console.log('Bot automatic startup removed.');
  } else if (command === 'restart') {
    launch(['kickstart', '-k', target]); console.log('Bot service restarted.');
  } else { console.error('Usage: node scripts/service.mjs install|restart|remove'); process.exitCode = 1; }
} catch { console.error('Service action failed. Check the existing bot process, plist and GUI session.'); process.exitCode = 1; }
