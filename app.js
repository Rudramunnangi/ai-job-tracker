let currentUser = JSON.parse(localStorage.getItem('nexjob_active_user')) || null;
let userProfile = JSON.parse(localStorage.getItem('nexjob_active_profile')) || null;
let jobs = [];

// Sidebar Toggle Functionality (One-Click open / One-Click close)
function toggleSidebar() {
    const sidebar = document.getElementById('mainSidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

// Data Synchronization
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

        const roleBox = document.getElementById('targetJobRole');
        if (roleBox && userProfile && userProfile.targetRole && !roleBox.value) {
            roleBox.value = userProfile.targetRole;
        }
    } else {
        jobs = [];
        userProfile = null;
    }
}

// PDF Resume Upload (Members Only)
async function uploadResumePDF() {
    if (!currentUser) {
        alert("PDF Parsing is a Member feature. Please log in first.");
        openAuthModal();
        return;
    }

    const fileInput = document.getElementById('pdfFileInput');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert("Please choose a PDF file first.");
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append("file", file);

    const resultBox = document.getElementById('aiResultBox');
    resultBox.innerHTML = "<p style='color:var(--accent-blue);'>Parsing PDF resume in memory...</p>";

    try {
        const res = await fetch("/api/resume/upload-pdf", {
            method: "POST",
            headers: { "user-email": currentUser.email },
            body: formData
        });
        const data = await res.json();

        if (res.ok) {
            if (!userProfile) userProfile = {};
            userProfile.resume = data.extracted_text;
            localStorage.setItem('nexjob_active_profile', JSON.stringify(userProfile));

            document.getElementById('userResume').value = userProfile.resume;
            document.getElementById('profResume').value = userProfile.resume;
            resultBox.innerHTML = "<p style='color:var(--accent-emerald);'>Resume PDF successfully parsed and attached to your member profile!</p>";
            alert("Resume PDF successfully parsed and synced!");
        } else {
            resultBox.innerHTML = `<p style='color:var(--accent-rose);'>Upload Error: ${data.detail}</p>`;
            alert(data.detail);
        }
    } catch (err) {
        resultBox.innerHTML = "<p style='color:var(--accent-rose);'>Connection error during PDF parsing.</p>";
    }
}

// Profile Actions
function openProfileModal() {
    if (!currentUser) {
        openAuthModal();
        return;
    }
    document.getElementById('profFullName').value = (userProfile && userProfile.fullName) || "";
    document.getElementById('profTargetRole').value = (userProfile && userProfile.targetRole) || "";
    document.getElementById('profSkills').value = (userProfile && userProfile.skills) || "";
    document.getElementById('profLinkedin').value = (userProfile && userProfile.linkedin) || "";
    document.getElementById('profGithub').value = (userProfile && userProfile.github) || "";
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
        linkedin: document.getElementById('profLinkedin').value.trim(),
        github: document.getElementById('profGithub').value.trim(),
        portfolio: "",
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
                resume: userProfile.resume,
                linkedin_url: userProfile.linkedin,
                github_url: userProfile.github,
                portfolio_url: ""
            })
        });
        localStorage.setItem('nexjob_active_profile', JSON.stringify(userProfile));

        const resumeBox = document.getElementById('userResume');
        if (resumeBox) resumeBox.value = userProfile.resume;

        closeProfileModal();
        updateAuthUI();
        alert("Career profile saved successfully!");
    } catch (e) {
        alert("Error saving profile to server.");
    }
}

// Auth Actions & Diagnostics
function showAuthError(msg) {
    const box = document.getElementById('authErrorAlert');
    if (box) {
        box.innerText = msg;
        box.style.display = 'block';
    }
}

function clearAuthError() {
    const box = document.getElementById('authErrorAlert');
    if (box) {
        box.innerText = '';
        box.style.display = 'none';
    }
}

