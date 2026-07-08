import { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create a new Bunker account",
};

export default function RegisterPage() {
  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold">Create an account</h2>
        <p className="text-sm text-muted-foreground">
          Enter your details to get started
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
