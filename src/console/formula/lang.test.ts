import { describe, expect, it } from "vitest";
import {
  EvalError,
  ParseError,
  evaluate,
  makeRegistry,
  parse,
  run,
} from "./lang";

describe("parse — literals", () => {
  it("parses positive integers", () => {
    expect(parse("42")).toEqual({ kind: "lit", value: 42 });
  });

  it("parses negative integers", () => {
    expect(parse("-5")).toEqual({ kind: "lit", value: -5 });
  });

  it("parses decimals", () => {
    expect(parse("3.14")).toEqual({ kind: "lit", value: 3.14 });
    expect(parse("-0.5")).toEqual({ kind: "lit", value: -0.5 });
  });

  it("parses strings", () => {
    expect(parse('"hello"')).toEqual({ kind: "lit", value: "hello" });
    expect(parse('""')).toEqual({ kind: "lit", value: "" });
  });

  it("rejects unterminated strings", () => {
    expect(() => parse('"hello')).toThrow(ParseError);
  });
});

describe("parse — identifiers", () => {
  it("parses simple identifiers as var refs", () => {
    expect(parse("sensex")).toEqual({ kind: "var", name: "sensex" });
  });

  it("allows underscores and digits in identifiers", () => {
    expect(parse("foo_bar2")).toEqual({ kind: "var", name: "foo_bar2" });
  });

  it("requires identifiers to start with letter or underscore", () => {
    // 2foo would be parsed as number "2" followed by ident "foo" → error
    expect(() => parse("2foo")).toThrow(ParseError);
  });
});

describe("parse — calls", () => {
  it("parses no-arg call", () => {
    expect(parse("now()")).toEqual({ kind: "call", name: "now", args: [] });
  });

  it("parses single-arg call", () => {
    expect(parse("len(x)")).toEqual({
      kind: "call",
      name: "len",
      args: [{ kind: "var", name: "x" }],
    });
  });

  it("parses multi-arg call", () => {
    expect(parse("cagr(sensex, 1979, 2025)")).toEqual({
      kind: "call",
      name: "cagr",
      args: [
        { kind: "var", name: "sensex" },
        { kind: "lit", value: 1979 },
        { kind: "lit", value: 2025 },
      ],
    });
  });

  it("parses nested calls", () => {
    const ast = parse("rebaseTo100(denominate(sensex, gold), 1991)");
    expect(ast).toEqual({
      kind: "call",
      name: "rebaseTo100",
      args: [
        {
          kind: "call",
          name: "denominate",
          args: [
            { kind: "var", name: "sensex" },
            { kind: "var", name: "gold" },
          ],
        },
        { kind: "lit", value: 1991 },
      ],
    });
  });

  it("rejects unclosed parens", () => {
    expect(() => parse("cagr(sensex, 1979")).toThrow(ParseError);
  });

  it("rejects trailing tokens", () => {
    expect(() => parse("foo() bar")).toThrow(ParseError);
  });

  it("rejects empty input", () => {
    expect(() => parse("")).toThrow(ParseError);
    expect(() => parse("   ")).toThrow(ParseError);
  });
});

describe("evaluate", () => {
  const registry = makeRegistry(
    [
      {
        name: "add",
        description: "add two numbers",
        arity: [2],
        fn: (a, b) => (a as number) + (b as number),
      },
      {
        name: "sum",
        description: "sum n numbers",
        arity: [1, 2, 3],
        fn: (...args) => args.reduce((s: number, x) => s + (x as number), 0),
      },
      {
        name: "concat",
        description: "concat strings",
        arity: [2],
        fn: (a, b) => `${a}${b}`,
      },
      {
        name: "fail",
        description: "always throws",
        arity: [0],
        fn: () => {
          throw new Error("oops");
        },
      },
    ],
    [
      { name: "pi", description: "π", value: 3.14159 },
      { name: "greeting", description: "g", value: "hello" },
    ],
  );

  it("evaluates literals", () => {
    expect(evaluate({ kind: "lit", value: 42 }, registry)).toBe(42);
  });

  it("resolves variables", () => {
    expect(run("pi", registry)).toBe(3.14159);
    expect(run("greeting", registry)).toBe("hello");
  });

  it("evaluates simple calls", () => {
    expect(run("add(2, 3)", registry)).toBe(5);
    expect(run("concat(\"foo\", \"bar\")", registry)).toBe("foobar");
  });

  it("evaluates nested calls", () => {
    expect(run("add(add(1, 2), add(3, 4))", registry)).toBe(10);
  });

  it("supports variadic-ish arity via multiple values", () => {
    expect(run("sum(1)", registry)).toBe(1);
    expect(run("sum(1, 2)", registry)).toBe(3);
    expect(run("sum(1, 2, 3)", registry)).toBe(6);
  });

  it("rejects unknown variable", () => {
    expect(() => run("nonexistent", registry)).toThrow(EvalError);
  });

  it("rejects unknown function", () => {
    expect(() => run("nope()", registry)).toThrow(EvalError);
  });

  it("rejects arity mismatch", () => {
    expect(() => run("add(1)", registry)).toThrow(/expects 2 args, got 1/);
    expect(() => run("add(1, 2, 3)", registry)).toThrow(/expects 2 args, got 3/);
  });

  it("propagates impl errors with function name", () => {
    expect(() => run("fail()", registry)).toThrow(/fail\(\): oops/);
  });
});

describe("safety / non-features", () => {
  const registry = makeRegistry([], []);

  it("does not support arithmetic operators", () => {
    expect(() => parse("1 + 2")).toThrow(ParseError);
    expect(() => parse("a * b")).toThrow(ParseError);
  });

  it("does not support assignment", () => {
    expect(() => parse("x = 1")).toThrow(ParseError);
  });

  it("does not support control flow", () => {
    expect(() => parse("if true then 1 else 2")).toThrow(ParseError);
  });

  it("does not access globals or eval", () => {
    // The evaluator only reads the registry; identifiers aren't resolved
    // against any global scope. This is the safety bedrock of the language.
    expect(() => run("globalThis", registry)).toThrow(/Unknown name/);
    expect(() => run("window", registry)).toThrow(/Unknown name/);
    expect(() => run("eval(\"1+1\")", registry)).toThrow(/Unknown function/);
  });
});
