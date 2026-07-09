"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";

import { signIn, signInWithGoogle } from "@/app/actions/auth/sign-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [isPending, startTransition] = useTransition();
  const [isGooglePending, startGoogleTransition] = useTransition();
  const [isApplePending, startAppleTransition] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginFormValues) {
    if (activeTab === "signup") {
      // In a real scenario, this would route to register or handle signup.
      // Keeping it simple for the UI mockup.
      toast.info("Please use the signup page to create an account.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", data.email);
      formData.append("password", data.password);
      
      const result = await signIn(formData);
      
      if (result?.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="border border-white/10 bg-[#0A0B14]/70 backdrop-blur-2xl shadow-2xl overflow-hidden rounded-2xl p-2 sm:p-6 text-white w-full max-w-[480px]">
      <CardHeader className="space-y-3 pb-6 text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-purple-300 to-white">
          Welcome Back
        </h2>
        <p className="text-sm text-slate-400 font-light">
          Login to continue your journey
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Tabs */}
        <div className="flex border-b border-white/10 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("login")}
            className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${
              activeTab === "login" ? "text-purple-400" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Login
            {activeTab === "login" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-purple-500 rounded-t-full shadow-[0_-2px_10px_rgba(168,85,247,0.8)]" />
            )}
          </button>
          <Link
            href="/register"
            className="flex-1 pb-3 text-sm font-medium text-center transition-colors text-slate-400 hover:text-slate-200"
          >
            Sign Up
          </Link>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2 relative">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <Input
                id="email"
                type="email"
                placeholder="Email or Phone"
                className="bg-black/30 border-white/10 text-white placeholder:text-slate-500 pl-10 h-12 focus-visible:ring-purple-500/50 focus-visible:border-purple-500/50 rounded-xl"
                disabled={isPending || isGooglePending}
                {...form.register("email")}
              />
            </div>
            {form.formState.errors.email && (
              <p className="text-xs text-red-400 mt-1 absolute -bottom-5">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>
          
          <div className="space-y-2 relative">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="bg-black/30 border-white/10 text-white placeholder:text-slate-500 pl-10 pr-10 h-12 focus-visible:ring-purple-500/50 focus-visible:border-purple-500/50 rounded-xl"
                disabled={isPending || isGooglePending}
                {...form.register("password")}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {form.formState.errors.password && (
              <p className="text-xs text-red-400 mt-1 absolute -bottom-5">
                {form.formState.errors.password.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember" 
                className="border-white/20 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white rounded"
              />
              <label
                htmlFor="remember"
                className="text-sm text-slate-300 font-light leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Remember me
              </label>
            </div>
            <Link 
              href="/forgot-password" 
              className="text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors"
            >
              Forgot Password?
            </Link>
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 mt-2 bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-white border-0 shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_25px_rgba(147,51,234,0.5)] transition-all rounded-xl font-medium text-base group" 
            disabled={isPending || isGooglePending}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <>
                Login
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#0f0e1c] px-3 text-slate-400 font-light rounded-full border border-white/5 py-1">
              or continue with
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            type="button"
            className="w-full h-11 bg-black/40 border-white/10 hover:bg-black/60 hover:text-white text-slate-200 transition-all rounded-xl font-light"
            disabled={isPending || isGooglePending}
            onClick={() => {
              startGoogleTransition(async () => {
                const result = await signInWithGoogle();
                if (result?.error) {
                  toast.error(result.error);
                }
              });
            }}
          >
            {isGooglePending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Google
          </Button>

          <Button
            variant="outline"
            type="button"
            className="w-full h-11 bg-black/40 border-white/10 hover:bg-black/60 hover:text-white text-slate-200 transition-all rounded-xl font-light"
            disabled={isPending || isGooglePending || isApplePending}
            onClick={() => {
              // Apple auth is not implemented yet on the backend, 
              // but we show the button to match the mockup UI.
              toast.info("Apple sign in coming soon");
            }}
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.48 4.76c.74-.91 1.25-2.22 1.11-3.52-.39 1.34-1.25 2.65-1.98 3.56-.63.78-1.55 2.08-1.42 3.37.4 1.3 1.55 2.5 1.98 3.37.13.25.18.52.22.78.31-1.34-1.91-4.56.09-7.56zm4.84 5.92c-.14-1.4-1.21-2.58-2.61-2.92-1.39-.33-2.92.2-3.87.97-.93.75-2.3 1.3-3.66 1.3-1.37 0-2.65-.55-3.53-1.25-1-.79-2.64-1.36-4.14-.97-1.47.38-2.62 1.63-2.73 3.12-.13 1.83.67 4.19 1.9 6.2 1.25 2.05 2.89 4.3 5.09 4.41 1.09.06 1.63-.56 3.01-.56 1.37 0 1.95.56 3.06.56 2.21 0 3.79-2.28 5.05-4.32 1.22-2 2.06-4.41 1.92-6.54H17.3c0-.02-.01-.02-.02-.02z"/>
            </svg>
            Apple
          </Button>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400 font-light">
          New here?{" "}
          <Link href="/register" className="font-medium text-purple-400 hover:text-purple-300 transition-colors hover:underline">
            Sign up
          </Link>{" "}
          and get started
        </p>
      </CardContent>
    </Card>
  );
}
