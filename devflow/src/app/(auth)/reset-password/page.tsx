import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth/auth-panel";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?error=auth_callback");

  return (
    <AuthPanel description="Use at least 8 characters for your new password." title="Choose a new password">
      <ResetPasswordForm />
    </AuthPanel>
  );
}
