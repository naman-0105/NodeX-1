export interface ExpressionEvaluationContext {
  readonly steps: Readonly<Record<string, { output?: unknown; error?: unknown }>>;
  readonly trigger?: Readonly<Record<string, unknown>>;
  readonly env?: Readonly<Record<string, string>>;
}

export type SafeBinaryOperator =
  | '=='
  | '==='
  | '!='
  | '!=='
  | '<'
  | '<='
  | '>'
  | '>='
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '&&'
  | '||';

export type SafeUnaryOperator = '!' | '-' | '+';

export interface EvaluatorOptions {
  readonly timeoutMs?: number;
}
