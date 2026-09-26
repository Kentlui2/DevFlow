"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const fullName = String(formData.get("fullName")).trim();
    const email = String(formData.get("email")).trim();
    const password = String(formData.get("password"));
    const confirmPassword = String(formData.get("confirmPassword"));

    if (fullName.length < 2) {
      setError("Enter your name (at least 2 characters).");
      setIsSubmitting(false);
      return;
    }
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      setIsSubmitting(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords don’t match.");
      setIsSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (signUpError) {
      setError("We couldn’t create your account. Check your details and try again.");
      setIsSubmitting(false);
      return;
    }

    if (!data.session) {
      setMessage("Check your email for a confirmation link to finish creating your account.");
      setIsSubmitting(false);
      form.reset();
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  if (message) {
    return (
      <div aria-live="polite" className="bg-muted/50 rounded-md border p-4 text-sm">
        {message}
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" autoComplete="name" maxLength={80} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            required
            className="pr-10"
          />
          <Button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute top-0 right-0"
            onClick={() => setShowPassword((visible) => !visible)}
            size="icon"
            type="button"
            variant="ghost"
          >
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">Use at least 8 characters.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </div>
      {error ? <p className="text-destructive text-sm" role="alert">{error}</p> : null}
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link className="text-foreground font-medium underline-offset-4 hover:underline" href="/login">Sign in</Link>
      </p>
    </form>
  );
}
