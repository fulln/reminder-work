import { expect } from "vitest";

export function expectNamedInteractiveControl(
  control: HTMLElement,
  name: string,
) {
  expect(control).toHaveAccessibleName(name);
  expect(control).toHaveAttribute("type", "submit");
}
