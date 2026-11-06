import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { RequireRole } from "@/components/auth/RequireRole";
import { api } from "@/lib/api";
import { AUTH_TOKEN_KEY } from "@/lib/config";
import type { User } from "@/types/contract";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const INSTRUCTOR: User = {
  id: "i1",
  email: "instructor@example.edu",
  full_name: "Demo Instructor",
  role: "instructor",
  roll_no: null,
};

const page = (
  <AuthProvider>
    <RequireRole role="instructor">
      <p>Live class</p>
    </RequireRole>
  </AuthProvider>
);

/** Load the page the way a browser refresh does: server HTML first, then hydration. */
function hardLoad() {
  // The server has no localStorage, so the HTML is rendered as if signed out.
  const stored = localStorage.getItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  const html = renderToString(page);
  if (stored) localStorage.setItem(AUTH_TOKEN_KEY, stored);

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return render(page, { container, hydrate: true });
}

describe("RequireRole on a hard page load", () => {
  beforeEach(() => {
    replace.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("keeps a signed-in user on the page they refreshed", async () => {
    localStorage.setItem(AUTH_TOKEN_KEY, "stored-token");
    const me = vi.spyOn(api, "get").mockResolvedValue(INSTRUCTOR);

    await act(async () => {
      hardLoad();
    });

    expect(await screen.findByText("Live class")).toBeInTheDocument();
    expect(me).toHaveBeenCalledWith("/me");
    expect(replace).not.toHaveBeenCalled();
  });

  it("still sends a visitor with no token to the login page", async () => {
    const me = vi.spyOn(api, "get");

    await act(async () => {
      hardLoad();
    });

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(me).not.toHaveBeenCalled();
    expect(screen.queryByText("Live class")).not.toBeInTheDocument();
  });
});
