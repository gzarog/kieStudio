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

  it("renders a custom label and video preview for video sources", () => {
    const { container } = render(
      <FileDrop onFile={() => {}} accept="video/*" previewKind="video" label="Drop a video here, or click to browse" />
    );
    expect(screen.getByText(/drop a video/i)).toBeInTheDocument();
    expect(screen.getByTestId("file-input")).toHaveAttribute("accept", "video/*");
    // no video preview until a source URL exists
    expect(container.querySelector("video")).toBeNull();
  });

  it("shows a <video> element (not an <img>) when previewKind is video", () => {
    render(<FileDrop onFile={() => {}} previewKind="video" previewUrl="https://host/clip.mp4" />);
    expect(screen.getByTestId("file-preview-video")).toHaveAttribute("src", "https://host/clip.mp4");
    expect(screen.queryByRole("img")).toBeNull();
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
