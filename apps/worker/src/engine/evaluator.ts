import jsep from 'jsep';
import type { ExpressionEvaluationContext } from '@nodex/shared';

export class ExpressionEvaluationError extends Error {
  constructor(message: string, public readonly code: string = 'EXPRESSION_ERROR') {
    super(message);
    this.name = 'ExpressionEvaluationError';
  }
}

const FORBIDDEN_PROPERTIES = new Set([
  '__proto__',
  'prototype',
  'constructor',
  'eval',
  'Function',
  'process',
  'globalThis',
  'window',
  'document',
  'require',
  'import',
]);

const ALLOWED_GLOBALS: Record<string, unknown> = {
  Math: {
    min: Math.min,
    max: Math.max,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    abs: Math.abs,
  },
  String,
  Number,
  Boolean,
  JSON: {
    stringify: (val: unknown) => JSON.stringify(val),
    parse: (val: string) => JSON.parse(val),
  },
};

/**
 * Creates a smart step scope proxy allowing both `steps.n1.output.x` and `steps.n1.x` syntax.
 */
export function createStepScope(
  stepOutputs: Record<string, unknown>
): Record<string, unknown> {
  const scope: Record<string, unknown> = {};

  for (const [nodeId, data] of Object.entries(stepOutputs || {})) {
    let outputVal: any;
    let errorVal: any;

    if (data && typeof data === 'object' && ('output' in data || 'error' in data)) {
      outputVal = (data as any).output;
      errorVal = (data as any).error;
    } else {
      outputVal = data;
    }

    const outputTarget = outputVal && typeof outputVal === 'object' ? outputVal : {};
    const outputProxy = new Proxy(outputTarget, {
      get(target: any, prop: string | symbol) {
        if (typeof prop !== 'string') return target[prop];
        if (prop in target) return target[prop];
        if (target.result && typeof target.result === 'object' && prop in target.result) {
          return target.result[prop];
        }
        return target[prop];
      },
    });

    const nodeTarget = {
      output: outputProxy,
      error: errorVal,
    };

    scope[nodeId] = new Proxy(nodeTarget, {
      get(target: any, prop: string | symbol) {
        if (typeof prop !== 'string') return target[prop];
        if (prop === 'output') return target.output;
        if (prop === 'error') return target.error;
        if (outputVal && typeof outputVal === 'object') {
          if (prop in outputVal) return outputVal[prop];
          if (outputVal.result && typeof outputVal.result === 'object' && prop in outputVal.result) {
            return outputVal.result[prop];
          }
        }
        return target[prop];
      },
    });
  }

  return scope;
}

/**
 * Safely evaluates an AST expression against an allow-listed execution context.
 */
