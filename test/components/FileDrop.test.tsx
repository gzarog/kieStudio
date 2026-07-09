import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileDrop } from "../../src/components/shared/FileDrop";

describe("<FileDrop />", () => {
  it("renders the browse hint by default", () => {
    render(<FileDrop onFile={() => {}} />);
    expect(screen.getByText(/drop an image/i)).toBeInTheDocument();
  });

  it("shows an uploading state", () => {
    render(<FileDrop onFile={() => {}} uploading />);
    expect(screen.getByText(/uploading/i)).toBeInTheDocument();
  });

  it("shows the preview thumbnail once uploaded", () => {
    render(<FileDrop onFile={() => {}} previewUrl="https://host/f.png" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://host/f.png");
  });

  it("fires onFile when a file is picked via the input", () => {
    const onFile = vi.fn();
    render(<FileDrop onFile={onFile} />);
    const file = new File(["x"], "pic.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("file-input"), { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("fires onFile when a file is dropped", () => {
    const onFile = vi.fn();
    render(<FileDrop onFile={onFile} />);
    const file = new File(["x"], "pic.png", { type: "image/png" });
    fireEvent.drop(screen.getByTestId("file-drop"), { dataTransfer: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });
});
