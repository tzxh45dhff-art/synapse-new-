import { Metadata } from "next";
import { OnboardingForm } from "@/components/auth/onboarding-form";

export const metadata: Metadata = {
  title: "Complete Setup",
  description: "Complete your Bunker profile setup",
};

export default function OnboardingPage() {
  return (
    <div className="w-full">
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Bunker</h1>
        <p className="text-muted-foreground text-lg">
          Let's get your profile set up so you can start collaborating.
        </p>
      </div>
      <div className="max-w-md mx-auto">
        <OnboardingForm />
      </div>
    </div>
  );
}
