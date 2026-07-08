import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskStatusBadge } from "../../src/components/shared/TaskStatusBadge";

describe("<TaskStatusBadge />", () => {
  it("renders nothing when idle", () => {
    const { container } = render(<TaskStatusBadge status="idle" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a generating message when pending", () => {
    render(<TaskStatusBadge status="pending" />);
    expect(screen.getByText(/Generating/i)).toBeInTheDocument();
  });

  it("shows the error message when failed", () => {
    render(<TaskStatusBadge status="failed" error="nsfw content" />);
    expect(screen.getByText(/nsfw content/)).toBeInTheDocument();
  });

  it("shows a default failure message when no error text is given", () => {
    render(<TaskStatusBadge status="failed" />);
    expect(screen.getByText(/not charged/i)).toBeInTheDocument();
  });

  it("shows a done message on success", () => {
    render(<TaskStatusBadge status="success" />);
    expect(screen.getByText(/Done/)).toBeInTheDocument();
  });
});
