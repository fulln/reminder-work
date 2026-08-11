import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TURNSTILE_ACTION,
  TurnstileField,
} from "../../src/presentation/features/reminder-composer/TurnstileField";

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "turnstile");
});

describe("TurnstileField", () => {
  it("keeps the documented local bypass isolated from production rendering", () => {
    const { container } = render(
      <TurnstileField siteKey="site-key" useLocalBypass={true} />,
    );
    expect(
      container.querySelector<HTMLInputElement>('input[name="turnstileToken"]'),
    ).toHaveValue("test-pass");
    expect(container.textContent).not.toContain("Protected by Cloudflare");
  });

  it("stores a real browser token and resets it when the challenge expires", async () => {
    let options:
      | {
          action: string;
          appearance: string;
          callback(token: string): void;
          "expired-callback"(): void;
        }
      | undefined;
    const reset = vi.fn();
    const remove = vi.fn();
    const renderWidget = vi.fn((_: HTMLElement, nextOptions: unknown) => {
      options = nextOptions as typeof options;
      return "widget-1";
    });
    Object.defineProperty(window, "turnstile", {
      configurable: true,
      value: { render: renderWidget, reset, remove },
    });

    const { container, unmount } = render(
      <TurnstileField siteKey="production-site-key" useLocalBypass={false} />,
    );
    await waitFor(() => {
      expect(renderWidget).toHaveBeenCalledOnce();
    });
    expect(options?.action).toBe(TURNSTILE_ACTION);
    expect(options?.appearance).toBe("always");

    act(() => {
      options?.callback("verified-browser-token");
    });
    expect(
      container.querySelector<HTMLInputElement>('input[name="turnstileToken"]'),
    ).toHaveValue("verified-browser-token");

    act(() => {
      options?.["expired-callback"]();
    });
    expect(
      container.querySelector<HTMLInputElement>('input[name="turnstileToken"]'),
    ).toHaveValue("");
    expect(reset).toHaveBeenCalledWith("widget-1");

    unmount();
    expect(remove).toHaveBeenCalledWith("widget-1");
  });
});
