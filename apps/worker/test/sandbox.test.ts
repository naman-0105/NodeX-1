import { describe, it, expect } from 'vitest';
import { runSandboxedCode, SandboxError } from '../src/engine/sandbox.js';

describe('Isolated JavaScript VM Sandbox', () => {
  it('executes user transform scripts and returns values', async () => {
    const code = `
      const discount = input.isVip ? 0.2 : 0.05;
      const total = input.subtotal * (1 - discount);
      return {
        total,
        discountApplied: discount,
      };
    `;

    const res = await runSandboxedCode(code, {
      input: { subtotal: 100, isVip: true },
    });

    expect(res.result).toEqual({
      total: 80,
      discountApplied: 0.2,
    });
    expect(res.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('captures logs produced via console.log', async () => {
    const code = `
      console.log('Calculating taxes for', input.name);
      console.info('Done');
      return input.name.toUpperCase();
    `;

    const res = await runSandboxedCode(code, {
      input: { name: 'Alice' },
    });

    expect(res.result).toBe('ALICE');
    expect(res.logs).toContain('Calculating taxes for Alice');
    expect(res.logs).toContain('[INFO] Done');
  });

  it('enforces execution timeout on infinite loops', async () => {
    const infiniteLoopCode = `
      while (true) {
        // block thread
      }
    `;

    await expect(
      runSandboxedCode(infiniteLoopCode, {}, { timeoutMs: 100 })
    ).rejects.toThrow(SandboxError);

    await expect(
      runSandboxedCode(infiniteLoopCode, {}, { timeoutMs: 100 })
    ).rejects.toThrow(/timed out/);
  });

  it('blocks access to node/environment globals (process, require, fetch)', async () => {
    const maliciousCode1 = `return typeof process;`;
    const res1 = await runSandboxedCode(maliciousCode1, {});
    expect(res1.result).toBe('undefined');

    const maliciousCode2 = `return typeof require;`;
    const res2 = await runSandboxedCode(maliciousCode2, {});
    expect(res2.result).toBe('undefined');

    const maliciousCode3 = `return typeof fetch;`;
    const res3 = await runSandboxedCode(maliciousCode3, {});
    expect(res3.result).toBe('undefined');
  });

  it('handles syntax and runtime errors safely', async () => {
    const invalidCode = `const a = null; return a.nonExistent.property;`;

    await expect(runSandboxedCode(invalidCode, {})).rejects.toThrow(SandboxError);
  });
});
