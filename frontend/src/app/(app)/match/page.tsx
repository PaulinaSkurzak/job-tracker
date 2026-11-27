import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Resume match" };

export default function Page() {
  return <ComingSoon title="Resume match" step={8} />;
}
