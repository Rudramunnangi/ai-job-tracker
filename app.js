let jobs = [
    {
        id: 1,
        company: "Google Cloud",
        role: "Cloud AI Architect",
        date: "2026-08-22",
        status: "Applied",
        tags: ["GCP", "Gemini 3.6", "Python", "Cloud Run"],
        jd: "Design enterprise-grade Generative AI pipelines on Google Cloud Platform using Gemini 3.6 models, Vertex AI, Docker, and Cloud Run serverless microservices. Optimize inference latency and token costs."
    },
    {
        id: 2,
        company: "Stripe",
        role: "Full-Stack Core Engineer",
        date: "2026-08-26",
        status: "Interviewing",
        tags: ["Go", "Distributed Systems", "PostgreSQL"],
        jd: "Architect high-throughput payment settlement engines with sub-100ms latency. Deep experience in concurrent backend services and distributed consensus algorithms."
    },
    {
        id: 3,
        company: "DeepMind",
        role: "AI Platform Lead",
        date: "2026-08-15",
        status: "Offered",
        tags: ["Kubernetes", "GPU Scheduling", "PyTorch"],
        jd: "Manage large-scale multi-node GPU inference clusters, automated model checkpoints, and low-latency synthetic benchmark suites."
    }
];

function openModal() {
    document.getElementById('jobModal').style.display = 'flex';
    document.getElementById('modalDate').valueAsDate = new Date();
}

function closeModal() {
    document.getElementById('jobModal').style.display = 'none';
}

function submitNewJob() {
    const company = document.getElementById('modalCompany').value.trim();
    const role = document.getElementById('modalRole').value.trim();
    const date = document.getElementById('modalDate').value || new Date().toISOString().split('T')[0];
    const status = document.getElementById('modalStatus').value;
    const tagsRaw = document.getElementById('modalTags').value.trim();
    const jd = document.getElementById('modalJD').value.trim();

    if (!company || !role) {
        alert("Please specify Company Name and Role Title.");
        return;
    }

    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : ["General"];
    const newJob = {
        id: jobs.length + 1,
        company: company,
        role: role,
        date: date,
        status: status,
        tags: tags,
        jd: jd || "No Job Description provided."
    };

    jobs.unshift(newJob);
    renderDashboard();
    closeModal();

    document.getElementById('modalCompany').value = '';
    document.getElementById('modalRole').value = '';
    document.getElementById('modalTags').value = '';
    document.getElementById('modalJD').value = '';
}

