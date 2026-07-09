import { Brain, Shield, TrendingUp, Award } from "lucide-react";
import Link from "next/link";

export function AuthLanding() {
  return (
    <div className="flex h-full flex-col justify-between p-10 lg:p-16 text-white relative z-10 w-full max-w-2xl">
      <div>
        <Link href="/" className="flex items-center space-x-3 mb-16">
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_0_20px_rgba(147,51,234,0.5)]">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 2L2 7l10 5 10-5-10-5zm0 10l-10 5 10 5 10-5-10-5z"
              />
            </svg>
          </div>
          <span className="text-3xl font-bold tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-purple-300 to-white">Bunker</span>
        </Link>

        <h1 className="text-4xl md:text-5xl font-semibold mb-4 leading-tight tracking-tight">
          Your Study Sanctuary.
        </h1>
        <p className="text-lg md:text-xl text-slate-300 mb-12 max-w-md font-light leading-relaxed">
          AI-powered. Distraction-free.<br/>Built for serious learners.
        </p>

        <div className="space-y-8">
          <div className="flex gap-5">
            <div className="flex-shrink-0 mt-1">
              <Brain className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">AI That Understands You</h3>
              <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                Get personalized insights and smart study recommendations.
              </p>
            </div>
          </div>
          
          <div className="flex gap-5">
            <div className="flex-shrink-0 mt-1">
              <Shield className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">All Your Study Materials</h3>
              <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                Store, organize and access everything in one secure vault.
              </p>
            </div>
          </div>

          <div className="flex gap-5">
            <div className="flex-shrink-0 mt-1">
              <TrendingUp className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white mb-1">Track. Improve. Achieve.</h3>
              <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                Monitor your progress and reach your goals.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-8 sm:gap-16 pt-12 mt-12">
        <div className="flex items-center gap-4">
          <Award className="h-10 w-10 text-slate-500 opacity-60" strokeWidth={1.5} />
          <div className="border-l border-white/10 pl-4">
            <p className="text-xs text-slate-400 mb-0.5">Trusted by</p>
            <p className="font-semibold text-white text-lg leading-none">50K+</p>
            <p className="text-xs text-slate-500 mt-0.5">Students</p>
          </div>
        </div>
        <div className="border-l border-white/10 pl-6">
          <p className="text-xs text-slate-400 mb-2">Designed for</p>
          <p className="font-medium text-slate-300 text-sm">Focus. Consistency.</p>
          <p className="font-medium text-slate-300 text-sm">Growth.</p>
        </div>
      </div>
    </div>
  );
}
