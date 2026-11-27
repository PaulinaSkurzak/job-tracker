import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import { fakeApi, json } from "@/test/fake-api";
import { makeApplication } from "@/test/fixtures";

import { ApplicationFormDialog } from "./application-form-dialog";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

function renderDialog(id?: number, routes: Parameters<typeof fakeApi>[0] = {}) {
  const calls = fakeApi({ "GET /api/companies/": json([{ id: 1, name: "Northwind Bio", website: "", notes: "" }]), ...routes });
  const onOpenChange = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ApplicationFormDialog id={id} open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { calls, onOpenChange };
}

describe("ApplicationFormDialog", () => {
  it("creates an application, sending empty dates and length as null", async () => {
    const { calls, onOpenChange } = renderDialog(undefined, {
      "POST /api/applications/": json({ ...makeApplication({ role_title: "ML Co-op" }), match_score: 61 }, 201),
    });

    await userEvent.type(screen.getByLabelText("Company"), "Corvid Robotics");
    await userEvent.type(screen.getByLabelText("Role"), "ML Co-op");
    await userEvent.click(screen.getByRole("button", { name: "Add application" }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({
      company_name: "Corvid Robotics",
      role_title: "ML Co-op",
      location: "",
      job_url: "",
      status: "saved",
      term: "Summer 2027",
      coop_months: null,
      date_applied: null,
      deadline: null,
      job_description: "",
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(toast.success).toHaveBeenCalledWith("Added ML Co-op · 61% resume match");
  });

  it("suggests companies you already have", async () => {
    renderDialog();
    await waitFor(() => expect(document.querySelector("#company-options option")).toHaveAttribute("value", "Northwind Bio"));
  });

  it("loads the full application to edit, and saves changes", async () => {
    const app = { ...makeApplication({ id: 7, role_title: "Data Co-op", coop_months: 8, date_applied: "2026-11-10" }), job_description: "Python.", status_history: [], contacts: [] };
    const { calls } = renderDialog(7, {
      "GET /api/applications/7/": json(app),
      "PATCH /api/applications/7/": json(app),
    });

    expect(await screen.findByLabelText("Job description")).toHaveValue("Python.");
    expect(screen.getByLabelText("Date applied")).toHaveValue("2026-11-10");
    expect(screen.getByRole("combobox", { name: "Length" })).toHaveTextContent("8 months");

    await userEvent.clear(screen.getByLabelText("Role"));
    await userEvent.type(screen.getByLabelText("Role"), "Data Engineering Co-op");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")).toBeDefined());
    const body = calls.find((c) => c.method === "PATCH")!.body as Record<string, unknown>;
    expect(body).toMatchObject({ role_title: "Data Engineering Co-op", coop_months: 8, date_applied: "2026-11-10" });
  });

  it("shows the server's validation message under the field", async () => {
    renderDialog(undefined, { "POST /api/applications/": json({ company_name: ["This field is required."] }, 400) });
    await userEvent.click(screen.getByRole("button", { name: "Add application" }));
    expect(await screen.findByText("This field is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Company")).toHaveAttribute("aria-invalid", "true");
  });
});
