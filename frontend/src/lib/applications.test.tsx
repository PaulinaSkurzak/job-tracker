import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi, json } from "@/test/fake-api";
import { makeApplication } from "@/test/fixtures";

import { APPLICATIONS_KEY, useMoveApplication } from "./applications";
import type { Application } from "./board";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

function setup(applications: Application[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queryClient.setQueryData(APPLICATIONS_KEY, applications);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useMoveApplication(), { wrapper });
  const cached = () =>
    queryClient.getQueryData<Application[]>(APPLICATIONS_KEY)!.map((a) => [a.id, a.status, a.position]);
  return { result, cached };
}

describe("useMoveApplication", () => {
  const card = makeApplication({ id: 1, role_title: "ML Co-op", status: "screen", position: 0 });
  const other = makeApplication({ id: 2, status: "interview", position: 0 });

  beforeEach(() => vi.mocked(toast).mockClear());

  it("updates the board immediately, before the server answers", async () => {
    let answer!: () => void;
    fakeApi({
      "POST /api/applications/1/move/": () =>
        new Promise((resolve) => (answer = () => resolve(Response.json({ ...card, status: "interview" })))),
      "GET /api/applications/": json([]),
    });
    const { result, cached } = setup([card, other]);

    act(() => result.current.moveCard({ id: 1, status: "interview", ids: [2, 1], undo: { status: "screen", ids: [1] } }));

    // The server has not replied yet, but the cache already shows the move.
    expect(cached()).toEqual([
      [1, "interview", 1],
      [2, "interview", 0],
    ]);
    await waitFor(() => expect(answer).toBeTypeOf("function"));
    answer();
  });

  it("sends the target column and its order", async () => {
    const calls = fakeApi({
      "POST /api/applications/1/move/": json({ ...card, status: "interview" }),
      "GET /api/applications/": json([]),
    });
    const { result } = setup([card, other]);

    act(() => result.current.moveCard({ id: 1, status: "interview", ids: [2, 1] }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect(calls.find((c) => c.method === "POST")).toEqual({
      method: "POST",
      path: "/api/applications/1/move/",
      body: { status: "interview", ids: [2, 1] },
    });
  });

  it("rolls back and shows an error when the server rejects the move", async () => {
    fakeApi({
      "POST /api/applications/1/move/": json({ ids: ["Must include the id of the card being moved."] }, 400),
      "GET /api/applications/": json([card, other]),
    });
    const { result, cached } = setup([card, other]);

    act(() => result.current.moveCard({ id: 1, status: "interview", ids: [2, 1] }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(vi.mocked(toast.error).mock.calls[0][0]).toContain("Must include the id of the card being moved.");
    expect(cached()).toEqual([
      [1, "screen", 0],
      [2, "interview", 0],
    ]);
  });

  it("offers Undo, which moves the card back to its old column and order", async () => {
    const calls = fakeApi({
      "POST /api/applications/1/move/": json({ ...card, status: "interview" }),
      "GET /api/applications/": json([]),
    });
    const { result } = setup([card, other]);

    act(() => result.current.moveCard({ id: 1, status: "interview", ids: [2, 1], undo: { status: "screen", ids: [1] } }));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    const [message, options] = vi.mocked(toast).mock.calls[0] as unknown as [string, { action: { onClick: () => void } }];
    expect(message).toBe("Moved ML Co-op to Interview");

    act(() => options.action.onClick());
    await waitFor(() => expect(calls.filter((c) => c.method === "POST")).toHaveLength(2));
    expect(calls.filter((c) => c.method === "POST")[1].body).toEqual({ status: "screen", ids: [1] });
  });

  it("does not offer Undo for a reorder within the same column", async () => {
    fakeApi({ "POST /api/applications/1/move/": json(card), "GET /api/applications/": json([]) });
    const { result } = setup([card]);

    act(() => result.current.moveCard({ id: 1, status: "screen", ids: [1], undo: { status: "screen", ids: [1] } }));

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(toast).not.toHaveBeenCalled();
  });
});
