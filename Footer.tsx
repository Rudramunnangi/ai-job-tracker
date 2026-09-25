"use client";

import React, { useState } from "react";

export const Footer: React.FC = () => {
  const [showTos, setShowTos] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <>
      <footer className="border-t border-border bg-surface text-muted-foreground text-xs py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Column 1: Brand & Status */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-surface-elevated border border-border flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 40 40" fill="none">
                    <path d="M12 28V12L28 28V12" stroke="var(--color-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="font-display font-bold text-sm text-foreground">
                  NexJob<span className="text-success font-mono font-bold text-xs ml-1">AI</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Autonomous career intelligence engine calibrated against enterprise recruiting pipelines and hiring benchmarks.
              </p>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-surface-elevated border border-border font-mono text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                <span className="text-foreground">Engine v2.4 Online</span>
              </div>
            </div>

            {/* Column 2: System Capabilities */}
            <div className="space-y-3 font-mono">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                System Specs
              </h3>
              <ul className="space-y-2 text-xs">
                <li><a href="#ats-engine" className="hover:text-foreground transition-colors">6-Second Recruiter Triage</a></li>
                <li><a href="#journey-rail" className="hover:text-foreground transition-colors">STAR Interview Frameworks</a></li>
                <li><a href="#kanban-section" className="hover:text-foreground transition-colors">Pipeline Orchestration</a></li>
                <li><a href="#journey-rail" className="hover:text-foreground transition-colors">Anti-Ghosting Cadence</a></li>
              </ul>
            </div>

            {/* Column 3: Telemetry & Security */}
            <div className="space-y-3 font-mono">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Security & Specs
              </h3>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-1.5 text-foreground">
                  <span className="text-success">•</span> AES-256 Client-Side Vault
                </li>
                <li className="flex items-center gap-1.5 text-foreground">
                  <span className="text-primary">•</span> Zero-Retention AI Pipeline
                </li>
                <li className="flex items-center gap-1.5 text-foreground">
                  <span className="text-warning">•</span> Direct Google OAuth 2.0
                </li>
                <li className="flex items-center gap-1.5 text-muted-foreground">
                  <span>•</span> TLS 1.3 Strict In-Transit
                </li>
              </ul>
            </div>

            {/* Column 4: Legal & Policies */}
            <div className="space-y-3 font-mono">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Governance
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    onClick={() => setShowTos(true)}
                    className="hover:text-foreground transition-colors text-left"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setShowPrivacy(true)}
                    className="hover:text-foreground transition-colors text-left"
                  >
                    Privacy Policy (Zero Retention)
                  </button>
                </li>
                <li>
                  <a href="/admin" className="hover:text-foreground transition-colors">
                    Admin Cockpit
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px]">
            <div>
              &copy; 2026 NexJob AI. All rights reserved.
            </div>
            <div className="text-muted-foreground">
              Built for high-performance software engineers and technical leaders.
            </div>
          </div>
        </div>
      </footer>

      {/* Terms of Service Modal */}
      {showTos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-surface border border-border rounded-lg max-w-2xl w-full p-6 sm:p-8 max-h-[80vh] overflow-y-auto space-y-4 text-xs leading-relaxed">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
                NexJob AI — Terms of Service
              </h3>
              <button
                onClick={() => setShowTos(false)}
                className="p-1 rounded-sm hover:bg-surface-elevated text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="text-muted-foreground">Effective Date: September 2026</p>
            <h4 className="font-semibold text-foreground font-mono">1. Acceptance of Terms</h4>
            <p className="text-muted-foreground">
              By accessing or using NexJob AI, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must discontinue platform use immediately.
            </p>
            <h4 className="font-semibold text-foreground font-mono">2. Analytical & Non-Guarantee Scope</h4>
            <p className="text-muted-foreground">
              NexJob AI provides calibrated automated match analytics, simulated recruiter triage, and interview preparation materials based on user-supplied resumes and job descriptions. While our algorithms are calibrated against industry patterns, NexJob AI does not guarantee interview invitations, offers, or employment outcomes.
            </p>
            <h4 className="font-semibold text-foreground font-mono">3. Candidate Data Responsibility</h4>
            <p className="text-muted-foreground">
              You are responsible for ensuring that any uploaded documents or portfolio text belong to you and do not infringe on non-disclosure agreements or third-party copyrights.
            </p>
            <div className="pt-4 border-t border-border flex justify-end">
              <button
                onClick={() => setShowTos(false)}
                className="px-4 py-2 rounded-md bg-surface-elevated hover:bg-surface border border-border text-foreground font-mono text-xs"
              >
                Close Terms
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-surface border border-border rounded-lg max-w-2xl w-full p-6 sm:p-8 max-h-[80vh] overflow-y-auto space-y-4 text-xs leading-relaxed">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
                NexJob AI — Privacy Policy (Zero-Retention)
              </h3>
              <button
                onClick={() => setShowPrivacy(false)}
                className="p-1 rounded-sm hover:bg-surface-elevated text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="text-muted-foreground">Effective Date: September 2026</p>
            <h4 className="font-semibold text-foreground font-mono">1. Zero-Retention AI Architecture</h4>
            <p className="text-muted-foreground">
              Your resume text and job descriptions are evaluated in-memory during active sessions. We do not use your proprietary career documents or resumes to train foundation models.
            </p>
            <h4 className="font-semibold text-foreground font-mono">2. Local Storage & Client Encryption</h4>
            <p className="text-muted-foreground">
              Your tracked applications and profile links are stored with client-side isolation. Authenticated accounts utilize encrypted session tokens with standard TLS 1.3 transit encryption.
            </p>
            <h4 className="font-semibold text-foreground font-mono">3. Right to Complete Deletion</h4>
            <p className="text-muted-foreground">
              You retain the absolute right to purge all tracked applications, uploaded vectors, and credentials at any time directly through the Candidate Console.
            </p>
            <div className="pt-4 border-t border-border flex justify-end">
              <button
                onClick={() => setShowPrivacy(false)}
                className="px-4 py-2 rounded-md bg-surface-elevated hover:bg-surface border border-border text-foreground font-mono text-xs"
              >
                Close Privacy Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
