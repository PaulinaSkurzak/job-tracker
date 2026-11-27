import type { Metadata } from "next";

import { BoardPage } from "./board-page";

export const metadata: Metadata = { title: "Board" };

export default function Page() {
  return <BoardPage />;
}
