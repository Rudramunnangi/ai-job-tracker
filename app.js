let currentUser = JSON.parse(localStorage.getItem('nexjob_active_user')) || null;
let userProfile = JSON.parse(localStorage.getItem('nexjob_active_profile')) || null;
let authToken = localStorage.getItem('nexjob_auth_token') || null;
let jobs = [];

let activeSignupIdentifier = "";
let activeForgotIdentifier = "";
let signupCountdownInterval = null;
let forgotCountdownInterval = null;

function getAuthHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken || ''}`
    };
}

function toggleDrawer() {
    const drawer = document.getElementById('profileDrawer');
    const scrim = document.getElementById('drawerScrim');
    if (drawer && scrim) {
        drawer.classList.toggle('open');
        scrim.classList.toggle('active');
    }
}

function togglePasswordVisibility(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.type = field.type === 'password' ? 'text' : 'password';
    }
}

// Branded Logo Loading Spinner Generator
function getBrandedBufferingHTML(statusText = "Evaluating candidate alignment with AI...") {
    return `
        <div class="buffering-container">
            <svg class="buffering-logo-spinner" viewBox="0 0 100 100">
                <defs>
                    <linearGradient id="spinG" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#6366F1"/>
                        <stop offset="100%" stop-color="#14B8A6"/>
                    </linearGradient>
                </defs>
                <rect width="100" height="100" rx="24" fill="#151A26"/>
                <path d="M30 70V30L70 70V30" stroke="url(#spinG)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                <circle cx="70" cy="30" r="6" fill="#2DD4BF"/>
            </svg>
            <span class="buffering-text">${statusText}</span>
        </div>
    `;
}

// 60-Second Cooldown Timers
function startSignupTimer() {
    let timeLeft = 60;
    const countEl = document.getElementById('signupTimerCount');
    const noticeEl = document.getElementById('signupTimerNotice');
    const resendBtn = document.getElementById('btnResendSignupCode');

    if (noticeEl) noticeEl.style.display = 'inline';
    if (resendBtn) resendBtn.style.display = 'none';
    if (countEl) countEl.innerText = timeLeft;

    if (signupCountdownInterval) clearInterval(signupCountdownInterval);
    signupCountdownInterval = setInterval(() => {
        timeLeft--;
        if (countEl) countEl.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(signupCountdownInterval);
            if (noticeEl) noticeEl.style.display = 'none';
            if (resendBtn) resendBtn.style.display = 'inline';
        }
    }, 1000);
}

function startForgotTimer() {
    let timeLeft = 60;
    const countEl = document.getElementById('forgotTimerCount');
    const noticeEl = document.getElementById('forgotTimerNotice');
    const resendBtn = document.getElementById('btnResendForgotCode');

    if (noticeEl) noticeEl.style.display = 'inline';
    if (resendBtn) resendBtn.style.display = 'none';
    if (countEl) countEl.innerText = timeLeft;

    if (forgotCountdownInterval) clearInterval(forgotCountdownInterval);
    forgotCountdownInterval = setInterval(() => {
        timeLeft--;
        if (countEl) countEl.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(forgotCountdownInterval);
            if (noticeEl) noticeEl.style.display = 'none';
            if (resendBtn) resendBtn.style.display = 'inline';
        }
    }, 1000);
}

// Authentication Modal View Switcher
function switchAuthView(viewName) {
    clearAuthError();
    const views = ['Login', 'SignupStep1', 'SignupStep2', 'ForgotStep1', 'ForgotStep2'];
    views.forEach(v => {
        const el = document.getElementById(`authView${v}`);
        if (el) el.style.display = 'none';
    });

    const titleEl = document.getElementById('authModalTitle');
    if (viewName === 'login') {
        const view = document.getElementById('authViewLogin');
        if (view) view.style.display = 'block';
        if (titleEl) titleEl.innerText = "Sign In";
        initGoogleAuth();
    } else if (viewName === 'signup_step1') {
        const view = document.getElementById('authViewSignupStep1');
        if (view) view.style.display = 'block';
        if (titleEl) titleEl.innerText = "Create Account";
    } else if (viewName === 'signup_step2') {
        const view = document.getElementById('authViewSignupStep2');
        if (view) view.style.display = 'block';
        if (titleEl) titleEl.innerText = "Verify Email OTP";
        startSignupTimer();
    } else if (viewName === 'forgot') {
        const view = document.getElementById('authViewForgotStep1');
        if (view) view.style.display = 'block';
        if (titleEl) titleEl.innerText = "Reset Password";
    } else if (viewName === 'forgot_step2') {
        const view = document.getElementById('authViewForgotStep2');
        if (view) view.style.display = 'block';
        if (titleEl) titleEl.innerText = "Enter Reset OTP";
        startForgotTimer();
    }
}

function openAuthModal(defaultView = 'login') {
    switchAuthView(defaultView);
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'flex';
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'none';
}

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

// 1. Submit Login (Email or Username)
async function submitLogin() {
    clearAuthError();
    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!identifier || !password) {
        showAuthError("Please enter your email/username and password.");
        return;
    }

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();

        if (!res.ok) {
            showAuthError(data.detail || "Invalid login credentials.");
            return;
        }

        currentUser = { email: data.email };
        authToken = data.token;
        userProfile = data.profile;

        localStorage.setItem('nexjob_active_user', JSON.stringify(currentUser));
        localStorage.setItem('nexjob_auth_token', authToken);
        localStorage.setItem('nexjob_active_profile', JSON.stringify(userProfile));

        closeAuthModal();
        await loadUserData();
        updateAuthUI();
        renderDashboard();
    } catch (err) {
        showAuthError(`Server connection error: ${err.message}`);
    }
}

// 2. Signup Flow: Request OTP via Email
async function requestSignupOTP() {
    clearAuthError();
    const idInput = document.getElementById('signupIdentifier');
    const idVal = idInput ? idInput.value.trim() : "";

    if (!idVal || !idVal.includes('@')) {
        showAuthError("Please provide a valid email address.");
        return;
    }

    const btn = document.getElementById('btnSendSignupCode');
    if (btn) btn.innerText = "Dispatching Code...";

    try {
        const res = await fetch("/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: idVal, identifier: idVal, purpose: "signup" })
        });
        const data = await res.json();

        if (btn) btn.innerText = "Send Verification Code";

        if (!res.ok) {
            showAuthError(data.detail || "Unable to send verification code.");
            return;
        }

        activeSignupIdentifier = idVal;
        const promptEl = document.getElementById('signupOtpPrompt');
        if (promptEl) {
            promptEl.innerText = `Verification code sent to ${idVal}:`;
        }
        switchAuthView('signup_step2');
    } catch (e) {
        if (btn) btn.innerText = "Send Verification Code";
        showAuthError("Connection error while requesting OTP.");
    }
}

async function resendSignupCode() {
    if (!activeSignupIdentifier) return;
    try {
        await fetch("/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: activeSignupIdentifier, identifier: activeSignupIdentifier, purpose: "signup" })
        });
        startSignupTimer();
    } catch (e) {
        showAuthError("Failed to resend verification code.");
    }
}

// 3. Signup Flow: Verify OTP & Create Account
async function submitSignupVerification() {
    clearAuthError();
    const otp = document.getElementById('signupOtpCode').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const fullName = document.getElementById('signupFullName').value.trim();
    const password = document.getElementById('signupPassword').value.trim();

    if (!otp || !username || !password) {
        showAuthError("Please fill in the OTP code, username, and password.");
        return;
    }

    try {
        const res = await fetch("/api/auth/signup-verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: activeSignupIdentifier,
                identifier: activeSignupIdentifier,
                otp: otp,
                username: username,
                password: password,
                full_name: fullName
            })
        });
        const data = await res.json();

        if (!res.ok) {
            showAuthError(data.detail || "OTP verification failed.");
            return;
        }

        currentUser = { email: data.email };
        authToken = data.token;
        userProfile = data.profile;

        localStorage.setItem('nexjob_active_user', JSON.stringify(currentUser));
        localStorage.setItem('nexjob_auth_token', authToken);
        localStorage.setItem('nexjob_active_profile', JSON.stringify(userProfile));

        closeAuthModal();
        await loadUserData();
        updateAuthUI();
        renderDashboard();
    } catch (e) {
        showAuthError("Error completing registration.");
    }
}

// 4. Forgot Password Flow
async function requestForgotOTP() {
    clearAuthError();
    const idInput = document.getElementById('forgotIdentifier');
    const idVal = idInput ? idInput.value.trim() : "";

    if (!idVal || !idVal.includes('@')) {
        showAuthError("Please enter your registered email address.");
        return;
    }

    try {
        const res = await fetch("/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: idVal, identifier: idVal, purpose: "forgot_password" })
        });
        const data = await res.json();

        if (!res.ok) {
            showAuthError(data.detail || "Failed to dispatch reset code.");
            return;
        }

        activeForgotIdentifier = idVal;
        switchAuthView('forgot_step2');
    } catch (e) {
        showAuthError("Connection error while requesting reset code.");
    }
}

async function resendForgotCode() {
    if (!activeForgotIdentifier) return;
    try {
        await fetch("/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: activeForgotIdentifier, identifier: activeForgotIdentifier, purpose: "forgot_password" })
        });
        startForgotTimer();
    } catch (e) {
        showAuthError("Failed to resend reset code.");
    }
}

// 5. Verify Reset OTP & Reset Password
async function submitPasswordReset() {
    clearAuthError();
    const otp = document.getElementById('forgotOtpCode').value.trim();
    const newPassword = document.getElementById('forgotNewPassword').value.trim();

    if (!otp || !newPassword) {
        showAuthError("Please provide the OTP code and your new password.");
        return;
    }

    try {
        const res = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: activeForgotIdentifier,
                identifier: activeForgotIdentifier,
                otp: otp,
                new_password: newPassword
            })
        });
        const data = await res.json();

        if (!res.ok) {
            showAuthError(data.detail || "Password reset failed.");
            return;
        }

        alert("Password updated successfully! Please log in with your new credentials.");
        switchAuthView('login');
    } catch (e) {
        showAuthError("Error updating password.");
    }
}

// Google OAuth Trigger
function triggerGoogleSignIn() {
    const hiddenWrap = document.getElementById('googleHiddenRenderWrapper');
    if (hiddenWrap && hiddenWrap.querySelector('div[role="button"]')) {
        hiddenWrap.querySelector('div[role="button"]').click();
    } else {
        initGoogleAuth();
        setTimeout(() => {
            if (hiddenWrap && hiddenWrap.querySelector('div[role="button"]')) {
                hiddenWrap.querySelector('div[role="button"]').click();
            }
        }, 500);
    }
}

function initGoogleAuth() {
    const wrapper = document.getElementById('googleHiddenRenderWrapper');
    if (window.google && wrapper && wrapper.children.length === 0) {
        google.accounts.id.initialize({
            client_id: "367560024253-20ebmeiedvdammukrcplc5uh2orqedpl.apps.googleusercontent.com",
            callback: handleGoogleResponse
        });
        google.accounts.id.renderButton(wrapper, {
            theme: "outline", size: "large", type: "standard"
        });
    }
}

async function handleGoogleResponse(response) {
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
        authToken = data.token;
        userProfile = data.profile;
        localStorage.setItem('nexjob_active_user', JSON.stringify(currentUser));
        localStorage.setItem('nexjob_auth_token', authToken);
        localStorage.setItem('nexjob_active_profile', JSON.stringify(userProfile));

        closeAuthModal();
        await loadUserData();
        updateAuthUI();
        renderDashboard();
    } catch (err) {
        showAuthError(`Network error during Google sign-in: ${err.message}`);
    }
}

function logoutUser() {
    localStorage.removeItem('nexjob_active_user');
    localStorage.removeItem('nexjob_active_profile');
    localStorage.removeItem('nexjob_auth_token');
    currentUser = null;
    userProfile = null;
    authToken = null;
    jobs = [];
    updateAuthUI();
    renderDashboard();
}

async function loadUserData() {
    if (currentUser && authToken) {
        try {
            const res = await fetch("/api/jobs", { headers: getAuthHeaders() });
            if (res.status === 401) {
                logoutUser();
                return;
            }
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

async function uploadResumePDF() {
    if (!currentUser || !authToken) {
        alert("Please sign in to upload and parse PDF resumes.");
        openAuthModal('login');
        return;
    }

    const fileInput = document.getElementById('pdfFileInput');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert("Please choose a PDF file first.");
        return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    const resultBox = document.getElementById('atsResultWindow');
    resultBox.innerHTML = getBrandedBufferingHTML("Parsing and analyzing PDF resume securely...");

    try {
        const res = await fetch("/api/resume/upload-pdf", {
            method: "POST",
            headers: { "Authorization": `Bearer ${authToken}` },
            body: formData
        });
        const data = await res.json();

        if (res.ok) {
            if (!userProfile) userProfile = {};
            userProfile.resume = data.extracted_text;
            localStorage.setItem('nexjob_active_profile', JSON.stringify(userProfile));

            document.getElementById('userResume').value = userProfile.resume;
            document.getElementById('profResume').value = userProfile.resume;
            resultBox.innerHTML = "<p style='color: var(--accent-teal); text-align: center;'>Resume successfully parsed and synced with your profile.</p>";
            alert("Resume PDF successfully parsed and synced!");
        } else {
            resultBox.innerHTML = `<p style='color: var(--accent-coral); text-align: center;'>Upload Error: ${data.detail}</p>`;
            alert(data.detail);
        }
    } catch (err) {
        resultBox.innerHTML = "<p style='color: var(--accent-coral); text-align: center;'>Connection error during PDF parsing.</p>";
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    const nameEl = document.getElementById('selectedFileName');
    if (file && nameEl) {
        nameEl.innerText = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        nameEl.style.color = "var(--accent-teal)";
    }
}

// Profile Modal Handlers
function openProfileModal() {
    if (!currentUser || !authToken) {
        openAuthModal('login');
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
    if (!currentUser || !authToken) return;

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
        const res = await fetch("/api/profile/save", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                full_name: userProfile.fullName,
                target_role: userProfile.targetRole,
                skills: userProfile.skills,
                resume: userProfile.resume,
                linkedin_url: userProfile.linkedin,
                github_url: userProfile.github,
                portfolio_url: ""
            })
        });
        if (res.ok) {
            localStorage.setItem('nexjob_active_profile', JSON.stringify(userProfile));
            const resumeBox = document.getElementById('userResume');
            if (resumeBox) resumeBox.value = userProfile.resume;
            closeProfileModal();
            updateAuthUI();
            alert("Career profile saved successfully!");
        }
    } catch (e) {
        alert("Error saving profile.");
    }
}

async function deleteAccount() {
    if (!currentUser || !authToken) return;
    if (!confirm("Are you sure you want to permanently delete your account and all tracked records?")) return;

    try {
        await fetch("/api/account/delete", { method: "DELETE", headers: getAuthHeaders() });
        logoutUser();
        alert("Your account has been deleted.");
    } catch (e) {
        alert("Error deleting account.");
    }
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
    const jobSelectionControl = document.getElementById('jobSelectionControl');

    if (currentUser && currentUser.email && authToken) {
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
        if (jobSelectionControl) jobSelectionControl.style.display = 'block';
    } else {
        if (guestTop) guestTop.style.display = 'flex';
        if (userTop) userTop.style.display = 'none';

        if (drawerGuestActions) drawerGuestActions.style.display = 'block';
        if (drawerMemberActions) drawerMemberActions.style.display = 'none';
        if (drawerAvatar) drawerAvatar.innerText = 'U';
        if (drawerUserName) drawerUserName.innerText = 'User Account';
        if (drawerUserEmail) drawerUserEmail.innerText = 'Not signed in';

        if (memberPipeline) memberPipeline.style.display = 'none';
        if (resumeVaultBox) resumeVaultBox.style.display = 'none';
        if (jobSelectionControl) jobSelectionControl.style.display = 'none';
    }

    updateDynamicJobLinks();
}

function updateDynamicJobLinks(customRole = null) {
    const role = customRole || (userProfile && userProfile.targetRole) || (document.getElementById('targetJobRole') && document.getElementById('targetJobRole').value) || "AI Software Engineer";
    const encodedRole = encodeURIComponent(role.trim());

    const lnk = document.getElementById('footerLinkedInLink');
    if (lnk) lnk.href = `https://www.linkedin.com/jobs/search/?keywords=${encodedRole}&f_TPR=r86400`;

    const ind = document.getElementById('footerIndeedLink');
    if (ind) ind.href = `https://www.indeed.com/jobs?q=${encodedRole}&sort=date`;

    const ggl = document.getElementById('footerGoogleLink');
    if (ggl) ggl.href = `https://www.google.com/search?q=${encodedRole}+jobs&ibp=htl;jobs`;
}

