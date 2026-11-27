import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ContactDetailPage } from "./contact-detail-page";

export const metadata: Metadata = { title: "Contact" };

/** Reading the URL's id makes the page dynamic, which Next.js wants inside a Suspense boundary. */
async function ContactFromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Only positive whole numbers are ids; anything else (/contacts/abc) is a 404 before any API call.
  if (!/^[1-9]\d*$/.test(id)) notFound();
  return <ContactDetailPage id={Number(id)} />;
}

export default function Page({ params }: PageProps<"/contacts/[id]">) {
  return (
    <Suspense>
      <ContactFromParams params={params} />
    </Suspense>
  );
}
