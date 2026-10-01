import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const PACKAGE_LOAD_TIMEOUT_MS = 30_000;

describe('n8n package load', () => {
  it('loads the compiled node module without requiring ESM-only codex-sdk at import time', () => {
    expect(() => require('../dist/nodes/ProDex/ProDex.node.js')).not.toThrow();
  }, PACKAGE_LOAD_TIMEOUT_MS);

  it('loads the setup node module', () => {
    expect(() => require('../dist/nodes/ProDexSetup/ProDexSetup.node.js')).not.toThrow();
  }, PACKAGE_LOAD_TIMEOUT_MS);

  it('loads the chat model node module', () => {
    expect(() => require('../dist/nodes/ProDexChatModel/ProDexChatModel.node.js')).not.toThrow();
  }, PACKAGE_LOAD_TIMEOUT_MS);
});
