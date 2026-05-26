#!/usr/bin/env node
// Zero external deps - uses only Node.js built-ins
import { createInterface } from 'readline';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');
const UNINSTALL = args.includes('--uninstall');
const ONLY = (() => { const i = args.indexOf('--only'); return i >= 0 ? args[i + 1] : null; })();

const IMAGE = 'ghcr.io/neto-developer/mcp-ipm:latest';

const CONFIG_DIR = platform() === 'win32'
  ? join(process.env['APPDATA'] ?? homedir(), 'mcp-ipm')
  : join(homedir(), '.config', 'mcp-ipm');
const ENV_FILE = join(CONFIG_DIR, '.env');

function run(cmd) {
  if (DRY_RUN) { console.log(`  [dry-run] ${cmd}`); return; }
  execSync(cmd, { stdio: 'inherit' });
}

function ask(rl, question, defaultVal) {
  return new Promise(resolve => {
    const prompt = defaultVal ? `${question} [${defaultVal}]: ` : `${question}: `;
    rl.question(prompt, answer => resolve(answer.trim() || defaultVal || ''));
  });
}

function detectClients() {
  const clients = [];
  const hasCmd = (cmd) => {
    try { execSync(`${cmd} --version`, { stdio: 'pipe' }); return true; } catch { return false; }
  };
  if (hasCmd('claude')) clients.push({ id: 'claude', label: 'Claude Code' });
  if (hasCmd('opencode')) clients.push({ id: 'opencode', label: 'OpenCode' });
  if (hasCmd('codex')) clients.push({ id: 'codex', label: 'Codex' });
  return clients;
}

function getClaudeSettingsPath() {
  // Claude Code CLI uses ~/.claude/settings.json on all platforms
  return join(homedir(), '.claude', 'settings.json');
}

function getOpenCodeConfigPath() {
  const base = platform() === 'win32'
    ? join(process.env['APPDATA'] ?? homedir(), 'opencode')
    : join(homedir(), '.config', 'opencode');
  return join(base, 'opencode.json');
}

function claudeMcpCliAvailable() {
  try { execSync('claude mcp --help', { stdio: 'pipe' }); return true; } catch { return false; }
}

function registerClaude(envFilePath) {
  if (!FORCE) {
    try {
      const list = execSync('claude mcp list', { stdio: 'pipe' }).toString();
      if (list.includes('mcp-ipm')) {
        console.log('  Claude Code: mcp-ipm already registered (use --force to overwrite)');
        return;
      }
    } catch {}
  }

  if (DRY_RUN) {
    console.log(`  [dry-run] claude mcp add mcp-ipm -- docker run -i --rm --env-file "${envFilePath}" ${IMAGE}`);
    return;
  }

  if (claudeMcpCliAvailable()) {
    execSync(
      `claude mcp add mcp-ipm -- docker run -i --rm --env-file "${envFilePath}" ${IMAGE}`,
      { stdio: 'inherit' }
    );
  } else {
    // Fallback: edit settings.json directly
    const settingsPath = getClaudeSettingsPath();
    let settings = {};
    if (existsSync(settingsPath)) {
      try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); } catch {}
    }
    settings.mcpServers = settings.mcpServers ?? {};
    settings.mcpServers['mcp-ipm'] = {
      command: 'docker',
      args: ['run', '-i', '--rm', '--env-file', envFilePath, IMAGE],
    };
    mkdirSync(join(settingsPath, '..'), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  }
  console.log('  Claude Code: mcp-ipm registered');
}

function unregisterClaude() {
  try {
    execSync('claude mcp remove mcp-ipm', { stdio: 'inherit' });
    console.log('  Claude Code: mcp-ipm removed');
    return;
  } catch {}
  // Fallback: edit settings.json directly
  const settingsPath = getClaudeSettingsPath();
  if (!existsSync(settingsPath)) return;
  let settings = {};
  try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')); } catch { return; }
  if (!settings.mcpServers?.['mcp-ipm']) { console.log('  Claude Code: not registered, skipping'); return; }
  delete settings.mcpServers['mcp-ipm'];
  if (!DRY_RUN) writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  console.log('  Claude Code: mcp-ipm removed');
}

