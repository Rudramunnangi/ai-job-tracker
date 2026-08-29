let currentUser = JSON.parse(localStorage.getItem('nexjob_active_user')) || null;
let userProfile = JSON.parse(localStorage.getItem('nexjob_active_profile')) || null;
let jobs = [];

// Drawer Controller
function toggleDrawer() {
    const drawer = document.getElementById('profileDrawer');
    const scrim = document.getElementById('drawerScrim');
    if (drawer && scrim) {
        drawer.classList.toggle('open');
        scrim.classList.toggle('active');
    }
}

function scrollToPipeline() {
    const el = document.getElementById('memberPipelineContainer');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
}

function scrollToVault() {
    const el = document.getElementById('resumeVaultBox');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
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

// PDF Resume Parsing (Members Only)
async function uploadResumePDF() {
    if (!currentUser) {
        alert("PDF Parsing is a member-only feature. Please sign in.");
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

    const resultBox = document.getElementById('atsResultWindow');
    resultBox.innerHTML = "<p class='text-indigo'>Parsing PDF resume content in memory...</p>";

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
            resultBox.innerHTML = "<p class='text-teal'>Resume PDF successfully parsed and synced to your profile.</p>";
            alert("Resume PDF successfully parsed and synced!");
        } else {
            resultBox.innerHTML = `<p class='text-coral'>Upload Error: ${data.detail}</p>`;
            alert(data.detail);
        }
    } catch (err) {
        resultBox.innerHTML = "<p class='text-coral'>Connection error during PDF parsing.</p>";
    }
}

// Profile Modal Controllers
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

// Auth Handlers & Error Diagnostics
function showAuthError(msg) {
    const box = document.getElementById('authDiagnosticBox');
    if (box) {
        box.innerText = msg;
        box.style.display = 'block';
    }
}

function clearAuthError() {
    const box = document.getElementById('authDiagnosticBox');
    if (box) {
        box.innerText = '';
        box.style.display = 'none';
    }
}

