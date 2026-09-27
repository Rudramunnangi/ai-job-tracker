"use client";

import React, { useEffect } from "react";
import { BrandLoader } from "./BrandLoader";

interface UserProfile {
  email: string;
  name: string;
  avatarUrl?: string;
  targetRole?: string;
  resumeText?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  isGuest: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
  trackedCount?: number;
}

export const ProfileDrawer: React.FC<ProfileDrawerProps> = ({
  isOpen,
  onClose,
  user,
  isGuest,
  onLoginClick,
  onLogout,
  trackedCount = 0,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Candidate Console">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div className="relative w-full max-w-md bg-surface border-l border-border h-full flex flex-col shadow-2xl z-10 overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLoader size="sm" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground">
              Candidate Console
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-surface-elevated text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
            aria-label="Close Drawer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Profile Details or Guest State */}
        <div className="p-6 flex-1 space-y-6">
          {isGuest || !user ? (
            <div className="p-5 rounded-lg border border-border bg-surface-elevated space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-warning">
                  Guest Session
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">Unauthenticated</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You are currently running in guest preview mode. Authenticate to sync your Resume Vault, unlock full Roadmap deep-dives, and track submissions.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onLoginClick();
                }}
                className="w-full py-2.5 px-4 rounded-md bg-primary hover:bg-primary/90 text-foreground font-medium text-xs tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-primary focus:outline-none"
              >
                Sign In / Register
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* User Identity Card */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-surface-elevated border border-border">
                <div className="w-12 h-12 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center font-mono font-bold text-lg text-primary">
                  {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {user.name || "Software Engineer"}
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground truncate">{user.email}</p>
                  {user.targetRole && (
                    <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-sm bg-surface border border-border font-mono text-success">
                      {user.targetRole}
                    </span>
                  )}
                </div>
              </div>

              {/* Resume Vault Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Resume Vault
                </h4>
                <div className="p-3.5 rounded-md bg-surface-elevated/60 border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                    <div>
                      <div className="text-xs font-medium text-foreground">Active Resume Vector</div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {user.resumeText ? "Indexed & Ready for 1-Click Scan" : "No resume uploaded yet"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tracked Applications Metric */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Application Tracking
                </h4>
                <div className="p-4 rounded-md bg-surface-elevated/60 border border-border flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Active Kanban Submissions</div>
                    <div className="text-lg font-mono font-bold text-foreground mt-0.5">{trackedCount}</div>
                  </div>
                  <a
                    href="#kanban-section"
                    onClick={onClose}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View Pipeline →
                  </a>
                </div>
              </div>

              {/* Verified Links */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Verified Identity & Links
                </h4>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded-md bg-surface-elevated/40 border border-border flex justify-between">
                    <span className="text-muted-foreground">LinkedIn:</span>
                    <span className="text-foreground truncate max-w-[200px]">{user.linkedin || "Not connected"}</span>
                  </div>
                  <div className="p-2.5 rounded-md bg-surface-elevated/40 border border-border flex justify-between">
                    <span className="text-muted-foreground">GitHub:</span>
                    <span className="text-foreground truncate max-w-[200px]">{user.github || "Not connected"}</span>
                  </div>
                  <div className="p-2.5 rounded-md bg-surface-elevated/40 border border-border flex justify-between">
                    <span className="text-muted-foreground">Portfolio:</span>
                    <span className="text-foreground truncate max-w-[200px]">{user.portfolio || "Not connected"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-border bg-surface-elevated/30">
          {!isGuest && user && (
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full py-2.5 px-4 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-medium tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-destructive focus:outline-none"
            >
              Sign Out
            </button>
          )}
          <div className="text-center mt-3">
            <span className="text-[10px] font-mono text-muted-foreground">
              NexJob AI Engine v2.4 • Zero-Retention Encryption
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
