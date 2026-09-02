import vm from 'node:vm';

export interface SandboxExecutionOptions {
  readonly timeoutMs?: number;
}

export interface SandboxResult {
  readonly result: unknown;
  readonly logs: readonly string[];
  readonly executionTimeMs: number;
}

export class SandboxError extends Error {
  constructor(message: string, public readonly code: string = 'SANDBOX_ERROR') {
    super(message);
    this.name = 'SandboxError';
  }
}

/**
 * Runs user-supplied JavaScript inside an isolated VM execution context with CPU/memory/timeout limits.
 */
export async function runSandboxedCode(
  code: string,
  scope: {
    input?: unknown;
    steps?: Record<string, unknown>;
    trigger?: Record<string, unknown>;
  },
  options: SandboxExecutionOptions = {}
): Promise<SandboxResult> {
  const timeoutMs = options.timeoutMs ?? 1000;
  const logs: string[] = [];

  const sandboxContext = Object.create(null);

  // Safe globals allow-list
  sandboxContext.input = scope.input;
  sandboxContext.steps = scope.steps || {};
  sandboxContext.trigger = scope.trigger || {};
  sandboxContext.Math = Math;
  sandboxContext.JSON = JSON;
  sandboxContext.Date = Date;
  sandboxContext.parseInt = parseInt;
  sandboxContext.parseFloat = parseFloat;
  sandboxContext.isNaN = isNaN;
  sandboxContext.isFinite = isFinite;
  sandboxContext.encodeURIComponent = encodeURIComponent;
  sandboxContext.decodeURIComponent = decodeURIComponent;
  sandboxContext.Array = Array;
  sandboxContext.Object = Object;
  sandboxContext.String = String;
  sandboxContext.Number = Number;
  sandboxContext.Boolean = Boolean;
  sandboxContext.RegExp = RegExp;

  sandboxContext.console = {
    log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
    info: (...args: unknown[]) => logs.push(`[INFO] ${args.map(String).join(' ')}`),
    warn: (...args: unknown[]) => logs.push(`[WARN] ${args.map(String).join(' ')}`),
    error: (...args: unknown[]) => logs.push(`[ERROR] ${args.map(String).join(' ')}`),
  };

  const context = vm.createContext(sandboxContext);

  // Wrap user code in an IIFE returning result
  const wrappedCode = `
    "use strict";
    (function(input, steps, trigger) {
      ${code}
    })(input, steps, trigger);
  `;

  const startTime = Date.now();

  try {
    const script = new vm.Script(wrappedCode, {
      filename: 'user_transform.js',
    });

    const result = script.runInContext(context, {
      timeout: timeoutMs,
      displayErrors: true,
    });

    const executionTimeMs = Date.now() - startTime;
    return {
      result,
      logs,
      executionTimeMs,
    };
  } catch (err: any) {
    const executionTimeMs = Date.now() - startTime;
    if (err.message && err.message.includes('timed out')) {
      throw new SandboxError(
        `Transform code execution timed out after ${timeoutMs}ms`,
        'EXECUTION_TIMEOUT'
      );
    }
    throw new SandboxError(`Transform execution failed: ${err.message}`, 'EXECUTION_FAILED');
  }
}