function registerOpenCode(envFilePath) {
  const cfgPath = getOpenCodeConfigPath();
  let cfg = {};
  if (existsSync(cfgPath)) {
    try { cfg = JSON.parse(readFileSync(cfgPath, 'utf8')); } catch {}
  }
  cfg.mcp = cfg.mcp ?? {};
  if (cfg.mcp['mcp-ipm'] && !FORCE) {
    console.log('  OpenCode: mcp-ipm already registered (use --force to overwrite)');
    return;
  }
  cfg.mcp['mcp-ipm'] = {
    command: 'docker',
    args: ['run', '-i', '--rm', '--env-file', envFilePath, IMAGE],
  };
  if (!DRY_RUN) {
    mkdirSync(join(cfgPath, '..'), { recursive: true });
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  }
  console.log('  OpenCode: mcp-ipm registered');
}

function unregisterOpenCode() {
  const cfgPath = getOpenCodeConfigPath();
  if (!existsSync(cfgPath)) return;
  let cfg = {};
  try { cfg = JSON.parse(readFileSync(cfgPath, 'utf8')); } catch { return; }
  if (!cfg.mcp?.['mcp-ipm']) { console.log('  OpenCode: not registered, skipping'); return; }
  delete cfg.mcp['mcp-ipm'];
  if (!DRY_RUN) writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  console.log('  OpenCode: mcp-ipm removed');
}

async function main() {
  console.log('\nmcp-ipm installer\n');

  if (UNINSTALL) {
    console.log('Removing mcp-ipm from all detected clients...');
    const clients = detectClients();
    for (const c of clients) {
      if (ONLY && c.id !== ONLY) continue;
      if (c.id === 'claude') unregisterClaude();
      if (c.id === 'opencode') unregisterOpenCode();
    }
    console.log('\nDone. Restart your MCP client.\n');
    return;
  }

  // 1. Check Docker
  try { execSync('docker info', { stdio: 'pipe' }); }
  catch { console.error('Docker not running or not installed. Install at https://docker.com'); process.exit(1); }

  // 2. Pull image (best-effort - image may not be published yet)
  console.log(`Pulling ${IMAGE}...`);
  try {
    run(`docker pull ${IMAGE}`);
  } catch {
    console.log(`  Warning: could not pull ${IMAGE} (image may not be published yet).`);
    console.log('  The MCP will work once the image is available on GHCR.');
  }

  // 3. Detect clients
  const clients = detectClients();
  if (clients.length === 0) {
    console.log('No supported MCP clients detected (claude, opencode, codex).');
    console.log('Install a client and re-run, or use --only <client>.');
    process.exit(0);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  // 4. Select clients
  console.log('\nDetected MCP clients:');
  clients.forEach((c, i) => console.log(`  [${i + 1}] ${c.label}`));
  console.log('  [a] all');
  console.log('  [q] quit');

  let selected = clients;
  if (!ONLY) {
    const answer = await ask(rl, '\nSelect clients (comma-separated numbers, or a)', 'a');
    if (answer === 'q') { rl.close(); return; }
    if (answer !== 'a') {
      const nums = answer.split(/[,\s]+/).map(n => parseInt(n, 10) - 1);
      selected = nums.filter(i => i >= 0 && i < clients.length).map(i => clients[i]);
    }
  } else {
    selected = clients.filter(c => c.id === ONLY);
  }

  // 5. Collect credentials
  console.log('\nCredentials (stored in ' + ENV_FILE + '):\n');
  const user = await ask(rl, 'NFSE_USER (CPF/CNPJ somente digitos)', '');
  const pass = await ask(rl, 'NFSE_PASS (senha IPM)', '');
  const cadastro = await ask(rl, 'NFSE_CADASTRO (codigo cadastro prestador)', '');
  const cidade = await ask(rl, 'NFSE_CIDADE (codigo TOM, Ibirama/SC = 8135)', '8135');
  rl.close();

  // 6. Save .env
  const envContent = [
    `NFSE_USER=${user}`,
    `NFSE_PASS=${pass}`,
    `NFSE_CADASTRO=${cadastro}`,
    `NFSE_CIDADE=${cidade}`,
  ].join('\n') + '\n';

  if (!DRY_RUN) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(ENV_FILE, envContent, { mode: 0o600 });
  }
  console.log(`\nCredentials saved to ${ENV_FILE}`);

  // 7. Register in each client
  console.log('\nRegistering mcp-ipm...');
  for (const c of selected) {
    if (c.id === 'claude') registerClaude(ENV_FILE);
    if (c.id === 'opencode') registerOpenCode(ENV_FILE);
    if (c.id === 'codex') console.log('  Codex: add manually to your .codex/config - see README');
  }

  console.log('\nDone! Restart your MCP client to activate mcp-ipm.\n');
}

main().catch(err => { console.error(err.message); process.exit(1); });
