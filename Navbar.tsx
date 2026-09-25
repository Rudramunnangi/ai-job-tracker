"use client";

import React from "react";
import { BrandLoader } from "./BrandLoader";

interface NavbarProps {
  isGuest: boolean;
  userEmail: string;
  userName?: string;
  onOpenProfile: () => void;
  onLoginClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isGuest,
  userEmail,
  userName,
  onOpenProfile,
  onLoginClick,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left Side: Toggle button next to Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenProfile}
            className="p-2 rounded-md border border-border bg-surface hover:bg-surface-elevated text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
            aria-label="Open Candidate Console"
            title="Candidate Profile & Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <a href="#" className="flex items-center gap-2.5 group focus-visible:ring-2 focus-visible:ring-primary focus:outline-none rounded-sm">
            <div className="w-8 h-8 rounded-md bg-surface-elevated border border-border flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 28V12L28 28V12" stroke="var(--color-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-sm tracking-tight text-foreground group-hover:text-success transition-colors">
                NexJob<span className="text-success font-mono font-bold text-xs ml-1">AI</span>
              </span>
              <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
                Career Engine
              </span>
            </div>
          </a>
        </div>

        {/* Center / Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
          <a href="#journey-rail" className="hover:text-foreground transition-colors">
            Journey Rail
          </a>
          <a href="#ats-engine" className="hover:text-foreground transition-colors">
            ATS Triage
          </a>
          <a href="#kanban-section" className="hover:text-foreground transition-colors">
            Pipeline
          </a>
          <a href="#features-matrix" className="hover:text-foreground transition-colors">
            System Specs
          </a>
        </nav>

        {/* Right Side: Status Pill */}
        <div className="flex items-center gap-3">
          {isGuest ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-surface-elevated border border-border text-[11px] font-mono text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>
                <span>Guest Preview</span>
              </div>
              <button
                onClick={onLoginClick}
                className="py-1.5 px-3.5 rounded-md bg-primary hover:bg-primary/90 text-foreground font-medium text-xs tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
              >
                Sign In
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2.5 p-1 pl-3 pr-2 rounded-md bg-surface-elevated border border-border hover:border-primary/40 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
            >
              <span className="w-2 h-2 rounded-full bg-success"></span>
              <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                {userName || userEmail.split("@")[0]}
              </span>
              <div className="w-6 h-6 rounded-sm bg-primary/20 border border-primary/30 flex items-center justify-center font-mono text-xs text-primary font-bold">
                {(userName || userEmail).charAt(0).toUpperCase()}
              </div>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
