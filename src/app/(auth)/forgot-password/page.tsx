import { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your Bunker password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold">Reset Password</h2>
        <p className="text-sm text-muted-foreground">
          Enter your email to receive a reset link
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
