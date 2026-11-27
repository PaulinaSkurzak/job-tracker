import { redirect } from "next/navigation";

import { DEFAULT_PAGE } from "@/lib/safe-next";

export default function Home() {
  redirect(DEFAULT_PAGE);
}