function openAuthModal() {
    clearAuthError();
    document.getElementById('authModal').style.display = 'flex';
    initGoogleAuth();
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

function initGoogleAuth() {
    const wrapper = document.getElementById('googleAuthWrapper');
    if (window.google && wrapper && wrapper.children.length === 0) {
        google.accounts.id.initialize({
            client_id: "367560024253-20ebmeiedvdammukrcplc5uh2orqedpl.apps.googleusercontent.com",
            callback: handleGoogleResponse
        });
        google.accounts.id.renderButton(wrapper, {
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
        userProfile = data.profile || { fullName: "Alex Demo", targetRole: "Full Stack AI Engineer" };
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
    const confirmDelete = confirm("Are you sure you want to permanently delete your account, applications, and saved profile?");
    if (!confirmDelete) return;

    try {
        await fetch(`/api/account/delete?email=${encodeURIComponent(currentUser.email)}`, { method: "DELETE" });
        logoutUser();
        alert("Your account has been purged.");
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
    const guestTop = document.getElementById('guestTopControls');
    const userTop = document.getElementById('userTopControls');
    const userDisplayName = document.getElementById('userDisplayName');
    const userAvatarLetter = document.getElementById('userAvatarLetter');
    const drawerGuestActions = document.getElementById('drawerGuestActions');
    const drawerMemberActions = document.getElementById('drawerMemberActions');
    const drawerAvatar = document.getElementById('drawerAvatar');
    const drawerUserName = document.getElementById('drawerUserName');
    const drawerUserEmail = document.getElementById('drawerUserEmail');
    const memberPipeline = document.getElementById('memberPipelineContainer');
    const resumeVaultBox = document.getElementById('resumeVaultBox');
    const resumeStatusNote = document.getElementById('resumeStatusNote');

    if (currentUser && currentUser.email) {
        const name = (userProfile && userProfile.fullName) || currentUser.email.split('@')[0];
        const initial = name.charAt(0).toUpperCase();

        if (guestTop) guestTop.style.display = 'none';
        if (userTop) userTop.style.display = 'flex';
        if (userDisplayName) userDisplayName.innerText = name;
        if (userAvatarLetter) userAvatarLetter.innerText = initial;

        if (drawerGuestActions) drawerGuestActions.style.display = 'none';
        if (drawerMemberActions) drawerMemberActions.style.display = 'block';
        if (drawerAvatar) drawerAvatar.innerText = initial;
        if (drawerUserName) drawerUserName.innerText = name;
        if (drawerUserEmail) drawerUserEmail.innerText = currentUser.email;

        if (memberPipeline) memberPipeline.style.display = 'block';
        if (resumeVaultBox) resumeVaultBox.style.display = 'block';
        if (resumeStatusNote) resumeStatusNote.innerText = "Synced with profile resume";
    } else {
        if (guestTop) guestTop.style.display = 'flex';
        if (userTop) userTop.style.display = 'none';

        if (drawerGuestActions) drawerGuestActions.style.display = 'block';
        if (drawerMemberActions) drawerMemberActions.style.display = 'none';
        if (drawerAvatar) drawerAvatar.innerText = 'G';
        if (drawerUserName) drawerUserName.innerText = 'Guest User';
        if (drawerUserEmail) drawerUserEmail.innerText = 'Not signed in';

        if (memberPipeline) memberPipeline.style.display = 'none';
        if (resumeVaultBox) resumeVaultBox.style.display = 'none';
        if (resumeStatusNote) resumeStatusNote.innerText = "Guest Mode: Paste text below";
    }
}

// Kanban Management
function openJobModal() {
    if (!currentUser) {
        alert("Please log in first to track job applications.");
        openAuthModal();
        return;
    }
    document.getElementById('jobModal').style.display = 'flex';
    document.getElementById('modalDate').valueAsDate = new Date();
}

function closeJobModal() {
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
        closeJobModal();

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
                <div class="nudge-card">
                    <div>
                        <span style="font-weight:700; color:var(--accent-coral);">Follow-Up Due:</span> 
                        Applied to <b>${n.company}</b> (${n.role}) 5+ days ago without response.
                    </div>
                    <button class="btn-primary compact" onclick="selectJobAndNudge('${n.id}')">Run ATS</button>
                </div>
            `).join('');
        } else {
            nudgeContainer.innerHTML = '';
        }
    }

    const stages = [
        { name: "Applied", key: "Applied", color: "var(--accent-indigo)" },
        { name: "Interviewing", key: "Interviewing", color: "var(--accent-amber)" },
        { name: "Offered", key: "Offered", color: "var(--accent-teal)" },
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
                        <select onchange="changeJobStage('${j.id}', this.value)" class="form-select mini">
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
                    <div class="kanban-header" style="color: ${stage.color};">
                        <span>${stage.name}</span>
                        <span class="mono-data">${stageJobs.length}</span>
                    </div>
                    ${cards || '<p class="empty-col-text">No entries</p>'}
                </div>
            `;
        }).join('');
    }
}

function selectJobAndNudge(id) {
    const target = jobs.find(j => j.id === id);
    if (target) {
        document.getElementById('targetJobRole').value = target.role;
        document.getElementById('targetJobCompany').value = target.company;
        document.getElementById('jobDesc').value = target.jd;
        const step2 = document.getElementById('step-2');
        if (step2) step2.scrollIntoView({ behavior: 'smooth' });
        runATSExecution();
    }
}

// 1-Click ATS Execution
async function runATSExecution() {
    const role = document.getElementById('targetJobRole').value.trim() || "Target Role";
    const company = document.getElementById('targetJobCompany').value.trim() || "Target Company";
    const jd = document.getElementById('jobDesc').value.trim();
    const resume = document.getElementById('userResume').value.trim();
    const resultBox = document.getElementById('atsResultWindow');

    if (!jd || jd.length < 10) {
        alert("Please paste the target Job Description in Step 1.");
        document.getElementById('step-1').scrollIntoView({ behavior: 'smooth' });
        return;
    }

    if (!resume || resume.length < 10) {
        alert("Please paste or upload your resume in Step 2.");
        document.getElementById('step-2').scrollIntoView({ behavior: 'smooth' });
        return;
    }

    resultBox.innerHTML = "<p class='text-indigo'>Evaluating candidate alignment with Gemini 3.6 Flash...</p>";
    document.getElementById('step-3').scrollIntoView({ behavior: 'smooth' });

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
            resultBox.innerHTML = `<p class='text-coral'>Evaluation Error: ${data.detail || "Unable to complete request."}</p>`;
        }
    } catch (err) {
        resultBox.innerHTML = "<p class='text-coral'>Connection error. Ensure the server is online.</p>";
    }
}

// Sequence Reveal Scroll Observer
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.reveal-card').forEach(card => observer.observe(card));
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserData();
    updateAuthUI();
    renderDashboard();
    initScrollAnimations();
});
