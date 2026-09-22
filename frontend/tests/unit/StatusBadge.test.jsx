import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "../../src/components/ui/StatusBadge";

describe("StatusBadge", () => {
  test("renders the review_required status with the friendlier 'Needs Review' label", () => {
    render(<StatusBadge status="review_required" />);
    expect(screen.getByText("Needs Review")).toBeInTheDocument();
  });

  test("renders a known status with underscores replaced by spaces", () => {
    render(<StatusBadge status="extracted" />);
    expect(screen.getByText("extracted")).toBeInTheDocument();
  });

  test("falls back to 'unknown' styling and label for an unrecognized status", () => {
    render(<StatusBadge status="totally_made_up_status" />);
    expect(screen.getByText("totally made up status")).toBeInTheDocument();
  });

  test("defaults to 'unknown' when status is missing entirely", () => {
    render(<StatusBadge />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });

  test("normalizes status case (e.g. 'EXPORTED' renders the same as 'exported')", () => {
    render(<StatusBadge status="EXPORTED" />);
    expect(screen.getByText("exported")).toBeInTheDocument();
  });
});
