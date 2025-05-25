import { describe, expect, it } from "vitest";

describe("Simple Test", () => {
  it("should pass", () => {
    expect(1 + 1).toBe(2);
  });

  it("should handle basic assertions", () => {
    expect("hello").toBe("hello");
    expect(true).toBeTruthy();
    expect(false).toBeFalsy();
    expect([1, 2, 3]).toHaveLength(3);
  });
});
