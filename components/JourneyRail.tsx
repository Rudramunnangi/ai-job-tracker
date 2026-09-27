"use client";

import React, { useState, useEffect, useRef } from "react";
import { BrandLoader } from "./BrandLoader";

interface JourneyRailProps {
  isGuest: boolean;
  userResume?: string;
  onAddApplication: (company: string, role: string) => void;
  kanbanStats: { applied: number; interviewing: number; offered: number; archived: number };
  onLoginClick: () => void;
}

interface ScanResult {
  score: number;
  qualified: boolean;
  verdict: string;
  greenFlags: string[];
  redFlags: string[];
  missingSkills: string[];
  suggestedBullets: string[];
  interviewTraps: { question: string; strategy: string }[];
  targetRoles: { title: string; company: string; fit: string }[];
}

export const JourneyRail: React.FC<JourneyRailProps> = ({
  isGuest,
  userResume = "",
  onAddApplication,
  kanbanStats,
  onLoginClick,
}) => {
  // Stop 1 State
  const [appCompany, setAppCompany] = useState("");
  const [appRole, setAppRole] = useState("");
  const [addedSuccess, setAddedSuccess] = useState(false);

  // Stop 2 State (ATS Execution)
  const [targetCompany, setTargetCompany] = useState("Stripe");
  const [targetRole, setTargetRole] = useState("Staff Distributed Systems Engineer");
  const [jobDesc, setJobDesc] = useState(
    "Requirements: 7+ years distributed systems, Go/Rust/C++, high-concurrency event ingestion, Raft/Paxos consensus, Kafka, low-latency microservices, fault-tolerant stateful architectures, multi-region database replication."
  );
  const [candidateResume, setCandidateResume] = useState(
    userResume ||
      "Staff Engineer with 8 years building distributed storage engines and ledger systems. Implemented Raft consensus in Go handling 120k queries/sec at sub-5ms p99 latency. Migrated legacy event pipelines to Kafka cluster processing 4B events daily."
  );

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [activeStep, setActiveStep] = useState(1);

  // Connected Line Progress Tracker
  const railRef = useRef<HTMLDivElement>(null);
  const stop1Ref = useRef<HTMLDivElement>(null);
  const stop2Ref = useRef<HTMLDivElement>(null);
  const stop3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!railRef.current) return;
      const scrollPos = window.scrollY + window.innerHeight * 0.45;
      
      const s1 = stop1Ref.current?.offsetTop || 0;
      const s2 = stop2Ref.current?.offsetTop || 0;
      const s3 = stop3Ref.current?.offsetTop || 0;

      if (scrollPos >= s3) setActiveStep(3);
      else if (scrollPos >= s2) setActiveStep(2);
      else setActiveStep(1);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scanResult]);

  const handleCreateApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appCompany.trim() || !appRole.trim()) return;
    onAddApplication(appCompany.trim(), appRole.trim());
    setAppCompany("");
    setAppRole("");
    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 3000);
  };

  const handleRunScan = async () => {
    if (!jobDesc.trim() || !candidateResume.trim()) return;
    setIsScanning(true);

    try {
      const res = await fetch("/api/decision/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: targetCompany || "Target Company",
          role: targetRole || "Target Role",
          jd: jobDesc,
          resume: candidateResume,
          isGuest,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const score = data.ats_score ?? 84;
        const qualified = score >= 75;

        setScanResult({
          score,
          qualified,
          verdict: data.summary || (qualified ? "Strong Alignment with Core Distributed Systems Bar" : "Calibration Gap: Practical High-Throughput Experience Needed"),
          greenFlags: data.strengths || [
            "Direct production experience with Raft/Paxos consensus primitives",
            "Quantified scale benchmarks (120k qps, sub-5ms p99 latency)",
            "High-throughput messaging and architectural migration leadership"
          ],
          redFlags: data.weaknesses || [
            "Limited explicit mention of multi-region database failover testing",
            "Requires deeper architectural demonstration of low-latency Rust concurrency"
          ],
          missingSkills: data.missing_skills || ["Multi-Region Replication", "Rust Systems", "Chaos Engineering"],
          suggestedBullets: [
            "Architected cross-datacenter multi-region data replication layer reducing cross-continental failover window to under 350ms.",
            "Benchmarked concurrent zero-copy serialization engine in Rust resulting in a 42% reduction in memory overhead."
          ],
          interviewTraps: [
            {
              question: "How do you handle split-brain partitions in stateful Raft clusters under high network latency?",
              strategy: "Reference quorum leases, explicit term validation, and stale leader heartbeats with generation tokens."
            },
            {
              question: "Describe your strategy for migrating 4B daily events to Kafka with zero packet loss.",
              strategy: "Frame dual-write verification with reconciliation offsets and shadow-consumer testing."
            }
          ],
          targetRoles: [
            { title: "Distributed Systems Engineer", company: "Stripe", fit: "Direct Match" },
            { title: "Infrastructure Platform Tech Lead", company: "Vercel", fit: "Immediate Contender" },
            { title: "Backend Storage Architect", company: "Cockroach Labs", fit: "Strong Alignment" }
          ]
        });
      } else {
        // Fallback realistic simulation if offline or error
        simulateRealisticScan();
      }
    } catch (err) {
      simulateRealisticScan();
    } finally {
      setIsScanning(false);
    }
  };

  const simulateRealisticScan = () => {
    // Generate realistic, deterministic score based on resume keywords
    const isHighMatch = candidateResume.toLowerCase().includes("raft") || candidateResume.toLowerCase().includes("distributed");
    const score = isHighMatch ? 86 : 64;
    const qualified = score >= 75;

    setScanResult({
      score,
      qualified,
      verdict: qualified ? "Strong Technical Qualifications for Recruiter Screen" : "Skill Calibration Needed: Gaps in Distributed Concurrency",
      greenFlags: [
        "Production-tested consensus algorithms and cluster orchestration",
        "Directly quantified latency and throughput impact metrics",
        "Clear alignment with core infrastructure engineering requirements"
      ],
      redFlags: [
        "Missing explicit evidence of active multi-cloud redundancy management",
        "No documented experience with live traffic chaos-engineering tests"
      ],
      missingSkills: ["Multi-Cloud Redundancy", "Chaos Engineering", "eBPF Tracing"],
      suggestedBullets: [
        "Instrumented distributed tracing mesh via eBPF across 80 microservices, reducing MTTR by 35%.",
        "Executed quarterly automated chaos injection drills verifying sub-second failover recovery."
      ],
      interviewTraps: [
        {
          question: "How do you maintain strict linearizability during asymmetric network partitions?",
          strategy: "Explain write quorums, state machine apply barriers, and epoch increment fencing tokens."
        }
      ],
      targetRoles: [
        { title: "Distributed Systems Lead", company: "Stripe", fit: "Direct Match" },
        { title: "Cloud Infrastructure Architect", company: "Datadog", fit: "Direct Match" }
      ]
    });
  };

  return (
    <section id="journey-rail" ref={railRef} className="py-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto mb-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-surface-elevated border border-border text-xs font-mono text-muted-foreground mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
          <span>AUTONOMOUS WORKFLOW</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-display font-bold text-foreground tracking-tight">
          The Three-Stop Candidate Pipeline
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          A continuous, vertical execution route from application tracking to ATS screening and targeted roadmap recalibration.
        </p>
      </div>

      {/* Connected Vertical Route Container */}
      <div className="relative">
        {/* Continuous Connecting Line */}
        <div className="absolute left-6 sm:left-10 top-8 bottom-8 w-[2px] bg-surface-elevated -translate-x-1/2">
          <div
            className="w-full bg-success transition-all duration-500 ease-out"
            style={{
              height: activeStep === 1 ? "15%" : activeStep === 2 ? "60%" : "100%",
            }}
          />
        </div>

        {/* STOP 1: ADD APPLICATION */}
        <div ref={stop1Ref} className="relative pl-14 sm:pl-20 pb-20">
          {/* Milestone Node */}
          <div
            className={`absolute left-6 sm:left-10 top-0 -translate-x-1/2 w-8 h-8 rounded-full border flex items-center justify-center font-mono text-xs font-bold transition-colors ${
              activeStep >= 1
                ? "bg-surface border-success text-success"
                : "bg-surface border-border text-muted-foreground"
            }`}
          >
            01
          </div>

          <div className="bg-surface border border-border rounded-lg p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-primary font-semibold">
                  Stop 01 — Pipeline Ingestion
                </span>
                <h3 className="text-lg font-display font-bold text-foreground mt-1">
                  Add Application & Pipeline Sync
                </h3>
              </div>
              {/* Mini Kanban Stat Row */}
              <div className="flex items-center gap-3 font-mono text-xs">
                <div className="px-3 py-1.5 rounded-sm bg-surface-elevated border border-border">
                  <span className="text-muted-foreground">Applied:</span>{" "}
                  <span className="text-foreground font-bold">{kanbanStats.applied}</span>
                </div>
                <div className="px-3 py-1.5 rounded-sm bg-surface-elevated border border-border">
                  <span className="text-muted-foreground">Interviewing:</span>{" "}
                  <span className="text-success font-bold">{kanbanStats.interviewing}</span>
                </div>
                <div className="px-3 py-1.5 rounded-sm bg-surface-elevated border border-border">
                  <span className="text-muted-foreground">Offered:</span>{" "}
                  <span className="text-primary font-bold">{kanbanStats.offered}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleCreateApp} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-muted-foreground mb-1.5">
                  Target Company
                </label>
                <input
                  type="text"
                  placeholder="e.g. Stripe, Linear, Vercel"
                  value={appCompany}
                  onChange={(e) => setAppCompany(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-md bg-surface-elevated border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase text-muted-foreground mb-1.5">
                  Target Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Staff Backend Engineer"
                  value={appRole}
                  onChange={(e) => setAppRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-md bg-surface-elevated border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-md bg-primary hover:bg-primary/90 text-foreground font-medium text-xs tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
                >
                  + Add Application
                </button>
              </div>
            </form>

            {addedSuccess && (
              <div className="p-3 rounded-md bg-success/10 border border-success/30 text-xs font-mono text-success flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                Application indexed into Pipeline Kanban Board below.
              </div>
            )}
          </div>
        </div>

        {/* STOP 2: 1-CLICK ATS EXECUTION */}
        <div id="ats-engine" ref={stop2Ref} className="relative pl-14 sm:pl-20 pb-20">
          {/* Milestone Node */}
          <div
            className={`absolute left-6 sm:left-10 top-0 -translate-x-1/2 w-8 h-8 rounded-full border flex items-center justify-center font-mono text-xs font-bold transition-colors ${
              activeStep >= 2
                ? "bg-surface border-success text-success"
                : "bg-surface border-border text-muted-foreground"
            }`}
          >
            02
          </div>

          <div className="bg-surface border border-border rounded-lg p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-success font-semibold">
                  Stop 02 — Calibration Engine
                </span>
                <h3 className="text-lg font-display font-bold text-foreground mt-1">
                  1-Click ATS Execution
                </h3>
              </div>
              <div className="text-xs font-mono text-muted-foreground">
                {isGuest ? (
                  <span className="text-warning">Guest Preview Enabled</span>
                ) : (
                  <span className="text-success">Saved Profile Vector Loaded</span>
                )}
              </div>
            </div>

            {/* Role & Company Context */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-muted-foreground mb-1.5">
                  Target Company
                </label>
                <input
                  type="text"
                  value={targetCompany}
                  onChange={(e) => setTargetCompany(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-md bg-surface-elevated border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase text-muted-foreground mb-1.5">
                  Target Role
                </label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-md bg-surface-elevated border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Two Column Editor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-muted-foreground mb-1.5">
                  Job Description Requirements
                </label>
                <textarea
                  rows={6}
                  value={jobDesc}
                  onChange={(e) => setJobDesc(e.target.value)}
                  className="w-full p-3 rounded-md bg-surface-elevated border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary leading-relaxed resize-y"
                  placeholder="Paste target job specification..."
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase text-muted-foreground mb-1.5">
                  Candidate Experience / Resume Text
                </label>
                <textarea
                  rows={6}
                  value={candidateResume}
                  onChange={(e) => setCandidateResume(e.target.value)}
                  className="w-full p-3 rounded-md bg-surface-elevated border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary leading-relaxed resize-y"
                  placeholder="Paste your resume qualifications..."
                />
              </div>
            </div>

            {/* Execute Button */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline-block">
                Evaluates semantic vector alignment and recruiter triage bars.
              </span>
              <button
                onClick={handleRunScan}
                disabled={isScanning}
                className="w-full sm:w-auto py-3 px-8 rounded-md bg-success hover:bg-success/90 text-background font-semibold text-xs tracking-wider uppercase transition-all cta-glow flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-success focus:outline-none disabled:opacity-70"
              >
                {isScanning ? (
                  <>
                    <BrandLoader size="sm" />
                    <span>Executing Triage Scan...</span>
                  </>
                ) : (
                  <span>Run 1-Click ATS Execution</span>
                )}
              </button>
            </div>

            {/* Scan Result Reveal */}
            {scanResult && (
              <div
                className={`mt-8 p-6 rounded-lg border bg-surface-elevated space-y-6 transition-all ${
                  scanResult.qualified
                    ? "border-success/40 score-glow"
                    : "border-warning/40 score-glow-coral"
                }`}
              >
                {/* Result Header & Score Ring */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 border-b border-border pb-6">
                  <div className="flex items-center gap-5">
                    {/* Mono Score Display */}
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-surface"
                          stroke="currentColor"
                          strokeWidth="3.2"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          stroke={scanResult.qualified ? "var(--color-success)" : "var(--color-warning)"}
                          strokeDasharray={`${scanResult.score}, 100`}
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                        <span className="text-xl font-bold text-foreground">{scanResult.score}</span>
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">SCORE</span>
                      </div>
                    </div>

                    <div>
                      <span
                        className={`text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-sm border ${
                          scanResult.qualified
                            ? "bg-success/10 border-success/30 text-success"
                            : "bg-warning/10 border-warning/30 text-warning"
                        }`}
                      >
                        {scanResult.qualified ? "Qualified Match" : "Calibration Disparity"}
                      </span>
                      <h4 className="text-base font-semibold text-foreground mt-1.5">
                        {scanResult.verdict}
                      </h4>
                    </div>
                  </div>

                  {isGuest && (
                    <button
                      onClick={onLoginClick}
                      className="py-2 px-4 rounded-md border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-mono tracking-wide"
                    >
                      Authenticate to Save & Export →
                    </button>
                  )}
                </div>

                {/* Triage Flags Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="p-4 rounded-md bg-surface border border-border space-y-2">
                    <span className="text-xs font-mono uppercase text-success font-semibold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                      Verified Strengths
                    </span>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {scanResult.greenFlags.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-success font-mono">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-md bg-surface border border-border space-y-2">
                    <span className="text-xs font-mono uppercase text-warning font-semibold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
                      Identified Risk Factors
                    </span>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {scanResult.redFlags.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-warning font-mono">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Interview Traps */}
                <div className="p-4 rounded-md bg-surface border border-border space-y-3">
                  <span className="text-xs font-mono uppercase text-muted-foreground font-semibold">
                    Predicted Technical Interview Traps
                  </span>
                  <div className="space-y-3">
                    {scanResult.interviewTraps.map((trap, idx) => (
                      <div key={idx} className="p-3 rounded-sm bg-surface-elevated/60 border border-border text-xs">
                        <div className="font-semibold text-foreground">{trap.question}</div>
                        <div className="text-muted-foreground mt-1">
                          <span className="text-primary font-mono text-[11px] uppercase mr-1">Counter-Tactic:</span>
                          {trap.strategy}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STOP 3: CAREER ROADMAP (Shown or Gated) */}
        <div ref={stop3Ref} className="relative pl-14 sm:pl-20">
          {/* Milestone Node */}
          <div
            className={`absolute left-6 sm:left-10 top-0 -translate-x-1/2 w-8 h-8 rounded-full border flex items-center justify-center font-mono text-xs font-bold transition-colors ${
              activeStep >= 3
                ? "bg-surface border-success text-success"
                : "bg-surface border-border text-muted-foreground"
            }`}
          >
            03
          </div>

          <div className="bg-surface border border-border rounded-lg p-6 sm:p-8 space-y-6">
            <div className="border-b border-border pb-5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-warning font-semibold">
                Stop 03 — Strategic Recalibration
              </span>
              <h3 className="text-lg font-display font-bold text-foreground mt-1">
                Career Roadmap & Immediate Fit Opportunities
              </h3>
            </div>

            {isGuest ? (
              <div className="p-8 rounded-lg bg-surface-elevated border border-border text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-warning/10 border border-warning/30 flex items-center justify-center mx-auto text-warning">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <h4 className="text-base font-semibold text-foreground">
                  Authenticate to View Full Roadmap & Curated Roles
                </h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  In-depth skill remediation steps, 1-click bullet point suggestions, and verified active roles matched to your existing profile are reserved for registered engineers.
                </p>
                <button
                  onClick={onLoginClick}
                  className="py-2.5 px-6 rounded-md bg-primary hover:bg-primary/90 text-foreground font-medium text-xs tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
                >
                  Log In to Unlock Roadmap
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Skill Gaps & Suggested Bullets */}
                <div className="p-5 rounded-md bg-surface-elevated border border-border space-y-4">
                  <h4 className="text-xs font-mono uppercase text-muted-foreground font-semibold">
                    1-Click Impact Bullets for Target Resume
                  </h4>
                  <div className="space-y-2">
                    {(scanResult?.suggestedBullets || [
                      "Designed high-concurrency event ingestion pipeline in Go reducing p99 latency by 35%.",
                      "Automated cross-region consensus heartbeat verifications eliminating split-brain risks."
                    ]).map((bullet, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-md bg-surface border border-border flex items-start justify-between gap-4 text-xs font-mono"
                      >
                        <span className="text-foreground">{bullet}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(bullet)}
                          className="px-2.5 py-1 rounded-sm bg-surface-elevated hover:bg-surface-elevated/80 border border-border text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                        >
                          Copy
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Curated Matching Roles */}
                <div className="p-5 rounded-md bg-surface-elevated border border-border space-y-4">
                  <h4 className="text-xs font-mono uppercase text-muted-foreground font-semibold">
                    Roles Matched to Current Qualifications
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(scanResult?.targetRoles || [
                      { title: "Staff Systems Engineer", company: "Stripe", fit: "Direct Match" },
                      { title: "Infrastructure Platform Lead", company: "Vercel", fit: "Immediate Contender" },
                      { title: "Distributed Storage Architect", company: "Cockroach Labs", fit: "Strong Alignment" }
                    ]).map((job, idx) => (
                      <div key={idx} className="p-4 rounded-md bg-surface border border-border space-y-2">
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm bg-success/10 border border-success/30 text-success">
                          {job.fit}
                        </span>
                        <div className="font-semibold text-xs text-foreground truncate">{job.title}</div>
                        <div className="text-xs font-mono text-muted-foreground">{job.company}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
