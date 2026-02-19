import { describe, it, expect } from "vitest";
import { checkRateLimit, getRateLimitKey } from "./rateLimit";

describe("rateLimit", () => {
  it("getRateLimitKey returns prefix:identifier", () => {
    expect(getRateLimitKey("user1", "ticket:create")).toBe("ticket:create:user1");
  });

  it("allows first request", () => {
    const r = checkRateLimit("rl-test-first");
    expect(r.ok).toBe(true);
  });

  it("allows requests under limit", () => {
    const key = "rl-test-under-" + Date.now();
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(key);
      expect(r.ok).toBe(true);
    }
  });

  it("returns ok:false when over limit", () => {
    const key = "rl-test-over-" + Date.now();
    let last: ReturnType<typeof checkRateLimit> = { ok: true };
    for (let i = 0; i < 35; i++) {
      last = checkRateLimit(key);
      if (!last.ok) break;
    }
    expect(last.ok).toBe(false);
    if (!last.ok) expect(typeof (last as { retryAfterMs: number }).retryAfterMs).toBe("number");
  });
});
