"use client";

import React from "react";

export interface TrackedJob {
  id: string;
  company: string;
  role: string;
  date: string;
  status: "Applied" | "Interviewing" | "Offered" | "Archived";
  tags?: string[];
  jd?: string;
}

interface KanbanBoardProps {
  jobs: TrackedJob[];
  isGuest: boolean;
  onUpdateStatus: (id: string, newStatus: TrackedJob["status"]) => void;
  onSelectJob: (job: TrackedJob) => void;
  onLoginClick: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  jobs,
  isGuest,
  onUpdateStatus,
  onSelectJob,
  onLoginClick,
}) => {
  const columns: { title: string; status: TrackedJob["status"]; color: string }[] = [
    { title: "Applied", status: "Applied", color: "text-muted-foreground" },
    { title: "Interviewing", status: "Interviewing", color: "text-success" },
    { title: "Offered", status: "Offered", color: "text-primary" },
    { title: "Archived", status: "Archived", color: "text-muted-foreground/60" },
  ];

  const handleCardClick = (job: TrackedJob) => {
    onSelectJob(job);
    const element = document.getElementById("journey-rail");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="kanban-section" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-border">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-sm bg-surface-elevated border border-border text-[11px] font-mono text-muted-foreground mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            <span>PIPELINE ORCHESTRATION</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground">
            Active Submissions Ledger
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Click any active card to inspect qualifications against the Journey Rail triage engine.
          </p>
        </div>

        {isGuest && (
          <div className="p-3 rounded-md bg-warning/10 border border-warning/30 text-xs text-warning flex items-center gap-3">
            <span>Guest session data is stored in memory. Authenticate to sync across devices.</span>
            <button
              onClick={onLoginClick}
              className="px-3 py-1 rounded-sm bg-warning text-background font-medium hover:bg-warning/90 transition-colors"
            >
              Sign In
            </button>
          </div>
        )}
      </div>

      {/* Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map((col) => {
          const colJobs = jobs.filter((j) => j.status === col.status);
          return (
            <div
              key={col.status}
              className="bg-surface border border-border rounded-lg p-4 flex flex-col min-h-[380px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono uppercase font-bold ${col.color}`}>
                    {col.title}
                  </span>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded-sm bg-surface-elevated border border-border text-muted-foreground">
                  {colJobs.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="flex-1 space-y-3">
                {colJobs.length === 0 ? (
                  <div className="h-32 border border-dashed border-border rounded-md flex items-center justify-center text-xs font-mono text-muted-foreground/60">
                    No submissions
                  </div>
                ) : (
                  colJobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => handleCardClick(job)}
                      className="p-4 rounded-md bg-surface-elevated border border-border hover:border-primary/40 cursor-pointer transition-all group relative"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                          {job.company}
                        </h4>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          {job.date}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate font-mono">
                        {job.role}
                      </p>

                      {/* Card Footer: Status Dropdown */}
                      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                        <span className="text-[10px] font-mono text-muted-foreground">Status:</span>
                        <select
                          value={job.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            onUpdateStatus(job.id, e.target.value as TrackedJob["status"]);
                          }}
                          className="text-[11px] font-mono bg-surface border border-border rounded-sm px-2 py-1 text-foreground focus:outline-none focus:border-primary cursor-pointer"
                        >
                          <option value="Applied">Applied</option>
                          <option value="Interviewing">Interviewing</option>
                          <option value="Offered">Offered</option>
                          <option value="Archived">Archived</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
