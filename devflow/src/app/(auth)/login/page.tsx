import { Suspense } from "react";
import { AuthPanel } from "@/components/auth/auth-panel";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthPanel description="Sign in to continue to your workspace." title="Welcome back">
      <Suspense fallback={<div className="bg-muted h-52 animate-pulse rounded-md" />}>
        <LoginForm />
      </Suspense>
    </AuthPanel>
  );
}
