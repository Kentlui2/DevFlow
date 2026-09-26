import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMascot } from "@/components/shared/brand-mascot";

export function AuthPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center px-5 py-10 sm:px-6 sm:py-12">
      <section className="bg-background w-full max-w-md rounded-xl border p-6 shadow-sm sm:p-8">
        <Link className="inline-flex items-center gap-2 font-semibold tracking-tight" href="/">
          <BrandMascot className="h-9 w-12 object-contain" />
          DevFlow
        </Link>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">{description}</p>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}
