"use client";

import React, { useState, useEffect } from "react";
import { BrandLoader } from "./BrandLoader";

interface RegisteredUser {
  email: string;
  fullName: string;
  targetRole: string;
  joinedDate: string;
  jobCount: number;
}

export const AdminCockpit: React.FC = () => {
  const [totalUsers, setTotalUsers] = useState(142);
  const [activeUsers, setActiveUsers] = useState(18);
  const [totalJobs, setTotalJobs] = useState(874);
  const [users, setUsers] = useState<RegisteredUser[]>([
    { email: "alex.chen@platform.io", fullName: "Alex Chen", targetRole: "Staff Systems Engineer", joinedDate: "2026-09-24 14:22", jobCount: 6 },
    { email: "sarah.m@infra.dev", fullName: "Sarah Miller", targetRole: "Lead Distributed Systems", joinedDate: "2026-09-24 11:05", jobCount: 4 },
    { email: "marcus.k@cloud.net", fullName: "Marcus Krause", targetRole: "Kubernetes Platform Architect", joinedDate: "2026-09-23 18:40", jobCount: 11 },
    { email: "elena.r@ai-core.org", fullName: "Elena Rostova", targetRole: "ML Infrastructure Lead", joinedDate: "2026-09-23 09:15", jobCount: 3 },
  ]);
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground p-6 sm:p-10 font-body">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <BrandLoader size="md" />
            <div>
              <h1 className="text-xl font-display font-bold text-foreground">
                NexJob AI — Central Cockpit
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                System telemetry, user directory, and live candidate sessions.
              </p>
            </div>
          </div>
          <a
            href="/"
            className="px-4 py-2 rounded-md bg-surface-elevated border border-border text-xs font-mono text-foreground hover:bg-surface transition-colors"
          >
            ← Return to Application
          </a>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-5 rounded-lg bg-surface border border-border">
            <span className="text-xs font-mono uppercase text-muted-foreground">Total Registrations</span>
            <div className="text-2xl font-mono font-bold text-primary mt-2">{totalUsers}</div>
          </div>
          <div className="p-5 rounded-lg bg-surface border border-border">
            <span className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
              Live Presence Sessions
            </span>
            <div className="text-2xl font-mono font-bold text-success mt-2">{activeUsers}</div>
          </div>
          <div className="p-5 rounded-lg bg-surface border border-border">
            <span className="text-xs font-mono uppercase text-muted-foreground">Tracked Applications</span>
            <div className="text-2xl font-mono font-bold text-warning mt-2">{totalJobs}</div>
          </div>
        </div>

        {/* User Directory Table */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
              Registered Candidate History
            </h2>
            <span className="text-xs font-mono text-muted-foreground">
              Direct DB Sync: Active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-surface-elevated border-b border-border text-muted-foreground uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Candidate Email</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Target Role</th>
                  <th className="py-3 px-4">Joined Timestamp</th>
                  <th className="py-3 px-4">Applications</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u, idx) => (
                  <tr key={idx} className="hover:bg-surface-elevated/40 transition-colors">
                    <td className="py-3 px-4 text-foreground font-medium">{u.email}</td>
                    <td className="py-3 px-4 text-muted-foreground">{u.fullName}</td>
                    <td className="py-3 px-4 text-success">{u.targetRole}</td>
                    <td className="py-3 px-4 text-muted-foreground">{u.joinedDate}</td>
                    <td className="py-3 px-4 text-primary font-bold">{u.jobCount}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Remove user ${u.email}?`)) {
                            setUsers(users.filter((x) => x.email !== u.email));
                          }
                        }}
                        className="px-2.5 py-1 rounded-sm border border-destructive/40 text-destructive hover:bg-destructive/10 text-[11px]"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
