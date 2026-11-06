import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, ButtonLink } from "@/components/ui/Button";

describe("Button", () => {
  it("does not submit a form unless asked to", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });
});

describe("ButtonLink", () => {
  it("is a plain link, with no button nested inside it", () => {
    const { container } = render(<ButtonLink href="/student">Join</ButtonLink>);
    expect(screen.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/student");
    expect(container.querySelector("button")).toBeNull();
  });
});
