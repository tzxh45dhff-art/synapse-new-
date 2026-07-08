"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-destructive">Authentication Error</h2>
        <p className="text-sm text-muted-foreground mt-2">
          There was a problem signing you in.
        </p>
      </div>
      
      <Card className="border-border/50 bg-background/50 backdrop-blur-sm">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <svg
              className="h-6 w-6 text-destructive"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <div className="rounded-md bg-muted p-3 text-sm text-left font-mono">
            <strong>Error:</strong> {error || "Unknown Error"}<br/>
            {error_description && <span><strong>Description:</strong> {error_description}</span>}
          </div>

          <div className="pt-4">
            <Link href="/login" className="w-full block">
              <Button className="w-full">
                Return to Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
