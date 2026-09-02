import { describe, it, expect } from 'vitest';
import {
  evaluateExpression,
  resolveTemplate,
  ExpressionEvaluationError,
} from '../src/engine/evaluator.js';

describe('Safe AST Expression Evaluator (No Eval)', () => {
  const context = {
    steps: {
      http_req: {
        output: {
          status: 200,
          data: {
            user: {
              id: 'usr_999',
              tier: 'premium',
              credits: 150,
            },
          },
        },
      },
      calc: {
        output: {
          tax: 15,
          total: 115,
        },
      },
    },
    trigger: {
      action: 'process_payment',
      amount: 100,
    },
    env: {
      NODE_ENV: 'test',
    },
  };

  it('evaluates arithmetic and comparisons safely', () => {
    expect(evaluateExpression('10 + 20', context)).toBe(30);
    expect(evaluateExpression('50 > 25', context)).toBe(true);
    expect(evaluateExpression('100 / 2 === 50', context)).toBe(true);
    expect(evaluateExpression('100 % 7', context)).toBe(2);
  });

  it('resolves nested step outputs and trigger variables', () => {
    expect(
      evaluateExpression('steps.http_req.output.data.user.credits > 100', context)
    ).toBe(true);
    expect(
      evaluateExpression('steps.http_req.output.data.user.tier === "premium"', context)
    ).toBe(true);
    expect(
      evaluateExpression('trigger.amount + steps.calc.output.tax === steps.calc.output.total', context)
    ).toBe(true);
  });

  it('evaluates logical operators (&&, ||, !)', () => {
    expect(
      evaluateExpression(
        'steps.http_req.output.status === 200 && steps.http_req.output.data.user.tier === "premium"',
        context
      )
    ).toBe(true);
    expect(evaluateExpression('!(steps.http_req.output.status !== 200)', context)).toBe(true);
  });

  it('supports safe built-in functions', () => {
    expect(evaluateExpression('Math.max(10, 50, 20)', context)).toBe(50);
    expect(evaluateExpression('Math.round(4.7)', context)).toBe(5);
    expect(evaluateExpression('String(12345)', context)).toBe('12345');
    expect(evaluateExpression('Boolean(1)', context)).toBe(true);
  });

  it('strictly blocks prototype pollution and forbidden properties', () => {
    expect(() => evaluateExpression('__proto__', context)).toThrow(ExpressionEvaluationError);
    expect(() => evaluateExpression('constructor', context)).toThrow(ExpressionEvaluationError);
    expect(() => evaluateExpression('process.exit()', context)).toThrow(ExpressionEvaluationError);
  });

  it('resolves template strings with interpolation', () => {
    const template = 'User ID: {{ steps.http_req.output.data.user.id }}, Amount: ${{ trigger.amount }}';
    const resolved = resolveTemplate(template, context);
    expect(resolved).toBe('User ID: usr_999, Amount: $100');
  });

  it('preserves native types for exact single expression templates', () => {
    const boolTemplate = '{{ steps.http_req.output.data.user.credits > 100 }}';
    expect(resolveTemplate(boolTemplate, context)).toBe(true);

    const numTemplate = '{{ steps.calc.output.total }}';
    expect(resolveTemplate(numTemplate, context)).toBe(115);

    const objTemplate = '{{ steps.http_req.output.data.user }}';
    expect(resolveTemplate(objTemplate, context)).toEqual({
      id: 'usr_999',
      tier: 'premium',
      credits: 150,
    });
  });

  it('recursively resolves templates inside objects and arrays', () => {
    const config = {
      endpoint: 'https://api.example.com/users/{{ steps.http_req.output.data.user.id }}',
      params: {
        amount: '{{ trigger.amount }}',
        active: '{{ true }}',
      },
      tags: ['vip', '{{ steps.http_req.output.data.user.tier }}'],
    };

    const resolved = resolveTemplate(config, context);
    expect(resolved).toEqual({
      endpoint: 'https://api.example.com/users/usr_999',
      params: {
        amount: 100,
        active: true,
      },
      tags: ['vip', 'premium'],
    });
  });
});