function evaluateAstNode(node: jsep.Expression, context: Record<string, unknown>): unknown {
  switch (node.type) {
    case 'Literal': {
      return (node as jsep.Literal).value;
    }

    case 'Identifier': {
      const name = (node as jsep.Identifier).name;
      if (FORBIDDEN_PROPERTIES.has(name)) {
        throw new ExpressionEvaluationError(
          `Forbidden property access: ${name}`,
          'FORBIDDEN_IDENTIFIER'
        );
      }
      if (name in context) {
        return context[name];
      }
      if (name in ALLOWED_GLOBALS) {
        return ALLOWED_GLOBALS[name];
      }
      return undefined;
    }

    case 'MemberExpression': {
      const memberNode = node as jsep.MemberExpression;
      const objectVal = evaluateAstNode(memberNode.object, context);
      if (objectVal === null || objectVal === undefined) {
        return undefined;
      }

      let propertyName: string;
      if (memberNode.computed) {
        const computedVal = evaluateAstNode(memberNode.property, context);
        propertyName = String(computedVal);
      } else {
        propertyName = (memberNode.property as jsep.Identifier).name;
      }

      if (FORBIDDEN_PROPERTIES.has(propertyName)) {
        throw new ExpressionEvaluationError(
          `Forbidden property access: ${propertyName}`,
          'FORBIDDEN_PROPERTY'
        );
      }

      return (objectVal as Record<string, unknown>)[propertyName];
    }

    case 'BinaryExpression': {
      const binNode = node as jsep.BinaryExpression;
      const left = evaluateAstNode(binNode.left, context);
      const right = evaluateAstNode(binNode.right, context);

      switch (binNode.operator) {
        case '+':
          return (left as any) + (right as any);
        case '-':
          return (left as any) - (right as any);
        case '*':
          return (left as any) * (right as any);
        case '/':
          return (left as any) / (right as any);
        case '%':
          return (left as any) % (right as any);
        case '==':
          return (left as any) == (right as any);
        case '===':
          return left === right;
        case '!=':
          return (left as any) != (right as any);
        case '!==':
          return left !== right;
        case '<':
          return (left as any) < (right as any);
        case '<=':
          return (left as any) <= (right as any);
        case '>':
          return (left as any) > (right as any);
        case '>=':
          return (left as any) >= (right as any);
        case '&&':
          return Boolean(left) && Boolean(right);
        case '||':
          return Boolean(left) || Boolean(right);
        default:
          throw new ExpressionEvaluationError(
            `Unsupported binary operator: ${binNode.operator}`,
            'UNSUPPORTED_OPERATOR'
          );
      }
    }

    case 'UnaryExpression': {
      const unaryNode = node as jsep.UnaryExpression;
      const arg = evaluateAstNode(unaryNode.argument, context);
      switch (unaryNode.operator) {
        case '!':
          return !arg;
        case '-':
          return -(arg as any);
        case '+':
          return +(arg as any);
        default:
          throw new ExpressionEvaluationError(
            `Unsupported unary operator: ${unaryNode.operator}`,
            'UNSUPPORTED_OPERATOR'
          );
      }
    }

    case 'CallExpression': {
      const callNode = node as jsep.CallExpression;
      const callee = evaluateAstNode(callNode.callee, context);
      if (typeof callee !== 'function') {
        throw new ExpressionEvaluationError(
          'Attempted to call a non-function in expression',
          'INVALID_FUNCTION_CALL'
        );
      }
      const evaluatedArgs = callNode.arguments.map((arg) =>
        arg ? evaluateAstNode(arg, context) : undefined
      );
      return callee(...evaluatedArgs);
    }

    case 'ArrayExpression': {
      const arrayNode = node as jsep.ArrayExpression;
      return arrayNode.elements.map((el) => (el ? evaluateAstNode(el, context) : null));
    }

    default:
      throw new ExpressionEvaluationError(
        `Unsupported expression AST node type: ${node.type}`,
        'UNSUPPORTED_AST_NODE'
      );
  }
}

/**
 * Safely parses and evaluates a single expression string without eval.
 */
export function evaluateExpression(
  expressionString: string,
  context: ExpressionEvaluationContext
): unknown {
  const trimmed = expressionString.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const ast = jsep(trimmed);
    const evalScope: Record<string, unknown> = {
      steps: createStepScope(context.steps as Record<string, unknown>),
      trigger: context.trigger || {},
      env: context.env || {},
    };
    return evaluateAstNode(ast, evalScope);
  } catch (err: any) {
    if (err instanceof ExpressionEvaluationError) {
      throw err;
    }
    throw new ExpressionEvaluationError(
      `Failed to evaluate expression "${expressionString}": ${err.message}`,
      'PARSE_OR_EVAL_ERROR'
    );
  }
}

const TEMPLATE_REGEX = /\{\{\s*(.*?)\s*\}\}/g;

/**
 * Recursively resolves expression templates (e.g. "{{ steps.n1.output.id }}") inside config values.
 */
export function resolveTemplate<T>(template: T, context: ExpressionEvaluationContext): T {
  if (typeof template === 'string') {
    const trimmed = template.trim();
    // If the entire string is exactly a single template `{{ expr }}`, return raw evaluated value to preserve types (boolean, number, object)
    const exactMatch = trimmed.match(/^\{\{\s*(.*?)\s*\}\}$/);
    if (exactMatch && exactMatch[1]) {
      return evaluateExpression(exactMatch[1], context) as T;
    }

    // Otherwise, perform string interpolation
    if (template.includes('{{')) {
      return template.replace(TEMPLATE_REGEX, (_match, expr) => {
        const val = evaluateExpression(expr, context);
        if (val === undefined || val === null) {
          return '';
        }
        if (typeof val === 'object') {
          return JSON.stringify(val);
        }
        return String(val);
      }) as T;
    }
    return template;
  }

  if (Array.isArray(template)) {
    return template.map((item) => resolveTemplate(item, context)) as T;
  }

  if (template !== null && typeof template === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = resolveTemplate(value, context);
    }
    return result as T;
  }

  return template;
}