// Application Board Handlers
function openJobModal() {
    if (!currentUser || !authToken) {
        alert("Please log in to track applications on your board.");
        openAuthModal('login');
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
        company: company,
        role: role,
        date: date,
        status: status,
        tags: tags,
        jd: jd || "No Job Description provided."
    };

    try {
        const res = await fetch("/api/jobs/save", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(newJob)
        });

        if (res.ok) {
            jobs.unshift(newJob);
            renderDashboard();
            closeJobModal();
            document.getElementById('modalCompany').value = '';
            document.getElementById('modalRole').value = '';
            document.getElementById('modalTags').value = '';
            document.getElementById('modalJD').value = '';
        }
    } catch (e) {
        alert("Failed to save application.");
    }
}

async function changeJobStage(id, newStatus) {
    const target = jobs.find(j => j.id === id);
    if (target) {
        target.status = newStatus;
        await fetch("/api/jobs/update_status", {
            method: "POST",
            headers: getAuthHeaders(),
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

    const selector = document.getElementById('roleSelector');
    if (selector) {
        if (jobs.length > 0) {
            selector.innerHTML = jobs.map(j => `<option value="${j.id}">${j.company} — ${j.role}</option>`).join('');
        } else {
            selector.innerHTML = `<option value="">No applications logged yet</option>`;
        }
    }

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

    const pipelineGrid = document.getElementById('pipelineGrid');
    if (pipelineGrid) {
        pipelineGrid.innerHTML = stages.map(stage => {
            const stageJobs = jobs.filter(j => j.status === stage.key);
            const cards = stageJobs.map(j => `
                <div class="pipeline-card">
                    <div class="pipeline-role">${j.role}</div>
                    <div class="pipeline-comp">${j.company}</div>
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
                <div class="pipeline-col">
                    <div class="pipeline-header" style="color: ${stage.color};">
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
        const selector = document.getElementById('roleSelector');
        if (selector) selector.value = id;
        document.getElementById('step-2').scrollIntoView({ behavior: 'smooth' });
        runATSExecution();
    }
}

function onTrackedJobChange() {
    const selector = document.getElementById('roleSelector');
    if (!selector || !selector.value) return;
    const selectedJob = jobs.find(j => j.id === selector.value);
    if (selectedJob) {
        document.getElementById('targetJobRole').value = selectedJob.role;
        document.getElementById('targetJobCompany').value = selectedJob.company;
        document.getElementById('jobDesc').value = selectedJob.jd;
    }
}

async function runATSExecution() {
    const role = document.getElementById('targetJobRole').value.trim() || "Target Role";
    const company = document.getElementById('targetJobCompany').value.trim() || "Target Company";
    const jd = document.getElementById('jobDesc').value.trim();
    const resume = document.getElementById('userResume').value.trim();
    const resultBox = document.getElementById('atsResultWindow');

    if (!jd || jd.length < 10) {
        alert("Please paste the target Job Description in Step 01.");
        document.getElementById('step-1').scrollIntoView({ behavior: 'smooth' });
        return;
    }

    if (!resume || resume.length < 10) {
        alert("Please paste or upload your resume in Step 02.");
        document.getElementById('step-2').scrollIntoView({ behavior: 'smooth' });
        return;
    }

    resultBox.innerHTML = getBrandedBufferingHTML("Evaluating candidate alignment with AI...");
    document.getElementById('step-3').scrollIntoView({ behavior: 'smooth' });

    const fillLine = document.getElementById('activeProgressLine');
    if (fillLine) fillLine.style.height = '100%';

    const isGuest = (!currentUser || !currentUser.email || !authToken);

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
            updateDynamicJobLinks(role);
        } else {
            resultBox.innerHTML = `<p style="color: var(--accent-coral); text-align: center;">Evaluation Error: ${data.detail || "Unable to complete request."}</p>`;
        }
    } catch (err) {
        resultBox.innerHTML = '<p style="color: var(--accent-coral); text-align: center;">Connection error. Ensure the server is online.</p>';
    }
}

function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                const fillLine = document.getElementById('activeProgressLine');
                if (fillLine) {
                    if (entry.target.id === 'step-1') fillLine.style.height = '33%';
                    else if (entry.target.id === 'step-2') fillLine.style.height = '66%';
                    else if (entry.target.id === 'step-3') fillLine.style.height = '100%';
                }
            }
        });
    }, { threshold: 0.2 });

    document.querySelectorAll('.reveal-card').forEach(card => observer.observe(card));
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserData();
    updateAuthUI();
    renderDashboard();
    initScrollAnimations();
});

// Interactive Dynamic Background Mouse Follower
window.addEventListener('mousemove', (e) => {
    const orb1 = document.querySelector('.orb-1');
    const orb2 = document.querySelector('.orb-2');
    if (orb1 && orb2) {
        const moveX = (e.clientX / window.innerWidth - 0.5) * 30;
        const moveY = (e.clientY / window.innerHeight - 0.5) * 30;
        orb1.style.transform = `translate(${moveX}px, ${moveY}px)`;
        orb2.style.transform = `translate(${-moveX}px, ${-moveY}px)`;
    }
});
