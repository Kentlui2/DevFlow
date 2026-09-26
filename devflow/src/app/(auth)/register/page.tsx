import { AuthPanel } from "@/components/auth/auth-panel";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthPanel description="Start organizing your team’s work in DevFlow." title="Create your account">
      <RegisterForm />
    </AuthPanel>
  );
}
