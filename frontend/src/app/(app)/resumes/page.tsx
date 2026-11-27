import type { Metadata } from "next";

import { ResumesPage } from "./resumes-page";

export const metadata: Metadata = { title: "Resumes" };

export default function Page() {
  return <ResumesPage />;
}
