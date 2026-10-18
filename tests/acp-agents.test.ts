// Oh My Pi, Codex ACP, OpenCode ACP and Devin: workers the office drives over their own ACP servers,
// started through `mise exec --` (see server/providers/acp.ts and workers/acp.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findConfigOption, nearestEffort } from '../src/server/acp-config.js';
import { DshRenderer } from '../src/server/dsh.js';
import { configuredProvider, providerCommand, validateWorkerModel } from '../src/server/agents.js';
import { PROVIDERS } from '../src/server/providers/index.js';
import { acpCommand } from '../src/server/workers/acp.js';
import { PROVIDER_META } from '../src/shared/providers.js';

const ACP_AGENTS = ['omp', 'codex-acp', 'opencode-acp', 'devin'] as const;

/** A select option with these values, as the agents advertise them. */
const option = (id: string, category: string, values: string[]) => ({ id, category, type: 'select', currentValue: values[0], options: values.map((value) => ({ value, name: value })) });

test('the ACP agents run over ACP through mise, report context usage and take a typed model', () => {
  for (const id of ACP_AGENTS) {
    assert.equal(PROVIDERS[id].transport, 'acp', id);
    assert.equal(PROVIDERS[id].mise, true, id);
    assert.equal(PROVIDER_META[id].usage.context, true, id);
    assert.equal(PROVIDER_META[id].models?.pick, 'typed', id);
    assert.equal(validateWorkerModel('agent', id, 'openai-codex/gpt-6.1-sol'), undefined);
    assert.match(validateWorkerModel('agent', id, 'bad\u0001') ?? '', /model/);
  }
  // Their ACP servers: omp takes its options ahead of the subcommand, the others after it.
  const launch = (id: (typeof ACP_AGENTS)[number], args: string[]) => PROVIDERS[id].launch({ args, cwd: '/w', setup: undefined, h: {} as never }).args;
  assert.deepEqual(launch('omp', ['--model=x']), ['--model=x', 'acp']);
  assert.deepEqual(launch('codex-acp', []), []);
  assert.deepEqual(launch('opencode-acp', ['--port', '0']), ['acp', '--port', '0']);
  assert.deepEqual(launch('devin', []), ['acp']);
});

test('--agent picks the ACP agents by executable, and opencode stays the terminal OpenCode', () => {
  assert.equal(configuredProvider('/home/me/.bun/bin/omp'), 'omp');
  assert.equal(configuredProvider('devin'), 'devin');
  assert.equal(configuredProvider('codex-acp'), 'codex-acp');
  assert.equal(configuredProvider('opencode'), 'opencode');
  assert.equal(providerCommand('opencode-acp', 'claude'), 'opencode');
  // The office's own --agent, when it's this agent; its executable otherwise.
  assert.equal(providerCommand('devin', '/opt/devin'), '/opt/devin');
  assert.equal(providerCommand('devin', 'claude'), 'devin');
});

test('the model and effort are found by ACP category, or by DSH’s ids', () => {
  const devin = [option('mode', 'mode', ['accept-edits']), option('model', 'model', ['swe-2-high']), option('thought_level', 'thought_level', ['medium', 'high', 'max'])];
  assert.equal(findConfigOption(devin, 'thought_level', 'reasoning_effort')?.id, 'thought_level');
  const omp = [option('model', 'model', ['a/b']), option('thinking', 'thought_level', ['off', 'low', 'medium', 'high', 'xhigh', 'max'])];
  assert.equal(findConfigOption(omp, 'thought_level', 'reasoning_effort')?.id, 'thinking');
  // An agent that leaves categories out is matched by id.
  assert.equal(findConfigOption([{ id: 'reasoning_effort', type: 'select', options: [] }], 'thought_level', 'reasoning_effort')?.id, 'reasoning_effort');
  assert.equal(findConfigOption([], 'model', 'model'), undefined);
});

test('the office effort lands on the nearest level each agent offers, rounding up on a tie', () => {
  const devin = option('thought_level', 'thought_level', ['medium', 'high', 'max']);
  assert.equal(nearestEffort('low', devin), 'medium');
  assert.equal(nearestEffort('high', devin), 'high');
  assert.equal(nearestEffort('xhigh', devin), 'max');
  const opencode = option('effort', 'thought_level', ['medium', 'default']);
  assert.equal(nearestEffort('max', opencode), 'medium');
  const dsh = option('reasoning_effort', 'thought_level', ['off', 'low', 'high', 'max']);
  assert.equal(nearestEffort('medium', dsh), 'high');
  assert.equal(nearestEffort('xhigh', dsh), 'max');
  // Nothing the office knows on offer: passed on as it is, for the agent to judge.
  assert.equal(nearestEffort('high', option('x', 'thought_level', ['fast', 'slow'])), 'high');
});

test('an ACP agent starts through mise exec when mise is there, and on its own when not', (t) => {
  const bin = mkdtempSync(path.join(tmpdir(), 'agent-office-mise-'));
  t.after(() => rmSync(bin, { recursive: true, force: true }));
  const pathBefore = process.env.PATH;
  t.after(() => {
    process.env.PATH = pathBefore;
  });
  process.env.PATH = bin;
  // No mise on PATH: the command itself, as found.
  assert.deepEqual(acpCommand('devin', 'devin', '/opt/devin', ['acp']), { file: '/opt/devin', args: ['acp'] });
  writeFileSync(path.join(bin, 'mise'), '#!/bin/sh\n', { mode: 0o700 });
  chmodSync(path.join(bin, 'mise'), 0o700);
  const mise = path.join(bin, 'mise');
  assert.deepEqual(acpCommand('devin', 'devin', undefined, ['acp']), { file: mise, args: ['exec', '--', 'devin', 'acp'] });
  assert.deepEqual(acpCommand('omp', 'omp', '/b/omp', ['acp']), { file: mise, args: ['exec', '--', '/b/omp', 'acp'] });
  // DeepSeek Harness keeps starting on its own.
  assert.deepEqual(acpCommand('dsh', 'dsh', '/b/dsh', ['--profile', 'acp']), { file: '/b/dsh', args: ['--profile', 'acp'] });
});

test('settings an agent resends unchanged are not printed again, a changed one is', () => {
  const r = new DshRenderer();
  const update = (effort: string) => r.render({ sessionUpdate: 'config_option_update', configOptions: [option('model', 'model', ['swe-2-high']), { ...option('thought_level', 'thought_level', ['medium', 'high']), currentValue: effort }] }).text ?? '';
  const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, '');
  assert.match(plain(update('high')), /model → swe-2-high[\s\S]*thought_level → high/);
  assert.equal(update('high'), '');
  assert.equal(plain(update('medium')).trim(), 'thought_level → medium');
});
