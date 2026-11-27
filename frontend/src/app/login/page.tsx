import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginScreen } from "./login-screen";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      {/* LoginScreen reads ?next= from the URL, which Next.js requires to sit inside a Suspense boundary. */}
      <Suspense>
        <LoginScreen />
      </Suspense>
    </main>
  );
}
