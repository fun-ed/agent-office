// The configuration options an ACP agent advertises for a session (`configOptions` on session/new,
// session/resume and session/set_config_option): finding the model and the reasoning effort among
// them, and matching what was asked for against the values they offer. Shared by every ACP worker
// (see dsh.ts); pure, so tests drive it directly.
import { AGENT_EFFORTS, type AgentEffort } from '../shared/providers.js';

type Rec = Record<string, unknown>;

function isRec(value: unknown): value is Rec {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** The choices a select configuration option advertises, flattened across its groups. */
export function configOptionValues(option: unknown): { value: string; name?: string }[] {
  if (!isRec(option) || !Array.isArray(option.options)) return [];
  const values: { value: string; name?: string }[] = [];
  const add = (entry: unknown): void => {
    if (!isRec(entry)) return;
    const value = str(entry.value);
    if (value) values.push({ value, name: str(entry.name) });
  };
  for (const entry of option.options) {
    // Model options arrive grouped by provider: [{group, name, options: [...]}].
    if (isRec(entry) && Array.isArray(entry.options)) for (const inner of entry.options) add(inner);
    else add(entry);
  }
  return values;
}

/** The model inside an advertised route value, which DSH serializes as a JSON [provider, model] pair. */
function routeModel(value: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && typeof parsed[parsed.length - 1] === 'string') return String(parsed[parsed.length - 1]);
  } catch {
    // Not a route tuple: the value is already the id itself.
  }
  return undefined;
}

/**
 * Match what someone typed against the live catalog. DSH model values are opaque route tuples
 * (`["deepseek-official","deepseek-v4-pro"]`), so a person is far more likely to type the model
 * name: accept the exact value, the option's label, or the model inside the tuple. Anything that
 * matches nothing is passed through unchanged and the harness has the final say.
 */
export function resolveConfigValue(input: string, option: unknown): string {
  const wanted = input.trim();
  const values = configOptionValues(option);
  if (!values.length) return wanted;
  const exact = values.find((entry) => entry.value === wanted);
  if (exact) return exact.value;
  const byLabel = values.find((entry) => entry.name?.toLowerCase() === wanted.toLowerCase());
  if (byLabel) return byLabel.value;
  const byModel = values.find((entry) => (routeModel(entry.value) ?? '').toLowerCase() === wanted.toLowerCase());
  return byModel ? byModel.value : wanted;
}

/**
 * The office's effort levels on DSH's ladder (`off`, `low`, `high`, `max`). The office offers one
 * shared set for Claude and DSH, so the middle levels land on the nearest rung DSH has.
 */
export function dshEffort(effort: AgentEffort): string {
  if (effort === 'low') return 'low';
  if (effort === 'xhigh' || effort === 'max') return 'max';
  return 'high'; // medium and high: DSH's default balance
}

/**
 * The option for `category` (ACP's `model` or `thought_level`), or the one with `id` when an agent
 * leaves categories out (DeepSeek Harness's `reasoning_effort`).
 */
export function findConfigOption(options: readonly unknown[], category: string, id: string): Rec | undefined {
  const all = options.filter(isRec);
  return all.find((entry) => str(entry.category) === category) ?? all.find((entry) => str(entry.id) === id);
}

/**
 * The office's effort on the agent's own ladder: the same level when it offers it, else the nearest
 * one it has, rounding up on a tie (DSH's `low`/`high`/`max`, OpenCode's `medium` alone). With no
 * level of the office's on offer, the effort is passed on as it is and the agent has the last word.
 */
export function nearestEffort(effort: AgentEffort, option: unknown): string {
  const rank = (value: string) => AGENT_EFFORTS.indexOf(value as AgentEffort);
  const offered = configOptionValues(option).map((entry) => entry.value).filter((value) => rank(value) >= 0);
  if (!offered.length || offered.includes(effort)) return effort;
  const want = rank(effort);
  return offered.reduce((best, value) => {
    const d = Math.abs(rank(value) - want);
    const bd = Math.abs(rank(best) - want);
    return d < bd || (d === bd && rank(value) > rank(best)) ? value : best;
  });
}
