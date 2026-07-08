import { ReactNode } from "react";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background/50 p-4">
      <div className="w-full max-w-xl space-y-6">
        {children}
      </div>
    </div>
  );
}
