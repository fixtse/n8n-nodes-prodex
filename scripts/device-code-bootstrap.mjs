#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return {};
  const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  const payload = Buffer.from(normalized + padding, 'base64').toString('utf8');
  return JSON.parse(payload);
}

function decodeJwtExpiry(accessToken) {
  try {
    const payload = decodeJwtPayload(accessToken);
    if (typeof payload.exp === 'number') {
      return new Date(payload.exp * 1000).toISOString();
    }
  } catch {
    // fall through
  }
  return new Date(Date.now() + 3600 * 1000).toISOString();
}

function extractAccountId(accessToken, fallback = '') {
  try {
    const payload = decodeJwtPayload(accessToken);
    const auth = payload && payload['https://api.openai.com/auth'];
    if (auth && typeof auth === 'object' && auth.chatgpt_account_id) {
      return auth.chatgpt_account_id;
    }
    return (payload && payload.sub) || fallback;
  } catch {
    return fallback;
  }
}

function getCodexHome() {
  return process.env.CODEX_HOME || join(homedir(), '.codex');
}

function resolveCodexScript() {
  try {
    return require.resolve('@openai/codex/bin/codex.js');
  } catch {
    return null;
  }
}

function authJsonToCredential(authJson) {
  const tokens = authJson?.tokens;
  if (!tokens?.access_token || !tokens?.refresh_token) {
    throw new Error(
      'No ChatGPT tokens found in Codex auth.json. Complete `codex login --device-auth` first.',
    );
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    idToken: tokens.id_token,
    accountId: tokens.account_id || extractAccountId(tokens.access_token),
    expiresAt: decodeJwtExpiry(tokens.access_token),
  };
}

function runCodexDeviceLogin(codexScript) {
  return new Promise((resolve, reject) => {
    const args = codexScript ? [codexScript, 'login', '--device-auth'] : ['login', '--device-auth'];
    const command = codexScript ? process.execPath : 'codex';
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
      shell: !codexScript,
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Codex login failed with exit code ${code ?? 'unknown'}`));
    });
  });
}

async function main() {
  const exportExisting = process.argv.includes('--export-existing');
  const codexHome = getCodexHome();
  const authPath = join(codexHome, 'auth.json');
  const codexScript = resolveCodexScript();

  if (!exportExisting || !existsSync(authPath)) {
    process.stdout.write(
      'Starting ChatGPT device login via the official Codex CLI (avoids Cloudflare blocks on direct API calls)...\n\n',
    );

    if (!codexScript) {
      process.stdout.write(
        'Could not resolve @openai/codex locally. Falling back to `codex` on your PATH.\n',
      );
    }

    await runCodexDeviceLogin(codexScript);
  } else {
    process.stdout.write(`Using existing Codex auth at ${authPath}\n\n`);
  }

  if (!existsSync(authPath)) {
    throw new Error(`Expected Codex auth file at ${authPath} after login.`);
  }

  const authJson = JSON.parse(readFileSync(authPath, 'utf8'));
  const result = authJsonToCredential(authJson);

  process.stdout.write('\nPaste these values into the n8n ProDex Auth API credential:\n\n');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.stderr.write(
    '\nIf login still fails, run `npx @openai/codex login --device-auth` manually, then retry with:\n  npx @fixtse/n8n-nodes-prodex --export-existing\n',
  );
  process.exit(1);
});
