import { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign In - Bunker",
  description: "Sign in to your Bunker study sanctuary",
};

export default function LoginPage() {
  return (
    <div className="w-full">
      <LoginForm />
    </div>
  );
}
