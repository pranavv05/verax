import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "../../src/components/ui/StatusBadge";

describe("StatusBadge", () => {
  test("renders the review_required status with the friendlier 'Needs review' label", () => {
    render(<StatusBadge status="review_required" />);
    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });

  test("describes an extracted document as ready for review", () => {
    render(<StatusBadge status="extracted" />);
    expect(screen.getByText("Ready for review")).toBeInTheDocument();
  });

  test("falls back to a sentence-cased label for an unrecognized status", () => {
    render(<StatusBadge status="totally_made_up_status" />);
    expect(screen.getByText("Totally made up status")).toBeInTheDocument();
  });

  test("defaults to 'Unknown' when status is missing entirely", () => {
    render(<StatusBadge />);
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  test("normalizes status case (e.g. 'EXPORTED' renders the same as 'exported')", () => {
    render(<StatusBadge status="EXPORTED" />);
    expect(screen.getByText("Exported")).toBeInTheDocument();
  });

  test("an explicit label overrides the default", () => {
    render(<StatusBadge status="exported" label="In Tally" />);
    expect(screen.getByText("In Tally")).toBeInTheDocument();
  });
});
