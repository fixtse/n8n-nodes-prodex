import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { createRequire } from 'module';
import type { ChildProcessWithoutNullStreams } from 'child_process';

export interface AppServerTool {
  name: string;
  description: string;
  inputSchema: unknown;
  invoke: (input: unknown) => Promise<unknown>;
}

export interface RunAppServerAgentParams {
  prompt: string;
  model: string;
  workingDirectory?: string;
  developerInstructions?: string;
  reasoningEffort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  personality: 'default' | 'friendly' | 'pragmatic';
  sandbox: 'read_only' | 'workspace_write' | 'full_access';
  codexHome: string;
  tools: AppServerTool[];
  timeoutMs: number;
}

interface JsonRpcMessage {
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { message?: string; code?: number };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sandboxMode(sandbox: RunAppServerAgentParams['sandbox']): string {
  switch (sandbox) {
    case 'workspace_write':
      return 'workspace-write';
    case 'full_access':
      return 'danger-full-access';
    default:
      return 'read-only';
  }
}

export async function runAppServerAgent(params: RunAppServerAgentParams): Promise<{
  output: string;
  threadId: string;
  toolCalls: Array<{ name: string; arguments: unknown; result: unknown }>;
}> {
  const require = createRequire(__filename);
  const cliPath = require.resolve('@openai/codex/bin/codex.js');
  const child = spawn(
    process.execPath,
    [cliPath, '--config', 'web_search="live"', 'app-server', '--listen', 'stdio://'],
    {
    env: { ...process.env, CODEX_HOME: params.codexHome },
    stdio: ['pipe', 'pipe', 'pipe'],
    },
  ) as ChildProcessWithoutNullStreams;

  const pending = new Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>();
  const toolByCodexName = new Map<string, AppServerTool>();
  const toolCalls: Array<{ name: string; arguments: unknown; result: unknown }> = [];
  let nextId = 0;
  let finalOutput = '';
  let threadId = '';
  let turnError: Error | undefined;
  let resolveTurn: (() => void) | undefined;
  let rejectTurn: ((error: Error) => void) | undefined;
  let rejectStartup: ((error: Error) => void) | undefined;

  const write = (message: Record<string, unknown>) => {
    if (child.stdin.destroyed) throw new Error('Codex app-server closed its input stream.');
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };

  const request = <T>(method: string, requestParams: Record<string, unknown>): Promise<T> => {
    const id = ++nextId;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Codex app-server request timed out: ${method}`));
      }, 30_000);
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      try {
        write({ jsonrpc: '2.0', id, method, params: requestParams });
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  };

  const respondToTool = async (message: JsonRpcMessage) => {
    const id = message.id;
    const call = message.params ?? {};
    const tool = typeof call.tool === 'string' ? toolByCodexName.get(call.tool) : undefined;
    const args = call.arguments ?? {};
    if (id === undefined) return;

    if (!tool) {
      write({ jsonrpc: '2.0', id, result: { success: false, contentItems: [{ type: 'inputText', text: 'Tool not found.' }] } });
      return;
    }

    try {
      const result = await tool.invoke(args);
      toolCalls.push({ name: tool.name, arguments: args, result });
      const content = typeof result === 'string' ? result : JSON.stringify(result);
      write({ jsonrpc: '2.0', id, result: { success: true, contentItems: [{ type: 'inputText', text: content ?? 'null' }] } });
    } catch (error) {
      const messageText = errorMessage(error);
      toolCalls.push({ name: tool.name, arguments: args, result: { error: messageText } });
      write({ jsonrpc: '2.0', id, result: { success: false, contentItems: [{ type: 'inputText', text: messageText }] } });
    }
  };

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      return;
    }

    if (message.id !== undefined && pending.has(message.id)) {
      const entry = pending.get(message.id)!;
      clearTimeout(entry.timer);
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message ?? 'Codex app-server request failed.'));
      else entry.resolve(message.result);
      return;
    }

    if (message.method === 'item/tool/call') {
      void respondToTool(message).catch((error: unknown) => {
        if (message.id !== undefined) {
          write({ jsonrpc: '2.0', id: message.id, result: { success: false, contentItems: [{ type: 'inputText', text: errorMessage(error) }] } });
        }
      });
      return;
    }

    const eventParams = message.params ?? {};
    if (message.method === 'item/completed') {
      const item = eventParams.item as { type?: string; text?: string } | undefined;
      if (item?.type === 'agentMessage' && typeof item.text === 'string') finalOutput = item.text;
    } else if (message.method === 'turn/completed') {
      resolveTurn?.();
    } else if (message.method === 'turn/failed') {
      const error = eventParams.error as { message?: string } | undefined;
      turnError = new Error(error?.message ?? 'Codex turn failed.');
      rejectTurn?.(turnError);
    } else if (message.method === 'error') {
      const error = eventParams.error as { message?: string } | undefined;
      const failure = new Error(error?.message ?? 'Codex app-server error.');
      rejectStartup?.(failure);
      rejectTurn?.(failure);
    }
  };

  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  lines.on('line', handleLine);
  child.stderr.on('data', (chunk: Buffer) => {
    // Keep stderr drained; Codex diagnostics may contain environment details.
    void chunk;
  });

  const appServerClosed = new Promise<never>((_, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (!turnError) reject(new Error(`Codex app-server exited (${signal ?? code ?? 'unknown'}).`));
    });
  });

  const deadline = setTimeout(() => {
    const error = new Error(`Codex agent timed out after ${Math.round(params.timeoutMs / 1000)} seconds.`);
    rejectStartup?.(error);
    rejectTurn?.(error);
    child.kill('SIGTERM');
  }, params.timeoutMs);

  try {
    const startup = new Promise<void>((resolve, reject) => {
      rejectStartup = reject;
      void (async () => {
        await request('initialize', {
          clientInfo: { name: 'n8n-prodex', title: 'ProDex Agent', version: '0.7.1' },
          capabilities: { experimentalApi: true },
        });
        write({ jsonrpc: '2.0', method: 'initialized', params: {} });
        resolve();
      })().catch(reject);
    });
    await Promise.race([startup, appServerClosed]);

    const usedNames = new Set<string>();
    const dynamicTools = params.tools.map((tool) => {
      const baseName = tool.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 110) || 'tool';
      let codexName = baseName;
      let suffix = 2;
      while (usedNames.has(codexName)) codexName = `${baseName}_${suffix++}`;
      usedNames.add(codexName);
      toolByCodexName.set(codexName, tool);
      return {
        type: 'function',
        name: codexName,
        description: tool.description,
        inputSchema: tool.inputSchema,
      };
    });

    const thread = await Promise.race([
      request<Record<string, unknown>>('thread/start', {
        model: params.model,
        cwd: params.workingDirectory || process.cwd(),
        approvalPolicy: 'never',
        sandbox: sandboxMode(params.sandbox),
        developerInstructions: params.developerInstructions,
        personality: params.personality === 'default' ? 'none' : params.personality,
        dynamicTools,
      }),
      appServerClosed,
    ]);
    const threadObject = thread.thread as Record<string, unknown> | undefined;
    threadId = String(threadObject?.id ?? thread.threadId ?? '');
    if (!threadId) throw new Error('Codex app-server did not return a thread ID.');

    const turnFinished = new Promise<void>((resolve, reject) => {
      resolveTurn = resolve;
      rejectTurn = reject;
    });
    await Promise.race([
      request('turn/start', {
        threadId,
        input: [{ type: 'text', text: params.prompt }],
        effort: params.reasoningEffort,
      }),
      appServerClosed,
    ]);
    await Promise.race([turnFinished, appServerClosed]);
    if (turnError) throw turnError;
    return { output: finalOutput, threadId, toolCalls };
  } finally {
    clearTimeout(deadline);
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Codex app-server session ended.'));
    }
    pending.clear();
    lines.close();
    if (!child.killed) child.kill('SIGTERM');
  }
}
