// Tiny safe expression language for the Formula Lab.
//
// GRAMMAR (LL recursive descent):
//   expr     := call | ident | number | string
//   call     := ident '(' arglist? ')'
//   arglist  := expr (',' expr)*
//   ident    := [A-Za-z_][A-Za-z0-9_]*
//   number   := optional '-', digits, optional '.digits'
//   string   := '"' [^"]* '"'
//
// We DELIBERATELY do not support operators, blocks, assignments, or any
// flow control. Every expression is a single function-call tree. This
// keeps the language trivial to reason about and impossible to abuse —
// no `eval`, no string injection, no global access, no closures.
//
// Examples that parse:
//   42
//   "hello"
//   sensex
//   cagr(sensex, 1979, 2025)
//   rebaseTo100(denominate(sensex, gold), 1991)
//
// Examples that DON'T parse (by design):
//   x + y           — no operators
//   if (x) y else z — no flow control
//   x = 1           — no assignment
//   () => x         — no functions

export type Expr =
  | { kind: "lit"; value: number | string }
  | { kind: "var"; name: string }
  | { kind: "call"; name: string; args: Expr[] };

export class ParseError extends Error {
  constructor(message: string, public readonly position: number) {
    super(message);
  }
}

interface Token {
  kind: "ident" | "number" | "string" | "(" | ")" | ",";
  value: string;
  pos: number;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    // Whitespace
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    // Punctuation
    if (c === "(" || c === ")" || c === ",") {
      tokens.push({ kind: c, value: c, pos: i });
      i++;
      continue;
    }
    // String literal
    if (c === '"') {
      const start = i;
      i++;
      let value = "";
      while (i < src.length && src[i] !== '"') {
        value += src[i];
        i++;
      }
      if (i >= src.length) {
        throw new ParseError("Unterminated string literal", start);
      }
      i++; // skip closing quote
      tokens.push({ kind: "string", value, pos: start });
      continue;
    }
    // Number literal (negative sign only when not preceded by ident/closing paren)
    if (
      /[0-9]/.test(c) ||
      (c === "-" &&
        i + 1 < src.length &&
        /[0-9]/.test(src[i + 1]) &&
        (tokens.length === 0 ||
          tokens[tokens.length - 1].kind === "(" ||
          tokens[tokens.length - 1].kind === ","))
    ) {
      const start = i;
      if (c === "-") i++;
      while (i < src.length && /[0-9]/.test(src[i])) i++;
      if (src[i] === "." && i + 1 < src.length && /[0-9]/.test(src[i + 1])) {
        i++;
        while (i < src.length && /[0-9]/.test(src[i])) i++;
      }
      tokens.push({ kind: "number", value: src.slice(start, i), pos: start });
      continue;
    }
    // Identifier
    if (/[A-Za-z_]/.test(c)) {
      const start = i;
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++;
      tokens.push({ kind: "ident", value: src.slice(start, i), pos: start });
      continue;
    }
    throw new ParseError(`Unexpected character "${c}"`, i);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Expr {
    if (this.tokens.length === 0) {
      throw new ParseError("Empty expression", 0);
    }
    const expr = this.parseExpr();
    if (this.pos < this.tokens.length) {
      throw new ParseError(
        `Unexpected token "${this.tokens[this.pos].value}" after expression`,
        this.tokens[this.pos].pos,
      );
    }
    return expr;
  }

  private parseExpr(): Expr {
    const t = this.tokens[this.pos];
    if (!t) throw new ParseError("Expected expression", -1);
    if (t.kind === "number") {
      this.pos++;
      return { kind: "lit", value: Number(t.value) };
    }
    if (t.kind === "string") {
      this.pos++;
      return { kind: "lit", value: t.value };
    }
    if (t.kind === "ident") {
      this.pos++;
      // call iff next token is '('
      if (this.tokens[this.pos]?.kind === "(") {
        this.pos++;
        const args: Expr[] = [];
        if (this.tokens[this.pos]?.kind !== ")") {
          args.push(this.parseExpr());
          while (this.tokens[this.pos]?.kind === ",") {
            this.pos++;
            args.push(this.parseExpr());
          }
        }
        if (this.tokens[this.pos]?.kind !== ")") {
          throw new ParseError(
            "Expected ')' to close argument list",
            this.tokens[this.pos]?.pos ?? -1,
          );
        }
        this.pos++; // consume ')'
        return { kind: "call", name: t.value, args };
      }
      return { kind: "var", name: t.value };
    }
    throw new ParseError(`Unexpected token "${t.value}"`, t.pos);
  }
}

export function parse(source: string): Expr {
  return new Parser(tokenize(source)).parse();
}

// ─────────────────────────────────────────────────────────────────────────
// Evaluator
// ─────────────────────────────────────────────────────────────────────────

export class EvalError extends Error {}

/** Spec of a callable function exposed to the formula language. */
export interface FunctionSpec {
  /** Function name (as used in source). */
  name: string;
  /** Brief one-line description for the help panel. */
  description: string;
  /** Argument count(s) accepted. e.g. [2, 3] means 2 or 3 args. */
  arity: number[];
  /**
   * Implementation. Receives evaluated args (already coerced to JS values
   * by the evaluator). Should throw on type errors with a clear message.
   */
  fn: (...args: unknown[]) => unknown;
  /** Free-text examples for the help panel. */
  examples?: string[];
}

/** Spec of a named value (e.g. a series) accessible without parens. */
export interface VariableSpec {
  /** Variable name (as used in source). */
  name: string;
  /** Brief description. */
  description: string;
  /** Underlying value — typically a Series, MonthlySeries, or scalar. */
  value: unknown;
}

export interface Registry {
  fns: Map<string, FunctionSpec>;
  vars: Map<string, VariableSpec>;
}

export function makeRegistry(
  fns: FunctionSpec[],
  vars: VariableSpec[],
): Registry {
  return {
    fns: new Map(fns.map((f) => [f.name, f])),
    vars: new Map(vars.map((v) => [v.name, v])),
  };
}

/**
 * Evaluate a parsed expression against a registry. Throws EvalError with a
 * human-readable message on missing names or arity mismatch; relies on the
 * function impl to throw on argument type errors.
 */
export function evaluate(expr: Expr, registry: Registry): unknown {
  if (expr.kind === "lit") return expr.value;
  if (expr.kind === "var") {
    const v = registry.vars.get(expr.name);
    if (!v) {
      throw new EvalError(
        `Unknown name: "${expr.name}". Variables: ${Array.from(registry.vars.keys()).join(", ") || "(none)"}`,
      );
    }
    return v.value;
  }
  // call
  const f = registry.fns.get(expr.name);
  if (!f) {
    throw new EvalError(
      `Unknown function: "${expr.name}". Functions: ${Array.from(registry.fns.keys()).join(", ") || "(none)"}`,
    );
  }
  if (!f.arity.includes(expr.args.length)) {
    throw new EvalError(
      `${expr.name}() expects ${f.arity.join(" or ")} args, got ${expr.args.length}`,
    );
  }
  const args = expr.args.map((a) => evaluate(a, registry));
  try {
    return f.fn(...args);
  } catch (e) {
    if (e instanceof EvalError) throw e;
    throw new EvalError(
      `${expr.name}(): ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

/** Convenience: parse + evaluate in one shot. */
export function run(source: string, registry: Registry): unknown {
  return evaluate(parse(source), registry);
}
