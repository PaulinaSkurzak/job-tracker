import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Board" };

export default function Page() {
  return <ComingSoon title="Board" step={5} />;
}
