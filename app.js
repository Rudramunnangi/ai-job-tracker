// Authentication & Application State Management
let currentUser = JSON.parse(localStorage.getItem('nexjob_active_user')) || null;
let jobs = [];

function loadUserData() {
    if (currentUser) {
        const storedJobs = localStorage.getItem(`nexjob_jobs_${currentUser.email}`);
        jobs = storedJobs ? JSON.parse(storedJobs) : [];
    } else {
        jobs = [];
    }
}

function saveUserData() {
    if (currentUser) {
        localStorage.setItem(`nexjob_jobs_${currentUser.email}`, JSON.stringify(jobs));
    }
}

// Authentication Logic
function handleAuth(type) {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();

    if (!email || !password) {
        alert("Please provide both email and password.");
        return;
    }

    const users = JSON.parse(localStorage.getItem('nexjob_users')) || {};

    if (type === 'signup') {
        if (users[email]) {
            alert("Account already exists. Please log in.");
            return;
        }
        users[email] = { email, password };
        localStorage.setItem('nexjob_users', JSON.stringify(users));
        currentUser = { email };
        localStorage.setItem('nexjob_active_user', JSON.stringify(currentUser));
    } else {
        if (!users[email] || users[email].password !== password) {
            alert("Invalid email or password.");
            return;
        }
        currentUser = { email };
        localStorage.setItem('nexjob_active_user', JSON.stringify(currentUser));
    }

    closeAuthModal();
    loadUserData();
    updateAuthUI();
    renderDashboard();
}

function logoutUser() {
    localStorage.removeItem('nexjob_active_user');
    currentUser = null;
    jobs = [];
    updateAuthUI();
    renderDashboard();
}

function openAuthModal() {
    document.getElementById('authModal').style.display = 'flex';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

function updateAuthUI() {
    const authBtn = document.getElementById('authNavBtn');
    const userDisplay = document.getElementById('userDisplay');
    const appContainer = document.getElementById('mainAppContainer');

    if (currentUser) {
        authBtn.innerText = "Logout";
        authBtn.onclick = logoutUser;
        if (userDisplay) userDisplay.innerText = currentUser.email;
        if (appContainer) appContainer.style.display = "block";
    } else {
        authBtn.innerText = "Login / Sign Up";
        authBtn.onclick = openAuthModal;
        if (userDisplay) userDisplay.innerText = "Guest Mode";
    }
}

// Modal Controllers
function openModal() {
    if (!currentUser) {
        alert("Please log in to add job applications.");
        openAuthModal();
        return;
    }
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
        id: Date.now(),
        company: company,
        role: role,
        date: date,
        status: status,
        tags: tags,
        jd: jd || "No Job Description provided."
    };

    jobs.unshift(newJob);
    saveUserData();
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

function changeJobStage(id, newStatus) {
    const target = jobs.find(j => j.id === id);
    if (target) {
        target.status = newStatus;
        saveUserData();
        renderDashboard();
    }
}

function onRoleChange() {
    const selector = document.getElementById('roleSelector');
    if (!selector || !selector.value) return;
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

// Trigger Gemini API
async function triggerGemini(action) {
    document.querySelectorAll('.ai-action-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-${action}`);
    if (activeBtn) activeBtn.classList.add('active');

    const selector = document.getElementById('roleSelector');
    if (!selector || !selector.value) {
        alert("Please add and select a job application first.");
        return;
    }

    const selectedId = parseInt(selector.value);
    const target = jobs.find(j => j.id === selectedId);
    const resume = document.getElementById('userResume').value;
    const customKey = document.getElementById('customApiKey').value;
    const resultBox = document.getElementById('aiResultBox');

    resultBox.innerHTML = "<p style='color:var(--accent-blue);'>Generating response with Gemini Flash...</p>";

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
            resultBox.innerHTML = "<p style='color:var(--accent-rose);'>Error: " + (data.detail || "Unable to process request.") + "</p>";
        }
    } catch (err) {
        resultBox.innerHTML = "<p style='color:var(--accent-rose);'>Connection error. Ensure the server is online.</p>";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadUserData();
    updateAuthUI();
    renderDashboard();
});
