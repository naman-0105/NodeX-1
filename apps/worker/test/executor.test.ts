import { describe, it, expect } from 'vitest';
import { executeWorkflow } from '../src/engine/executor.js';
import type { WorkflowDefinition } from '@nodex/shared';

describe('End-to-End Workflow Execution Engine', () => {
  it('executes a multi-step deterministic workflow: Trigger -> Transform -> IF -> Branch', async () => {
    const workflow: WorkflowDefinition = {
      nodes: [
        {
          id: 'trigger_node',
          type: 'trigger',
          config: {},
        },
        {
          id: 'calc_discount',
          type: 'transform',
          config: {
            code: `
              const subtotal = trigger.amount;
              const isVip = trigger.isVip;
              const discountRate = isVip ? 0.25 : 0.05;
              return {
                subtotal,
                discount: subtotal * discountRate,
                finalTotal: subtotal * (1 - discountRate),
              };
            `,
          },
        },
        {
          id: 'check_vip_threshold',
          type: 'if',
          config: {
            expression: 'steps.calc_discount.output.result.finalTotal >= 100',
          },
        },
        {
          id: 'high_value_action',
          type: 'transform',
          config: {
            code: 'return { status: "high_value_approved", audit: steps.calc_discount.output.result };',
          },
        },
        {
          id: 'standard_value_action',
          type: 'transform',
          config: {
            code: 'return { status: "standard_processed" };',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger_node', target: 'calc_discount' },
        { id: 'e2', source: 'calc_discount', target: 'check_vip_threshold' },
        {
          id: 'e3',
          source: 'check_vip_threshold',
          target: 'high_value_action',
          sourceHandle: 'true',
        },
        {
          id: 'e4',
          source: 'check_vip_threshold',
          target: 'standard_value_action',
          sourceHandle: 'false',
        },
      ],
    };

    // Run with High Value ($200, isVip: true => finalTotal: $150 >= 100 => True branch)
    const resultHigh = await executeWorkflow(workflow, {
      triggerPayload: { amount: 200, isVip: true },
    });

    expect(resultHigh.status).toBe('COMPLETED');
    expect(resultHigh.stepResults['trigger_node'].status).toBe('SUCCEEDED');
    expect(resultHigh.stepResults['calc_discount'].status).toBe('SUCCEEDED');
    expect(resultHigh.stepResults['check_vip_threshold'].status).toBe('SUCCEEDED');
    expect(resultHigh.stepResults['high_value_action'].status).toBe('SUCCEEDED');
    expect(resultHigh.stepResults['standard_value_action'].status).toBe('SKIPPED');

    const highActionOutput = resultHigh.stepOutputs['high_value_action'] as any;
    expect(highActionOutput.result.status).toBe('high_value_approved');
    expect(highActionOutput.result.audit.finalTotal).toBe(150);

    // Run with Low Value ($50, isVip: false => finalTotal: $47.50 < 100 => False branch)
    const resultLow = await executeWorkflow(workflow, {
      triggerPayload: { amount: 50, isVip: false },
    });

    expect(resultLow.status).toBe('COMPLETED');
    expect(resultLow.stepResults['high_value_action'].status).toBe('SKIPPED');
    expect(resultLow.stepResults['standard_value_action'].status).toBe('SUCCEEDED');

    const lowActionOutput = resultLow.stepOutputs['standard_value_action'] as any;
    expect(lowActionOutput.result.status).toBe('standard_processed');
  });

  it('stops and reports failure when a node fails', async () => {
    const failingWorkflow: WorkflowDefinition = {
      nodes: [
        { id: 'trigger_1', type: 'trigger', config: {} },
        {
          id: 'bad_transform',
          type: 'transform',
          config: {
            code: 'throw new Error("Explicit business logic failure in node");',
          },
        },
        {
          id: 'downstream_node',
          type: 'transform',
          config: { code: 'return "should never run";' },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger_1', target: 'bad_transform' },
        { id: 'e2', source: 'bad_transform', target: 'downstream_node' },
      ],
    };

    const res = await executeWorkflow(failingWorkflow, { triggerPayload: {} });

    expect(res.status).toBe('FAILED');
    expect(res.stepResults['trigger_1'].status).toBe('SUCCEEDED');
    expect(res.stepResults['bad_transform'].status).toBe('FAILED');
    expect(res.stepResults['downstream_node'].status).toBe('SKIPPED');
    expect(res.error?.message).toContain('Explicit business logic failure in node');
  });
});
