import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActionButton } from "../../src/presentation/ui/ActionButton";
import { expectNamedInteractiveControl } from "../helpers/interaction-contract";

describe("ActionButton interaction contract", () => {
  it("announces and disables its pending state", () => {
    render(
      <ActionButton state="pending" pendingLabel="Saving changes…">
        Save changes
      </ActionButton>,
    );
    const button = screen.getByRole("button", { name: "Saving changes…" });
    expectNamedInteractiveControl(button, "Saving changes…");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it.each(["primary", "secondary", "danger"] as const)(
    "exposes the explicit %s variant",
    (variant) => {
      render(<ActionButton variant={variant}>Done</ActionButton>);
      expect(screen.getByRole("button", { name: "Done" })).toHaveAttribute(
        "data-variant",
        variant,
      );
    },
  );
});
