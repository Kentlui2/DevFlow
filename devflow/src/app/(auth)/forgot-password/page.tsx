import Link from "next/link";
import { AuthPanel } from "@/components/auth/auth-panel";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthPanel description="We’ll email you a link to choose a new password." title="Reset your password">
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm">
        <Link className="text-muted-foreground hover:text-foreground" href="/login">Back to sign in</Link>
      </p>
    </AuthPanel>
  );
}
