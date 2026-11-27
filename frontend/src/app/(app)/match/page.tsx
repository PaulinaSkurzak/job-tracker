import type { Metadata } from "next";

import { MatchPage } from "./match-page";

export const metadata: Metadata = { title: "Resume match" };

export default function Page() {
  return <MatchPage />;
}