function renderDashboard() {
    const total = jobs.length;
    const pipe = jobs.filter(j => j.status === 'Applied' || j.status === 'Interviewing').length;
    const offers = jobs.filter(j => j.status === 'Offered').length;
    
    const today = new Date();
    const nudges = jobs.filter(j => {
        if (j.status !== 'Applied') return false;
        const diffDays = Math.floor((today - new Date(j.date)) / (1000 * 60 * 60 * 24));
        return diffDays >= 5;
    });

    const statTotalEl = document.getElementById('statTotal');
    if (statTotalEl) statTotalEl.innerText = total;
    const statPipeEl = document.getElementById('statPipe');
    if (statPipeEl) statPipeEl.innerText = pipe;
    const statOffersEl = document.getElementById('statOffers');
    if (statOffersEl) statOffersEl.innerText = offers;
    const statNudgesEl = document.getElementById('statNudges');
    if (statNudgesEl) statNudgesEl.innerText = nudges.length;

    const nudgeContainer = document.getElementById('nudgeAlertContainer');
    if (nudgeContainer) {
        if (nudges.length > 0) {
            nudgeContainer.innerHTML = nudges.map(n => `
                <div class="nudge-card">
                    <div>
                        <span style="font-weight:700; color:var(--accent-rose);">Follow-Up Required:</span> 
                        Applied to <b>${n.company}</b> (${n.role}) 5+ days ago without recruiter response.
                    </div>
                    <button class="btn-primary" style="padding: 6px 14px; font-size: 0.8rem;" onclick="selectJobAndNudge(${n.id})">Draft Follow-Up</button>
                </div>
            `).join('');
        } else {
            nudgeContainer.innerHTML = '';
        }
    }

    const stages = [
        { name: "Applied", key: "Applied", color: "var(--accent-blue)" },
        { name: "Interviewing", key: "Interviewing", color: "var(--accent-amber)" },
        { name: "Offered", key: "Offered", color: "var(--accent-emerald)" },
        { name: "Archived", key: "Rejected", color: "var(--text-muted)" }
    ];

    const kanbanGrid = document.getElementById('kanbanGrid');
    if (kanbanGrid) {
        kanbanGrid.innerHTML = stages.map(stage => {
            const stageJobs = jobs.filter(j => j.status === stage.key);
            const cards = stageJobs.map(j => `
                <div class="kanban-card">
                    <div class="kanban-role">${j.role}</div>
                    <div class="kanban-comp">${j.company}</div>
                    <div style="margin-bottom: 8px;">
                        ${j.tags.map(t => `<span class="tag-chip">${t}</span>`).join('')}
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted);">
                        <span>${j.date}</span>
                        <select onchange="changeJobStage(${j.id}, this.value)" style="background:var(--bg-surface); color:#FFF; border:1px solid var(--border-subtle); border-radius:4px; padding:2px 6px; font-size:0.7rem;">
                            <option ${j.status==='Applied'?'selected':''}>Applied</option>
                            <option ${j.status==='Interviewing'?'selected':''}>Interviewing</option>
                            <option ${j.status==='Offered'?'selected':''}>Offered</option>
                            <option ${j.status==='Rejected'?'selected':''}>Rejected</option>
                        </select>
                    </div>
                </div>
            `).join('');

            return `
                <div class="kanban-col">
                    <div class="kanban-header" style="color: ${stage.color}; background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle);">
                        <span>${stage.name}</span>
                        <span>${stageJobs.length}</span>
                    </div>
                    ${cards || '<p style="color:var(--text-muted); font-size:0.78rem; text-align:center; margin-top:20px;">No applications</p>'}
                </div>
            `;
        }).join('');
    }

    const selector = document.getElementById('roleSelector');
    if (selector) {
        selector.innerHTML = jobs.map(j => `<option value="${j.id}">${j.company} — ${j.role}</option>`).join('');
        onRoleChange();
    }
}

function changeJobStage(id, newStatus) {
    const target = jobs.find(j => j.id === id);
    if (target) {
        target.status = newStatus;
        renderDashboard();
    }
}

function onRoleChange() {
    const selector = document.getElementById('roleSelector');
    if (!selector) return;
    const selectedId = parseInt(selector.value);
    const target = jobs.find(j => j.id === selectedId);
    if (target) {
        const jdEl = document.getElementById('jobDesc');
        if (jdEl) jdEl.value = target.jd;
    }
}

function selectJobAndNudge(id) {
    const selector = document.getElementById('roleSelector');
    if (selector) selector.value = id;
    onRoleChange();
    const copilotEl = document.getElementById('copilot');
    if (copilotEl) copilotEl.scrollIntoView({ behavior: 'smooth' });
    triggerGemini('nudge');
}

// Trigger Gemini API and update Active Button State
async function triggerGemini(action) {
    document.querySelectorAll('.ai-action-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-${action}`);
    if (activeBtn) activeBtn.classList.add('active');

    const selector = document.getElementById('roleSelector');
    const selectedId = parseInt(selector.value);
    const target = jobs.find(j => j.id === selectedId);
    const resume = document.getElementById('userResume').value;
    const customKey = document.getElementById('customApiKey').value;
    const resultBox = document.getElementById('aiResultBox');

    resultBox.innerHTML = "<p style='color:var(--accent-blue);'>Streaming response from Gemini 3.6 Flash on Google Cloud...</p>";

    try {
        // Updated to relative path for both local and cloud deployment
        const res = await fetch("/api/gemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: action,
                role: target.role,
                company: target.company,
                jd: target.jd,
                resume: resume,
                apiKey: customKey
            })
        });
        const data = await res.json();
        if (res.ok) {
            resultBox.innerHTML = typeof marked !== 'undefined' ? marked.parse(data.result) : data.result;
        } else {
            resultBox.innerHTML = "<p style='color:var(--accent-rose);'>Error: " + (data.detail || "Unable to process request.") + "</p>";
        }
    } catch (err) {
        resultBox.innerHTML = "<p style='color:var(--accent-rose);'>Connection error. Ensure the server is running.</p>";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
});
