import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModelPicker, CapabilityBadges } from "../../src/components/shared/ModelPicker";

describe("<ModelPicker />", () => {
  it("renders the catalog options grouped by provider", () => {
    render(<ModelPicker category="image" value="gpt-image-2" onChange={() => {}} />);
    const select = screen.getByLabelText("Model") as HTMLSelectElement;
    // optgroups exist for the image providers
    const groups = select.querySelectorAll("optgroup");
    const labels = [...groups].map((g) => g.getAttribute("label"));
    expect(labels).toContain("OpenAI");
    expect(labels).toContain("xAI");
    // the selected option's text is the friendly label
    expect(screen.getByDisplayValue("GPT Image 2")).toBe(select);
  });

  it("shows capability badges for the selected model", () => {
    render(<ModelPicker category="image" value="grok-imagine/image-to-image" onChange={() => {}} />);
    const badges = screen.getByTestId("capability-badges");
    expect(badges.textContent).toContain("I2I");
  });

  it("calls onChange with the picked model id", () => {
    const onChange = vi.fn();
    render(<ModelPicker category="video" value="veo-3.1" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "seedance-2.0" } });
    expect(onChange).toHaveBeenCalledWith("seedance-2.0");
  });
});

describe("<CapabilityBadges />", () => {
  it("renders one chip per capability with human labels", () => {
    render(<CapabilityBadges capabilities={["t2i", "i2i"]} />);
    const badges = screen.getByTestId("capability-badges");
    expect(badges.textContent).toContain("T2I");
    expect(badges.textContent).toContain("I2I");
  });
});
