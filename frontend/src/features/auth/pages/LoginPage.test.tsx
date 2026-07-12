import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "../../../stores/authStore";
import { authApi } from "../api";
import { LoginPage } from "./LoginPage";

vi.mock("../api", () => ({ authApi: { login: vi.fn() } }));

afterEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ token: null, user: null, hasHydrated: true });
  useAuthStore.persist.clearStorage();
});

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LoginPage demo accounts", () => {
  it("shows each seeded permission level", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Asset Manager" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Department Head" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Employee" })).toBeInTheDocument();
  });

  it("authenticates with the selected demo account and opens the app", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      token: "demo-token",
      user: { id: "user-1", name: "Sarah Manager", email: "sarah-manager@artemis.com", role: "ASSET_MANAGER" },
    });
    renderLogin();

    await userEvent.click(screen.getByRole("button", { name: "Asset Manager" }));

    expect(authApi.login).toHaveBeenCalledWith({ email: "sarah-manager@artemis.com", password: "demo1234" });
    await waitFor(() => expect(screen.getByText("Dashboard")).toBeInTheDocument());
    expect(useAuthStore.getState()).toMatchObject({ token: "demo-token", user: { role: "ASSET_MANAGER" } });
  });
});