function openAuthModal() {
    clearAuthError();
    document.getElementById('authModal').style.display = 'flex';
    initGoogleAuthBtn();
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

function initGoogleAuthBtn() {
    const googleWrapper = document.getElementById('googleBtnWrapper');
    if (window.google && googleWrapper && googleWrapper.children.length === 0) {
        google.accounts.id.initialize({
            client_id: "680789423456-example.apps.googleusercontent.com", // Will log diagnostic on failure
            callback: handleGoogleResponse
        });
        google.accounts.id.renderButton(googleWrapper, {
            theme: "filled_black",
            size: "large",
            shape: "rectangular",
            text: "signin_with"
        });
    }
}

async function handleGoogleResponse(response) {
    clearAuthError();
    try {
        const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();

        if (!res.ok) {
            showAuthError(data.detail || "Google Login failed.");
            return;
        }

        currentUser = { email: data.email };
        userProfile = data.profile;
        localStorage.setItem('nexjob_active_user', JSON.stringify(currentUser));
        localStorage.setItem('nexjob_active_profile', JSON.stringify(userProfile));

        closeAuthModal();
        await loadUserData();
        updateAuthUI();
        renderDashboard();
    } catch (err) {
        showAuthError(`Network error during Google sign-in: ${err.message}`);
    }
}

async function handleAuth(type) {
    clearAuthError();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value.trim();

    if (!email || !password) {
        showAuthError("Please provide both email and password.");
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
            showAuthError(data.detail || "Authentication error.");
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
        showAuthError(`Server connection error: ${e.message}`);
    }
}

async function demoLogin() {
    clearAuthError();
    const demoEmail = "demo.candidate@nexjob.ai";
    const demoPass = "demo1234";

    try {
        let res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: demoEmail, password: demoPass })
        });
        
        if (!res.ok) {
            await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: demoEmail, password: demoPass })
            });
            res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: demoEmail, password: demoPass })
            });
        }

        const data = await res.json();
        currentUser = { email: data.email };
        userProfile = data.profile || { fullName: "Alex Demo", targetRole: "Full Stack Engineer" };
        localStorage.setItem('nexjob_active_user', JSON.stringify(currentUser));
        localStorage.setItem('nexjob_active_profile', JSON.stringify(userProfile));

        closeAuthModal();
        await loadUserData();
        updateAuthUI();
        renderDashboard();
    } catch (e) {
        showAuthError("Demo login error.");
    }
}

