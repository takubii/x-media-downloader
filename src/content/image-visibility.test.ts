import { describe, expect, test } from "vitest";

import { isPointInsideRect } from "./image-visibility";

describe("isPointInsideRect", () => {
  test("detects whether a point is inside or on the edge of a rectangle", () => {
    const rect = {
      left: 10,
      right: 110,
      top: 20,
      bottom: 70,
    } as DOMRect;

    expect(isPointInsideRect(10, 20, rect)).toBe(true);
    expect(isPointInsideRect(110, 70, rect)).toBe(true);
    expect(isPointInsideRect(60, 45, rect)).toBe(true);
    expect(isPointInsideRect(9, 45, rect)).toBe(false);
    expect(isPointInsideRect(60, 71, rect)).toBe(false);
  });
});
