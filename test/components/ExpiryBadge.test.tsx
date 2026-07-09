import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExpiryBadge } from "../../src/components/shared/ExpiryBadge";

const DAY = 86_400_000;

describe("<ExpiryBadge />", () => {
  it("renders nothing without a createdAt (old entries predating Phase 6)", () => {
    const { container } = render(<ExpiryBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the remaining days for a fresh result", () => {
    render(<ExpiryBadge createdAt={Date.now()} />);
    expect(screen.getByTestId("expiry-badge")).toHaveTextContent("expires in 14 days");
  });

  it("warns when the retention window has passed", () => {
    render(<ExpiryBadge createdAt={Date.now() - 20 * DAY} />);
    expect(screen.getByTestId("expiry-badge")).toHaveTextContent("may have expired");
  });
});
