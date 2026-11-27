import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Contacts" };

export default function Page() {
  return <ComingSoon title="Contacts" step={7} />;
}
