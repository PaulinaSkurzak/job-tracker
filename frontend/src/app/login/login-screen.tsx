"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { LoginForm } from "@/components/login-form";
import { ME_KEY, useMe } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next";

export function LoginScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const next = safeNextPath(useSearchParams().get("next"));
  const me = useMe();

  // Already logged in (e.g. opened /login in a second tab): go straight on.
  useEffect(() => {
    if (me.data) router.replace(next);
  }, [me.data, next, router]);

  return (
    <LoginForm
      onSuccess={(user) => {
        queryClient.setQueryData(ME_KEY, user);
        router.replace(next);
      }}
    />
  );
}
