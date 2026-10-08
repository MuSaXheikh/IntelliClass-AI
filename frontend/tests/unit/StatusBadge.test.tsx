import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/ui/StatusBadge";

describe("StatusBadge", () => {
  it("renders a text label and an icon, never colour alone", () => {
    const { container } = render(<StatusBadge state="sleepy" />);
    expect(screen.getByText("Sleepy")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByTitle("Eyes have stayed closed for too long")).toHaveAttribute(
      "data-state",
      "sleepy",
    );
  });
});
