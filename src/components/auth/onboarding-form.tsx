"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { completeOnboarding } from "@/app/actions/auth/complete-onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const onboardingSchema = z.object({
  display_name: z.string().min(2, { message: "Display name must be at least 2 characters." }),
  university: z.string().min(2, { message: "University is required." }),
  year_of_study: z.number({ message: "Year must be a number." }).min(1).max(10),
  timezone: z.string().min(1, { message: "Timezone is required." }),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

export function OnboardingForm() {
  const [isPending, startTransition] = useTransition();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      display_name: "",
      university: "",
      year_of_study: 1,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  async function onSubmit(data: OnboardingFormValues) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("display_name", data.display_name);
      formData.append("university", data.university);
      formData.append("year_of_study", data.year_of_study.toString());
      formData.append("timezone", data.timezone);
      
      const result = await completeOnboarding(formData);
      
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Welcome to Bunker!");
      }
    });
  }

  return (
    <Card className="border-border/50 bg-background/50 backdrop-blur-sm shadow-xl">
      <CardContent className="pt-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              placeholder="How should we call you?"
              disabled={isPending}
              {...form.register("display_name")}
            />
            {form.formState.errors.display_name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.display_name.message}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="university">University / Institution</Label>
            <Input
              id="university"
              placeholder="e.g. Stanford University"
              disabled={isPending}
              {...form.register("university")}
            />
            {form.formState.errors.university && (
              <p className="text-sm text-destructive">
                {form.formState.errors.university.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="year_of_study">Year of Study</Label>
            <Input
              id="year_of_study"
              type="number"
              min={1}
              max={10}
              disabled={isPending}
              {...form.register("year_of_study", { valueAsNumber: true })}
            />
            {form.formState.errors.year_of_study && (
              <p className="text-sm text-destructive">
                {form.formState.errors.year_of_study.message}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              disabled={isPending}
              readOnly
              className="bg-muted"
              {...form.register("timezone")}
            />
            <p className="text-xs text-muted-foreground">Auto-detected from your browser.</p>
          </div>

          <Button type="submit" className="w-full mt-4" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Complete Setup
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
