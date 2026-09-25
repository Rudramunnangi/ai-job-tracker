"use client";

import React from "react";
import { Hero3DNetwork } from "./Hero3DNetwork";

interface HeroProps {
  onScanClick: () => void;
  onExploreClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onScanClick, onExploreClick }) => {
  return (
    <section className="relative min-h-[580px] lg:min-h-[640px] flex items-center justify-center overflow-hidden border-b border-border">
      {/* 3D Career Node Network (The ONE 3D moment on the site) */}
      <Hero3DNetwork />

      {/* Hero Content Layer */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center flex flex-col items-center">
        {/* Social Proof Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-surface-elevated/90 border border-border text-xs font-mono text-muted-foreground mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
          <span>CALIBRATED AGAINST 100,000+ ENTERPRISE RECRUITING PIPELINES</span>
        </div>

        {/* Dynamic Color Animated Heading */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight leading-[1.12] mb-6">
          <span className="dynamic-heading">
            Stop sending resumes into the black hole.
          </span>
        </h1>

        {/* Qualitative Subheadline with Zero Arbitrary Numbers */}
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed mb-10 font-normal">
          Autonomous career intelligence that validates candidate qualifications against actual hiring bars. Instantly surface critical recruiter traps, quantify skill gaps, and execute calibrated outreach.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <button
            onClick={onScanClick}
            className="w-full sm:w-auto py-3 px-8 rounded-md bg-success hover:bg-success/90 text-background font-semibold text-sm tracking-wide transition-all cta-glow focus-visible:ring-2 focus-visible:ring-success focus:outline-none"
          >
            Run 1-Click ATS Scan
          </button>
          <a
            href="#journey-rail"
            className="w-full sm:w-auto py-3 px-6 rounded-md bg-surface-elevated hover:bg-surface-elevated/80 border border-border text-foreground font-medium text-sm tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
          >
            Explore System Pipeline ↓
          </a>
        </div>

        {/* Micro-telemetry Status */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-[11px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-success"></span>
            ZERO-RETENTION PROCESSING
          </span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-primary"></span>
            LOCAL AES-256 STORAGE
          </span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-warning"></span>
            INSTANT GUEST PREVIEW
          </span>
        </div>
      </div>
    </section>
  );
};
