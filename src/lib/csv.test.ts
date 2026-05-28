import { describe, expect, test } from "vitest";
import { convertToCsv } from "./csv";

describe("convertToCsv", () => {
  test("converts array of objects to CSV string", () => {
    const rows = [
      { year: 2020, value: 47751, label: "COVID" },
      { year: 2021, value: 58253, label: "Recovery" },
    ];
    const csv = convertToCsv(rows);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("year,value,label");
    expect(lines[1]).toBe('"2020","47751","COVID"');
    expect(lines[2]).toBe('"2021","58253","Recovery"');
  });

  test("escapes double quotes in values", () => {
    const rows = [{ name: 'He said "hello"', value: 42 }];
    const csv = convertToCsv(rows);
    expect(csv).toContain('"He said ""hello"""');
  });

  test("returns empty string for empty array", () => {
    expect(convertToCsv([])).toBe("");
  });

  test("handles single row", () => {
    const rows = [{ a: 1, b: 2 }];
    const csv = convertToCsv(rows);
    expect(csv).toBe('a,b\n"1","2"');
  });

  test("handles missing values gracefully", () => {
    const rows = [{ a: 1, b: undefined as unknown as number }];
    const csv = convertToCsv(rows);
    expect(csv).toContain('""');
  });
});
