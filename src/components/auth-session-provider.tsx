"use client";

import { SessionProvider } from "next-auth/react";
import type { ComponentProps } from "react";

export function AuthSessionProvider({
  children,
  ...props
}: ComponentProps<typeof SessionProvider>) {
  return <SessionProvider {...props}>{children}</SessionProvider>;
}