async function deleteAccount() {
    if (!currentUser) return;
    const confirmDelete = confirm("Are you sure you want to permanently delete your account, applications, and saved profile? This cannot be undone.");
    if (!confirmDelete) return;

    try {
        await fetch(`/api/account/delete?email=${encodeURIComponent(currentUser.email)}`, { method: "DELETE" });
        logoutUser();
        alert("Your account and all associated records have been purged.");
    } catch (e) {
        alert("Error deleting account.");
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
    const userDisplay = document.getElementById('userDisplayBadge');
    const profileBtn = document.getElementById('profileNavBtn');
    const deleteBtn = document.getElementById('deleteAccBtn');
    const guestBanner = document.getElementById('guestNoticeBanner');
    const memberWrapper = document.getElementById('memberFeaturesWrapper');
    const lockOverlay = document.getElementById('lockOverlayMessage');
    const selectorContainer = document.getElementById('applicationSelectorContainer');

    if (currentUser && currentUser.email) {
        if (authBtn) {
            authBtn.innerText = "Logout";
            authBtn.onclick = logoutUser;
        }
        if (profileBtn) profileBtn.style.display = "inline-flex";
        if (deleteBtn) deleteBtn.style.display = "block";
        if (guestBanner) guestBanner.style.display = "none";
        
        if (memberWrapper) {
            memberWrapper.classList.remove('member-locked');
        }
        if (lockOverlay) lockOverlay.style.display = "none";
        if (selectorContainer) selectorContainer.style.display = "block";

        if (userDisplay) {
            const name = (userProfile && userProfile.fullName) ? userProfile.fullName : currentUser.email;
            userDisplay.innerHTML = `<span style="color:var(--accent-emerald);">●</span> ${name}`;
        }
    } else {
        if (authBtn) {
            authBtn.innerText = "Login / Sign Up";
            authBtn.onclick = openAuthModal;
        }
        if (profileBtn) profileBtn.style.display = "none";
        if (deleteBtn) deleteBtn.style.display = "none";
        if (guestBanner) guestBanner.style.display = "flex";
        
        if (memberWrapper) {
            memberWrapper.classList.add('member-locked');
        }
        if (lockOverlay) lockOverlay.style.display = "flex";
        if (selectorContainer) selectorContainer.style.display = "none";

        if (userDisplay) userDisplay.innerText = "Guest Mode";
    }
}

// Kanban Management
function openModal() {
    if (!currentUser) {
        alert("Please log in first to track job applications.");
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
                <div class="nudge-card" style="margin-bottom: 1.5rem;">
                    <div>
                        <span style="font-weight:700; color:var(--accent-rose);">Follow-Up Due:</span> 
                        Applied to <b>${n.company}</b> (${n.role}) 5+ days ago without response.
                    </div>
                    <button class="btn-primary" style="padding: 6px 14px; font-size: 0.8rem;" onclick="selectJobAndNudge('${n.id}')">Evaluate & Follow-Up</button>
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
                        <select onchange="changeJobStage('${j.id}', this.value)" style="background:var(--bg-surface); color:#FFF; border:1px solid var(--border-subtle); border-radius:4px; padding:2px 6px; font-size:0.7rem;">
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
            selector.innerHTML = `<option value="">No applications added</option>`;
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
        const roleEl = document.getElementById('targetJobRole');
        const compEl = document.getElementById('targetJobCompany');
        if (jdEl) jdEl.value = target.jd;
        if (roleEl) roleEl.value = target.role;
        if (compEl) compEl.value = target.company;
    }
}

function selectJobAndNudge(id) {
    const selector = document.getElementById('roleSelector');
    if (selector) selector.value = id;
    onRoleChange();
    const atsSection = document.getElementById('ats-engine');
    if (atsSection) atsSection.scrollIntoView({ behavior: 'smooth' });
    runSmartDecision();
}

// 83% Smart Decision Engine Trigger
async function runSmartDecision() {
    const role = document.getElementById('targetJobRole').value.trim() || "Target Role";
    const company = document.getElementById('targetJobCompany').value.trim() || "Target Company";
    const jd = document.getElementById('jobDesc').value.trim();
    const resume = document.getElementById('userResume').value.trim();
    const resultBox = document.getElementById('aiResultBox');

    if (!jd || jd.length < 10) {
        alert("Please paste the target Job Description first.");
        return;
    }

    if (!resume || resume.length < 10) {
        alert("Please enter or paste candidate resume content first.");
        return;
    }

    resultBox.innerHTML = "<p style='color:var(--accent-blue);'>Calculating ATS alignment against the 83% benchmark with Gemini 3.6 Flash...</p>";

    const isGuest = (!currentUser || !currentUser.email);

    try {
        const res = await fetch("/api/gemini/smart-decision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                role: role,
                company: company,
                jd: jd,
                resume: resume,
                linkedin: (userProfile && userProfile.linkedin) || "",
                github: (userProfile && userProfile.github) || "",
                isGuest: isGuest
            })
        });
        const data = await res.json();
        if (res.ok) {
            resultBox.innerHTML = typeof marked !== 'undefined' ? marked.parse(data.result) : data.result;
        } else {
            resultBox.innerHTML = `<p style='color:var(--accent-rose);'>Error: ${data.detail || "Unable to process request."}</p>`;
        }
    } catch (err) {
        resultBox.innerHTML = "<p style='color:var(--accent-rose);'>Connection error. Ensure the server is online.</p>";
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserData();
    updateAuthUI();
    renderDashboard();
});
