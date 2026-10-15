"use client";

import React, { useState } from "react";
import { Activity, Lock, Mail, ArrowRight, ShieldCheck, Fingerprint } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Mock login delay
    setTimeout(() => {
      router.push("/dashboard");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-900/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header / Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-cyan-950/50 border border-cyan-800 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(34,211,238,0.2)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-cyan-600/20 to-transparent"></div>
            <Activity className="w-8 h-8 text-cyan-400 relative z-10" />
          </div>
          <h1 className="text-3xl font-bold tracking-widest text-white flex items-center gap-2">
            LIFE-LINK <span className="text-cyan-400 text-xs px-2 py-0.5 bg-cyan-950/60 border border-cyan-800 rounded font-mono">SECURE</span>
          </h1>
          <p className="text-sm text-gray-400 font-mono mt-2 text-center max-w-xs">
            Authorized personnel only. Access to real-time incident intelligence.
          </p>
        </div>

        {/* Login Form Card */}
        <div className="bg-[#111111]/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-600 to-blue-600"></div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 font-mono">
                Operator ID / Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-gray-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono text-sm placeholder:text-gray-600"
                  placeholder="dispatcher@lifeline.ai"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 font-mono">
                  Access Code
                </label>
                <a href="#" className="text-[10px] text-cyan-500 hover:text-cyan-400 font-mono uppercase tracking-widest transition-colors">
                  Reset Node
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-gray-800 text-white rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-mono text-sm placeholder:text-gray-600"
                  placeholder="••••••••••••"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-3.5 rounded-lg font-bold uppercase tracking-widest transition-all flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(8,145,178,0.4)] disabled:opacity-70 disabled:cursor-not-allowed group"
              >
                {isLoading ? (
                  <>
                    <Fingerprint className="w-5 h-5 animate-pulse" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Initialize Session</span>
                    <ArrowRight className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <div className="mt-8 flex items-center justify-center space-x-2 text-[10px] text-gray-500 font-mono uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>End-to-End Encryption Enabled</span>
        </div>
      </div>
    </div>
  );
}
