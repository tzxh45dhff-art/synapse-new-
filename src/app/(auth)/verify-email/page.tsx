import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Verify Email",
  description: "Check your email to verify your Bunker account",
};

export default function VerifyEmailPage() {
  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground mt-2">
          We've sent a verification link to your email address.
        </p>
      </div>
      
      <Card className="border-border/50 bg-background/50 backdrop-blur-sm">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <svg
              className="h-6 w-6 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Please click the link in the email to verify your account and complete setup.
          </p>

          <div className="pt-4">
            <Link href="/login" className="w-full block">
              <Button variant="outline" className="w-full">
                Return to Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
