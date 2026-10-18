// Agents with an ACP server of their own: Oh My Pi (`omp acp`), Codex's adapter (`codex-acp`),
// OpenCode (`opencode acp`) and Devin (`devin acp`). Like DeepSeek Harness there's no terminal and
// no hooks: the office starts the server through `mise exec --` (see workers/acp.ts), holds the ACP
// connection and draws its updates into the worker's terminal (see ../dsh.ts). Prompts, resume, the
// model and the effort all go over ACP, never on the command line.
import type { AgentProvider } from '../../shared/providers.js';
import type { ProviderAdapter } from './types.js';

/** An agent whose ACP server is `serve(args)`, where `args` is the office's --agent-args when it's the configured --agent. */
function acpAgent(id: AgentProvider, serve: (args: string[]) => string[]): ProviderAdapter {
  return { id, launch: ({ args }) => ({ args: serve(args) }), transport: 'acp', mise: true, usage: { persisted: true } };
}

// omp takes its options ahead of the subcommand (`omp --model=… acp`); the others after it.
export const omp = acpAgent('omp', (args) => [...args, 'acp']);
export const codexAcp = acpAgent('codex-acp', (args) => args);
export const opencodeAcp = acpAgent('opencode-acp', (args) => ['acp', ...args]);
export const devin = acpAgent('devin', (args) => ['acp', ...args]);
