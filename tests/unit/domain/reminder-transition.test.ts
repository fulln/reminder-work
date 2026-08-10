import { describe, expect, it } from "vitest";

import {
  assertTransition,
  canTransition,
  isTerminal,
} from "../../../src/domain/reminder/reminder";

describe("reminder transitions", () => {
  it("permits the verification and acknowledgement lifecycle", () => {
    expect(canTransition("draft", "pending_verification")).toBe(true);
    expect(canTransition("pending_verification", "active")).toBe(true);
    expect(canTransition("active", "completed")).toBe(true);
  });

  it("rejects reactivation of terminal reminders", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(() => {
      assertTransition("completed", "active");
    }).toThrow(/REMINDER_TRANSITION_INVALID/);
  });
});
