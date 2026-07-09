import { ReactNode } from "react";
import Image from "next/image";
import { AuthLanding } from "@/components/auth/auth-landing";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen w-full flex bg-[#030014] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/landing-bg.png"
          alt="Bunker Background"
          fill
          priority
          className="object-cover object-center opacity-80"
          sizes="100vw"
        />
        {/* Gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      </div>

      <div className="relative z-10 w-full flex flex-col md:flex-row min-h-screen container mx-auto">
        {/* Left Side - Landing Content */}
        <div className="hidden md:flex flex-1 items-center justify-start">
          <AuthLanding />
        </div>

        {/* Right Side - Auth Form */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-8 w-full max-w-xl mx-auto md:max-w-none md:justify-end">
          <div className="w-full max-w-md">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
