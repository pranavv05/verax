import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "../../src/components/ErrorBoundary";

const Bomb = () => {
  throw new Error("boom");
};

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders children normally when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  test("renders the recovery screen instead of a blank page when a child throws during render", () => {
    // React logs the error to the console by default; silence it for this
    // expected-throw test so the test output stays clean.
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reload page/i })).toBeInTheDocument();
  });

  test("the reload button triggers a page reload", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reloadSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload: reloadSpy }
    });

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: /reload page/i }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });
});
