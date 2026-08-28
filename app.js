let currentUser = JSON.parse(localStorage.getItem('nexjob_active_user')) || null;
let userProfile = JSON.parse(localStorage.getItem('nexjob_active_profile')) || null;
let jobs = [];

async function loadUserData() {
    if (currentUser && currentUser.email) {
        try {
            const res = await fetch(`/api/jobs?email=${encodeURIComponent(currentUser.email)}`);
            const data = await res.json();
            jobs = data.jobs || [];
        } catch (e) {
            jobs = [];
        }

        const resumeBox = document.getElementById('userResume');
        if (resumeBox && userProfile && userProfile.resume) {
            resumeBox.value = userProfile.resume;
        }
    } else {
        jobs = [];
        userProfile = null;
    }
}

// ----------------- Profile Actions -----------------
function openProfileModal() {
    if (!currentUser) {
        openAuthModal();
        return;
    }
    document.getElementById('profFullName').value = (userProfile && userProfile.fullName) || "";
    document.getElementById('profTargetRole').value = (userProfile && userProfile.targetRole) || "";
    document.getElementById('profSkills').value = (userProfile && userProfile.skills) || "";
    document.getElementById('profResume').value = (userProfile && userProfile.resume) || "";
    document.getElementById('profileModal').style.display = 'flex';
}

function closeProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
}

async function saveUserProfile() {
    if (!currentUser) return;

    userProfile = {
        fullName: document.getElementById('profFullName').value.trim(),
        targetRole: document.getElementById('profTargetRole').value.trim(),
        skills: document.getElementById('profSkills').value.trim(),
        resume: document.getElementById('profResume').value.trim()
    };

    try {
        await fetch("/api/profile/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: currentUser.email,
                full_name: userProfile.fullName,
                target_role: userProfile.targetRole,
                skills: userProfile.skills,
                resume: userProfile.resume
            })
        });
        localStorage.setItem('nexjob_active_profile', JSON.stringify(userProfile));

        const resumeBox = document.getElementById('userResume');
        if (resumeBox) resumeBox.value = userProfile.resume;

        closeProfileModal();
        updateAuthUI();
        alert("Profile saved to database successfully!");
    } catch (e) {
        alert("Error saving profile to server.");
    }
}

// ----------------- Authentication Actions -----------------
function openAuthModal() {
    document.getElementById('authModal').style.display = 'flex';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

async function handleAuth(type) {
    const emailEl = document.getElementById('authEmail');
    const passwordEl = document.getElementById('authPassword');
    const email = emailEl.value.trim();
    const password = passwordEl.value.trim();

    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    try {
        const endpoint = type === 'signup' ? '/api/auth/signup' : '/api/auth/login';
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.detail || "Authentication error.");
            return;
        }

        currentUser = { email: data.email || email };
        localStorage.setItem('nexjob_active_user', JSON.stringify(currentUser));

        if (data.profile) {
            userProfile = data.profile;
            localStorage.setItem('nexjob_active_profile', JSON.stringify(userProfile));
        }

        closeAuthModal();
        await loadUserData();
        updateAuthUI();
        renderDashboard();
    } catch (e) {
        alert("Server communication error.");
    }
}

function logoutUser() {
    localStorage.removeItem('nexjob_active_user');
    localStorage.removeItem('nexjob_active_profile');
    currentUser = null;
    userProfile = null;
    jobs = [];
    updateAuthUI();
    renderDashboard();
}

function updateAuthUI() {
    const authBtn = document.getElementById('authNavBtn');
    const userDisplay = document.getElementById('userDisplay');
    const profileBtn = document.getElementById('profileNavBtn');
    const profileLabel = document.getElementById('profileBtnLabel');
    const resumeNotice = document.getElementById('resumeNoticeBanner');

    if (currentUser && currentUser.email) {
        if (authBtn) {
            authBtn.innerText = "Logout";
            authBtn.onclick = logoutUser;
        }
        if (profileBtn) profileBtn.style.display = "inline-flex";

        if (userProfile && userProfile.fullName) {
            if (userDisplay) {
                userDisplay.innerText = userProfile.fullName;
                userDisplay.style.color = "var(--accent-emerald, #10b981)";
            }
            if (profileLabel) profileLabel.innerText = "My Profile";
        } else {
            if (userDisplay) {
                userDisplay.innerText = currentUser.email;
                userDisplay.style.color = "var(--accent-emerald, #10b981)";
            }
        }

        if (resumeNotice) {
            resumeNotice.style.display = (!userProfile || !userProfile.resume) ? "flex" : "none";
        }
    } else {
        if (authBtn) {
            authBtn.innerText = "Login / Sign Up";
            authBtn.onclick = openAuthModal;
        }
        if (profileBtn) profileBtn.style.display = "none";
        if (userDisplay) {
            userDisplay.innerText = "Guest Mode";
            userDisplay.style.color = "var(--text-muted, #94a3b8)";
        }
        if (resumeNotice) resumeNotice.style.display = "none";
    }
}

// ----------------- Application CRUD -----------------
function openModal() {
    if (!currentUser) {
        alert("Please Log In or Sign Up first to create job tracking entries.");
        openAuthModal();
        return;
    }
    document.getElementById('jobModal').style.display = 'flex';
    document.getElementById('modalDate').valueAsDate = new Date();
}

