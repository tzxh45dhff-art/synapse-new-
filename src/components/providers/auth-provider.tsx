"use client";

import { createContext, useContext, useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { signOut as serverSignOut } from "@/app/actions/auth/sign-out";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  university: string | null;
  year_of_study: number | null;
  timezone: string;
  onboarding_completed: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;

    async function getInitialSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        
        if (session?.user) {
          if (mounted) setUser(session.user);
          
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
            
          if (mounted && profileData) {
            setProfile(profileData as Profile);
          }
        }
      } catch (error) {
        console.error("Error loading auth session:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Only fetch profile if it's a SIGN_IN or we don't have it yet
          if (event === "SIGNED_IN" || !profile) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .single();
              
            if (profileData) {
              setProfile(profileData as Profile);
            }
          }
        } else {
          setProfile(null);
        }
        
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, profile]);

  const signOut = async () => {
    startTransition(async () => {
      await serverSignOut();
      setUser(null);
      setProfile(null);
      router.push("/login");
    });
  };

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
