import type { Metadata } from "next";

import { ContactsPage } from "./contacts-page";

export const metadata: Metadata = { title: "Contacts" };

export default function Page() {
  return <ContactsPage />;
}