function closeModal() {
    document.getElementById('jobModal').style.display = 'none';
}

async function submitNewJob() {
    const company = document.getElementById('modalCompany').value.trim();
    const role = document.getElementById('modalRole').value.trim();
    const date = document.getElementById('modalDate').value || new Date().toISOString().split('T')[0];
    const status = document.getElementById('modalStatus').value;
    const tagsRaw = document.getElementById('modalTags').value.trim();
    const jd = document.getElementById('modalJD').value.trim();

    if (!company || !role) {
        alert("Please enter both Company Name and Role Title.");
        return;
    }

    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : ["General"];
    const newJob = {
        id: "job_" + Date.now(),
        user_email: currentUser.email,
        company: company,
        role: role,
        date: date,
        status: status,
        tags: tags,
        jd: jd || "No Job Description provided."
    };

    try {
        await fetch("/api/jobs/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newJob)
        });

        jobs.unshift(newJob);
        renderDashboard();
        closeModal();

        document.getElementById('modalCompany').value = '';
        document.getElementById('modalRole').value = '';
        document.getElementById('modalTags').value = '';
        document.getElementById('modalJD').value = '';
    } catch (e) {
        alert("Failed to save application to server.");
    }
}

async function changeJobStage(id, newStatus) {
    const target = jobs.find(j => j.id === id);
    if (target) {
        target.status = newStatus;
        await fetch("/api/jobs/update_status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id, status: newStatus })
        });
        renderDashboard();
    }
}

// ----------------- Dashboard Rendering -----------------
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
                        <span style="font-weight:700; color:var(--accent-rose, #f43f5e);">Follow-Up Required:</span> 
                        Applied to <b>${n.company}</b> (${n.role}) 5+ days ago without recruiter response.
                    </div>
                    <button class="btn-primary" style="padding: 6px 14px; font-size: 0.8rem;" onclick="selectJobAndNudge('${n.id}')">Draft Follow-Up</button>
                </div>
            `).join('');
        } else {
            nudgeContainer.innerHTML = '';
        }
    }

    const stages = [
        { name: "Applied", key: "Applied", color: "var(--accent-blue, #3b82f6)" },
        { name: "Interviewing", key: "Interviewing", color: "var(--accent-amber, #f59e0b)" },
        { name: "Offered", key: "Offered", color: "var(--accent-emerald, #10b981)" },
        { name: "Archived", key: "Rejected", color: "var(--text-muted, #94a3b8)" }
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
                        <select onchange="changeJobStage('${j.id}', this.value)" style="background:var(--bg-surface, #1e293b); color:#FFF; border:1px solid var(--border-subtle, #334155); border-radius:4px; padding:2px 6px; font-size:0.7rem;">
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
                    <div class="kanban-header" style="color: ${stage.color}; background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle, #334155);">
                        <span>${stage.name}</span>
                        <span>${stageJobs.length}</span>
                    </div>
                    ${cards || '<p style="color:var(--text-muted, #94a3b8); font-size:0.78rem; text-align:center; margin-top:20px;">No applications</p>'}
                </div>
            `;
        }).join('');
    }

    const selector = document.getElementById('roleSelector');
    if (selector) {
        if (jobs.length > 0) {
            selector.innerHTML = jobs.map(j => `<option value="${j.id}">${j.company} — ${j.role}</option>`).join('');
            onRoleChange();
        } else {
            selector.innerHTML = `<option value="">No applications added yet</option>`;
            const jdEl = document.getElementById('jobDesc');
            if (jdEl) jdEl.value = "";
        }
    }
}

function onRoleChange() {
    const selector = document.getElementById('roleSelector');
    if (!selector || !selector.value) return;
    const selectedId = selector.value;
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

// ----------------- Gemini API Trigger -----------------
async function triggerGemini(action) {
    document.querySelectorAll('.ai-action-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-${action}`);
    if (activeBtn) activeBtn.classList.add('active');

    const selector = document.getElementById('roleSelector');
    if (!selector || !selector.value) {
        alert("Please add and select a job application first.");
        return;
    }

    const selectedId = selector.value;
    const target = jobs.find(j => j.id === selectedId);
    const resume = document.getElementById('userResume').value;
    const customKey = document.getElementById('customApiKey').value;
    const resultBox = document.getElementById('aiResultBox');

    if (!resume || resume.trim().length < 10) {
        alert("Please enter or save your candidate resume background first to generate accurate insights.");
        openProfileModal();
        return;
    }

    resultBox.innerHTML = "<p style='color:var(--accent-blue, #3b82f6);'>Evaluating semantic alignment with Gemini 3.6 Flash...</p>";

    try {
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
            resultBox.innerHTML = "<p style='color:var(--accent-rose, #f43f5e);'>Error: " + (data.detail || "Unable to process request.") + "</p>";
        }
    } catch (err) {
        resultBox.innerHTML = "<p style='color:var(--accent-rose, #f43f5e);'>Connection error. Ensure the server is online.</p>";
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserData();
    updateAuthUI();
    renderDashboard();
});
