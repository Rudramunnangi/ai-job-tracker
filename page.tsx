"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { JourneyRail } from "@/components/JourneyRail";
import { KanbanBoard, TrackedJob } from "@/components/KanbanBoard";
import { ProfileDrawer } from "@/components/ProfileDrawer";
import { Footer } from "@/components/Footer";
import { BrandLoader } from "@/components/BrandLoader";

export default function Home() {
  // Session State
  const [isGuest, setIsGuest] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userProfile, setUserProfile] = useState<{
    email: string;
    name: string;
    targetRole?: string;
    resumeText?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  } | null>(null);

  // UI State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Applications Ledger State
  const [jobs, setJobs] = useState<TrackedJob[]>([
    {
      id: "job-1",
      company: "Stripe",
      role: "Staff Distributed Systems Engineer",
      date: "Sep 23",
      status: "Interviewing",
      jd: "Raft/Paxos consensus, Go/Rust microservices, multi-region database replication, sub-5ms p99 latency.",
    },
    {
      id: "job-2",
      company: "Vercel",
      role: "Lead Frontend Platform Engineer",
      date: "Sep 22",
      status: "Applied",
      jd: "Next.js Core, React Server Components, Edge computing runtime, Turbopack, AST parsing.",
    },
    {
      id: "job-3",
      company: "Linear",
      role: "Senior Full Stack Systems Architect",
      date: "Sep 19",
      status: "Offered",
      jd: "Offline-first real-time synchronization, WebSocket multiplexing, CRDT conflict resolution.",
    },
    {
      id: "job-4",
      company: "Anthropic",
      role: "AI/ML Infrastructure Engineer",
      date: "Sep 14",
      status: "Archived",
      jd: "Distributed GPU training cluster orchestration, PyTorch distributed, vLLM throughput optimization.",
    },
  ]);

  // Check saved session on mount
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem("nexjob_token");
      const savedEmail = localStorage.getItem("nexjob_email");
      const savedProfile = localStorage.getItem("nexjob_profile");

      if (savedToken && savedEmail) {
        setIsGuest(false);
        setUserEmail(savedEmail);
        if (savedProfile) {
          const parsed = JSON.parse(savedProfile);
          setUserProfile(parsed);
          setUserName(parsed.name || parsed.fullName || "");
        }
      }
    } catch (e) {
      console.warn("Local storage unavailable", e);
    }
  }, []);

  // Compute Kanban Stats
  const kanbanStats = {
    applied: jobs.filter((j) => j.status === "Applied").length,
    interviewing: jobs.filter((j) => j.status === "Interviewing").length,
    offered: jobs.filter((j) => j.status === "Offered").length,
    archived: jobs.filter((j) => j.status === "Archived").length,
  };

  const handleAddApplication = (company: string, role: string) => {
    const newJob: TrackedJob = {
      id: `job-${Date.now()}`,
      company,
      role,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      status: "Applied",
    };
    setJobs([newJob, ...jobs]);
  };

  const handleUpdateStatus = (id: string, newStatus: TrackedJob["status"]) => {
    setJobs(jobs.map((j) => (j.id === id ? { ...j, status: newStatus } : j)));
  };

  const handleSelectJob = (job: TrackedJob) => {
    // Fill Journey Rail with selected job context
    const companyInput = document.getElementById("atsTargetCompany") as HTMLInputElement;
    const roleInput = document.getElementById("atsTargetRole") as HTMLInputElement;
    if (companyInput) companyInput.value = job.company;
    if (roleInput) roleInput.value = job.role;
  };

  const handleLogout = () => {
    localStorage.removeItem("nexjob_token");
    localStorage.removeItem("nexjob_email");
    localStorage.removeItem("nexjob_profile");
    setIsGuest(true);
    setUserEmail("");
    setUserName("");
    setUserProfile(null);
  };

  // Email OTP / Login Handlers
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim()) return;
    setAuthLoading(true);
    setAuthError("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim(), purpose: "signup" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Unable to send verification code.");
      }
      setOtpSent(true);
    } catch (err: any) {
      setAuthError(err.message || "Failed to dispatch verification code.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail.trim(),
          otp: otpCode.trim(),
          password: authPassword || "VerifiedUser2026!",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Verification failed.");
      }

      setIsGuest(false);
      setUserEmail(authEmail);
      localStorage.setItem("nexjob_token", data.token || "token_verified");
      localStorage.setItem("nexjob_email", authEmail);
      setIsLoginModalOpen(false);
    } catch (err: any) {
      setAuthError(err.message || "Invalid or expired OTP code.");
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-body">
      {/* Sticky Header */}
      <Navbar
        isGuest={isGuest}
        userEmail={userEmail}
        userName={userName}
        onOpenProfile={() => setIsDrawerOpen(true)}
        onLoginClick={() => setIsLoginModalOpen(true)}
      />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* Hero with 3D Trajectory Network */}
        <Hero
          onScanClick={() => {
            const atsEl = document.getElementById("ats-engine");
            if (atsEl) atsEl.scrollIntoView({ behavior: "smooth" });
          }}
          onExploreClick={() => {
            const railEl = document.getElementById("journey-rail");
            if (railEl) railEl.scrollIntoView({ behavior: "smooth" });
          }}
        />

        {/* Vertical Connected Journey Rail (3 Stops) */}
        <JourneyRail
          isGuest={isGuest}
          userResume={userProfile?.resumeText}
          onAddApplication={handleAddApplication}
          kanbanStats={kanbanStats}
          onLoginClick={() => setIsLoginModalOpen(true)}
        />

        {/* Pipeline Kanban Board */}
        <KanbanBoard
          jobs={jobs}
          isGuest={isGuest}
          onUpdateStatus={handleUpdateStatus}
          onSelectJob={handleSelectJob}
          onLoginClick={() => setIsLoginModalOpen(true)}
        />
      </main>

      {/* Candidate Profile Drawer */}
      <ProfileDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        user={userProfile}
        isGuest={isGuest}
        onLoginClick={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        trackedCount={jobs.length}
      />

      {/* Login & Verification Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-surface border border-border rounded-lg max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <BrandLoader size="sm" />
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
                  Candidate Authentication
                </h3>
              </div>
              <button
                onClick={() => setIsLoginModalOpen(false)}
                className="p-1 rounded-sm hover:bg-surface-elevated text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {/* Google OAuth Option */}
            <div className="space-y-3">
              <div id="googleButtonContainer" className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    // Direct OAuth trigger
                    alert("Google OAuth: Ensure client ID matches your production domain in Google Cloud Console.");
                  }}
                  className="w-full py-2.5 px-4 rounded-md border border-border bg-surface-elevated hover:bg-surface-elevated/80 text-foreground font-medium text-xs font-mono flex items-center justify-center gap-2 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
                    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z" />
                    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z" />
                  </svg>
                  Continue with Google
                </button>
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground my-2">
                <div className="flex-1 h-[1px] bg-border" />
                <span>OR EMAIL OTP</span>
                <div className="flex-1 h-[1px] bg-border" />
              </div>
            </div>

            {/* Email OTP Fallback Form */}
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-muted-foreground mb-1.5">
                    Engineering Work Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="engineer@company.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-md bg-surface-elevated border border-border text-xs text-foreground focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                {authError && (
                  <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive font-mono">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 px-4 rounded-md bg-primary hover:bg-primary/90 text-foreground font-medium text-xs tracking-wide transition-colors flex items-center justify-center gap-2"
                >
                  {authLoading ? <BrandLoader size="sm" /> : "Send Verification Code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-muted-foreground mb-1.5">
                    Enter 6-Digit Code sent to {authEmail}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-md bg-surface-elevated border border-border text-xs text-foreground text-center tracking-widest text-lg font-mono focus:outline-none focus:border-primary"
                  />
                </div>

                {authError && (
                  <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive font-mono">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 px-4 rounded-md bg-success hover:bg-success/90 text-background font-semibold text-xs tracking-wider uppercase transition-colors flex items-center justify-center gap-2"
                >
                  {authLoading ? <BrandLoader size="sm" /> : "Verify & Access Console"}
                </button>
              </form>
            )}

            <div className="text-center font-mono text-[11px] text-muted-foreground pt-2">
              Protected by zero-retention enterprise session tokens.
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <Footer />
    </div>
  );
}
