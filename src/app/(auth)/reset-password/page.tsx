import { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Update Password",
  description: "Set a new password for your Bunker account",
};

export default function ResetPasswordPage() {
  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold">Set New Password</h2>
        <p className="text-sm text-muted-foreground">
          Enter your new password below
        </p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
