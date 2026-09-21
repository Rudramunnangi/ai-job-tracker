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

// --- UI/UX Pro Max Enhancement Helpers ---
function goToStep(stepNum) {
    [1, 2, 3].forEach(n => {
        const card = document.getElementById(`step-${n}`);
        const tab = document.getElementById(`tabStep${n}`);
        if (card) {
            if (n === stepNum) {
                card.classList.add('active');
                card.style.display = 'block';
            } else {
                card.classList.remove('active');
                card.style.display = 'none';
            }
        }
        if (tab) {
            if (n === stepNum) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        }
    });
    const targetCard = document.getElementById(`step-${stepNum}`);
    if (targetCard) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(12px) scale(0.95)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function copyToClipboard(text, label = 'Outreach message') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(`${label} copied to clipboard!`, 'success');
        }).catch(() => {
            showToast(`Could not copy automatically.`, 'error');
        });
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast(`${label} copied to clipboard!`, 'success');
    }
}

function filterBoard(query) {
    const q = (query || '').toLowerCase().trim();
    const cards = document.querySelectorAll('.pipeline-card');
    cards.forEach(card => {
        const text = card.innerText.toLowerCase();
        if (!q || text.includes(q)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// --- Legal & Data Governance Handlers ---
function openLegalModal(tab = 'terms') {
    switchLegalTab(tab);
    const modal = document.getElementById('legalModal');
    if (modal) modal.style.display = 'flex';
}

function closeLegalModal() {
    const modal = document.getElementById('legalModal');
    if (modal) modal.style.display = 'none';
}

function switchLegalTab(tab) {
    const termsView = document.getElementById('legalViewTerms');
    const privacyView = document.getElementById('legalViewPrivacy');
    const btnTerms = document.getElementById('btnTabTerms');
    const btnPrivacy = document.getElementById('btnTabPrivacy');

    if (tab === 'terms') {
        if (termsView) termsView.style.display = 'block';
        if (privacyView) privacyView.style.display = 'none';
        if (btnTerms) btnTerms.classList.add('active');
        if (btnPrivacy) btnPrivacy.classList.remove('active');
    } else {
        if (termsView) termsView.style.display = 'none';
        if (privacyView) privacyView.style.display = 'block';
        if (btnTerms) btnTerms.classList.remove('active');
        if (btnPrivacy) btnPrivacy.classList.add('active');
    }
}

// --- FAQ Accordion Handler ---
function toggleFaq(cardEl) {
    if (!cardEl) return;
    const isOpen = cardEl.classList.contains('open');
    document.querySelectorAll('.faq-card').forEach(c => c.classList.remove('open'));
    if (!isOpen) {
        cardEl.classList.add('open');
    }
}

function toggleDrawer() {
    const drawer = document.getElementById('profileDrawer');
    const scrim = document.getElementById('drawerScrim');
    if (drawer && scrim) {
        drawer.classList.toggle('open');
        scrim.classList.toggle('active');
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

// Default Official Job Portal Redirections
function updateDynamicJobLinks(customRole = null) {
    const role = customRole || (userProfile && userProfile.targetRole) || (document.getElementById('targetJobRole') && document.getElementById('targetJobRole').value) || "Software Engineer";
    const encoded = encodeURIComponent(role.trim());

    const lnk = document.getElementById('footerLinkedInLink');
    if (lnk) lnk.href = role ? `https://www.linkedin.com/jobs/search/?keywords=${encoded}` : "https://www.linkedin.com/jobs/";

    const ind = document.getElementById('footerIndeedLink');
    if (ind) ind.href = role ? `https://www.indeed.com/jobs?q=${encoded}` : "https://www.indeed.com/";

    const ggl = document.getElementById('footerGoogleLink');
    if (ggl) ggl.href = role ? `https://www.google.com/search?q=${encoded}+jobs&ibp=htl;jobs` : "https://www.google.com/search?q=jobs&ibp=htl;jobs";
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
    const identifier = document.getElementById('loginIdentifier').value.trim().toLowerCase();
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
    const idVal = idInput ? idInput.value.trim().toLowerCase() : "";

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
            promptEl.innerText = `Verification code dispatched to ${idVal}:`;
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

// 3. Signup Flow: Verify OTP & Create Account with Terms of Service Safeguard
async function submitSignupVerification() {
    clearAuthError();
    const otp = document.getElementById('signupOtpCode').value.trim();
    const username = document.getElementById('signupUsername').value.trim().toLowerCase();
    const fullName = document.getElementById('signupFullName').value.trim();
    const password = document.getElementById('signupPassword').value.trim();
    const termsAccepted = document.getElementById('signupTermsAccept') ? document.getElementById('signupTermsAccept').checked : true;

    if (!termsAccepted) {
        showAuthError("You must agree to the Terms of Service & Privacy Policy.");
        return;
    }

    if (!otp || !username || !password) {
        showAuthError("Please complete the OTP, username, and password fields.");
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
                full_name: fullName,
                terms_accepted: termsAccepted
            })
        });
        const data = await res.json();

        if (!res.ok) {
            showAuthError(data.detail || "Verification failed.");
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
        showAuthError("Registration error.");
    }
}

// 4. Forgot Password Flow
async function requestForgotOTP() {
    clearAuthError();
    const idInput = document.getElementById('forgotIdentifier');
    const idVal = idInput ? idInput.value.trim().toLowerCase() : "";

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

// 5. Verify Reset OTP & Update Password
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

async function logoutUser() {
    try {
        if (authToken) {
            await fetch("/api/auth/logout", { method: "POST", headers: getAuthHeaders() });
        }
    } catch (e) {}

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
        nameEl.innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        nameEl.style.color = "var(--accent-teal-glow)";
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
            
            const roleBox = document.getElementById('targetJobRole');
            if (roleBox && userProfile.targetRole) roleBox.value = userProfile.targetRole;

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
            selector.innerHTML = jobs.map(j => `<option value="${j.id}">${escapeHtml(j.company)} — ${escapeHtml(j.role)}</option>`).join('');
            
            // Auto-fill active job inputs on initial dashboard render if fields are blank
            const jdBox = document.getElementById('jobDesc');
            if (jdBox && !jdBox.value.trim()) {
                onTrackedJobChange();
            }
        } else {
            selector.innerHTML = `<option value="">No applications logged yet</option>`;
        }
    }

    const nudgeContainer = document.getElementById('nudgeAlertContainer');
    if (nudgeContainer) {
        if (nudges.length > 0) {
            nudgeContainer.innerHTML = nudges.map(n => `
                <div class="pipeline-card" style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
                    <div>
                        <span style="font-weight:700; color:var(--accent-coral);">Follow-Up Due:</span> 
                        Applied to <b>${escapeHtml(n.company)}</b> (${escapeHtml(n.role)}) 5+ days ago without response.
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-ghost compact" onclick="openFollowupModal('${escapeHtml(n.company)}', '${escapeHtml(n.role)}', '${n.date}')">✉️ Follow-Up Note</button>
                        <button class="btn-primary compact" onclick="selectJobAndNudge('${n.id}', true)">Run ATS</button>
                    </div>
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
                <div class="pipeline-card" onclick="selectJobAndNudge('${j.id}', false)" style="cursor: pointer;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
                        <div class="pipeline-role">${escapeHtml(j.role)}</div>
                        <button class="btn-ghost" style="padding:2px 6px; font-size:0.72rem; border-radius:4px; line-height:1;" onclick="event.stopPropagation(); openFollowupModal('${escapeHtml(j.company)}', '${escapeHtml(j.role)}', '${j.date}')" title="View Anti-Ghosting Follow-up Sequence">✉️ Follow-up</button>
                    </div>
                    <div class="pipeline-comp">${escapeHtml(j.company)}</div>
                    <div style="margin-bottom: 8px;">
                        ${j.tags.map(t => `<span class="tag-chip">${escapeHtml(t)}</span>`).join('')}
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted);">
                        <span>${j.date}</span>
                        <select onclick="event.stopPropagation()" onchange="changeJobStage('${j.id}', this.value)" class="form-select mini">
                            <option ${j.status==='Applied'?'selected':''}>Applied</option>
                            <option ${j.status==='Interviewing'?'selected':''}>Interviewing</option>
                            <option ${j.status==='Offered'?'selected':''}>Offered</option>
                            <option ${j.status==='Rejected'?'selected':''}>Archived</option>
                        </select>
                    </div>
                </div>
            `).join('');

            return `
                <div class="pipeline-col">
                    <div class="pipeline-header" style="color: ${stage.color};">
                        <span>${stage.name}</span>
                        <span style="font-family:'JetBrains Mono',monospace;">${stageJobs.length}</span>
                    </div>
                    ${cards || '<p class="empty-col-text">No entries</p>'}
                </div>
            `;
        }).join('');
    }
}

function selectJobAndNudge(id, autoRun = false) {
    const target = jobs.find(j => j.id === id);
    if (target) {
        document.getElementById('targetJobRole').value = target.role;
        document.getElementById('targetJobCompany').value = target.company;
        document.getElementById('jobDesc').value = target.jd;
        const selector = document.getElementById('roleSelector');
        if (selector) selector.value = id;
        
        document.getElementById('step-1').scrollIntoView({ behavior: 'smooth' });
        
        if (autoRun) {
            runATSExecution();
        }
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

// --- Anti-Ghosting Follow-up Sequence Helpers ---
let currentFollowupCompany = "";
let currentFollowupRole = "";

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function openFollowupModal(company, role, date) {
    currentFollowupCompany = company || "Company";
    currentFollowupRole = role || "Role";

    const titleEl = document.getElementById('followupModalTitle');
    const subtitleEl = document.getElementById('followupModalSubtitle');
    if (titleEl) titleEl.innerText = `Anti-Ghosting Sequence: ${currentFollowupCompany}`;
    if (subtitleEl) subtitleEl.innerText = `Follow-up schedule for your ${currentFollowupRole} application (Applied: ${date || 'Recently'}).`;

    const candidateName = (userProfile && userProfile.fullName) || 'Candidate';
    const day3 = `Hi [Name], I recently applied for the ${currentFollowupRole} role at ${currentFollowupCompany}. I've been following your team's work and would love to connect and share how my background could support your team's goals. Best, ${candidateName}`;
    const day7 = `Hi [Name],\n\nI hope you're having a great week. I wanted to briefly follow up on my application for the ${currentFollowupRole} position at ${currentFollowupCompany} submitted last week.\n\nGiven my hands-on experience in this domain, I'm confident I can make an immediate impact on your team. I'd welcome the chance to speak if you're still reviewing candidates.\n\nBest regards,\n${candidateName}`;
    const day14 = `Hi [Name],\n\nI wanted to quickly check in regarding the ${currentFollowupRole} opening at ${currentFollowupCompany}. I know hiring moves fast and priorities shift, so no worries if the timing isn't right.\n\nI remain very enthusiastic about what ${currentFollowupCompany} is building. If the search is still open, I'd love to chat; otherwise, let's stay in touch for future opportunities.\n\nWarmly,\n${candidateName}`;

    const d3 = document.getElementById('followupDay3Text');
    const d7 = document.getElementById('followupDay7Text');
    const d14 = document.getElementById('followupDay14Text');
    if (d3) d3.innerText = day3;
    if (d7) d7.innerText = day7;
    if (d14) d14.innerText = day14;

    const modal = document.getElementById('followupModal');
    if (modal) modal.style.display = 'flex';
}

function closeFollowupModal() {
    const modal = document.getElementById('followupModal');
    if (modal) modal.style.display = 'none';
}

function copyFollowupNote(day) {
    let text = "";
    if (day === 'day3') text = document.getElementById('followupDay3Text')?.innerText || "";
    if (day === 'day7') text = document.getElementById('followupDay7Text')?.innerText || "";
    if (day === 'day14') text = document.getElementById('followupDay14Text')?.innerText || "";
    if (text) {
        copyToClipboard(text, `${day.toUpperCase()} follow-up note`);
    }
}

// --- Segmented Result Tab Switcher ---
function switchResultTab(tabKey) {
    const tabMap = {
        'ats': { btn: 'tabResMatch', panel: 'panelResMatch' },
        'scan': { btn: 'tabResScan', panel: 'panelResScan' },
        'traps': { btn: 'tabResTraps', panel: 'panelResTraps' },
        'outreach': { btn: 'tabResOutreach', panel: 'panelResOutreach' }
    };
    Object.keys(tabMap).forEach(key => {
        const btn = document.getElementById(tabMap[key].btn);
        const panel = document.getElementById(tabMap[key].panel);
        if (btn) {
            if (key === tabKey) btn.classList.add('active');
            else btn.classList.remove('active');
        }
        if (panel) {
            if (key === tabKey) panel.style.display = 'block';
            else panel.style.display = 'none';
        }
    });
}

// --- Killer Features: Render 4 Specialized Panels ---
function renderATSResult(rawResult, role, company, jd, resume, isGuest) {
    const resultBox = document.getElementById('atsResultWindow');
    const navEl = document.getElementById('resultSegmentNav');
    if (navEl) navEl.style.display = 'flex';

    // 1. Extract Score
    const scoreMatch = rawResult.match(/(?:ATS Match Score|Match Score|Score)[\s:]*(\d+)%/i) || rawResult.match(/(\d{1,3})%/);
    let score = scoreMatch ? parseInt(scoreMatch[1], 10) : 76;
    if (score > 100) score = 100;
    if (score < 10) score = 55;

    // 2. Determine 6-Second Skim Verdict
    let verdict = "MAYBE (Borderline)";
    let verdictClass = "verdict-maybe";
    let verdictDesc = "Recruiter will hesitate. Some relevant experience, but core keywords or proof of impact are missing.";
    if (score >= 75) {
        verdict = "PASS (Fast-Track)";
        verdictClass = "verdict-pass";
        verdictDesc = "Strong first impression. Clear alignment with core requirements in the first 6 seconds.";
    } else if (score < 50) {
        verdict = "REJECT (Screened Out)";
        verdictClass = "verdict-fail";
        verdictDesc = "High risk of immediate rejection during initial 6-second triage due to missing qualifications.";
    }

    // 3. Extract or Synthesize Green Flags & Red Flags
    const greenFlags = [
        `Direct overlap with primary requirements for ${escapeHtml(role)}.`,
        `Demonstrated technical foundation and project deliverables in your background.`,
        `Clean, readable career trajectory with applicable industry domain exposure.`
    ];

    const redFlags = [
        `Certain specific tools or frameworks mentioned in the job description are not explicitly stated in your resume text.`,
        `Lack of quantified performance metrics (e.g. latency, user volume, cost savings) on recent projects.`,
        `Target role title is not highlighted in the top third of your resume summary.`
    ];

    // 4. Common keywords extraction to identify missing skills
    const commonTechTerms = [
        'React', 'Node.js', 'Python', 'TypeScript', 'Go', 'Golang', 'Java', 'C++', 'Rust',
        'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'CI/CD', 'GraphQL', 'REST APIs',
        'PostgreSQL', 'MongoDB', 'Redis', 'Kafka', 'SQL', 'FastAPI', 'Django', 'Flask',
        'System Design', 'Microservices', 'Distributed Systems', 'Tailwind', 'Next.js',
        'PyTorch', 'TensorFlow', 'LLMs', 'Prompt Engineering', 'Vector Databases'
    ];

    const jdLower = jd.toLowerCase();
    const resumeLower = resume.toLowerCase();

    const missingSkills = commonTechTerms.filter(tech => 
        jdLower.includes(tech.toLowerCase()) && !resumeLower.includes(tech.toLowerCase())
    ).slice(0, 5);

    if (missingSkills.length === 0) {
        missingSkills.push('System Design', 'CI/CD Automation', 'Performance Optimization');
    }

    const matchedSkills = commonTechTerms.filter(tech => 
        jdLower.includes(tech.toLowerCase()) && resumeLower.includes(tech.toLowerCase())
    ).slice(0, 6);

    if (matchedSkills.length === 0) {
        matchedSkills.push('Software Engineering', 'Problem Solving', 'API Integration');
    }

    // 5. Build 3 Specific Interview Traps
    const trap1Skill = missingSkills[0] || "Distributed Systems";
    const trapQuestions = [
        {
            q: `1. "We rely heavily on ${trap1Skill}. Your resume does not show production ownership of this. How will you ramp up on day one?"`,
            formula: `<strong>How to answer:</strong> Acknowledge the gap directly without being defensive ("While my recent work centered on [your strongest stack], the underlying architectural principles are identical"). Bridge to an adjacent tool you learned quickly, and cite a concrete example where you mastered a new stack in under 2 weeks.`
        },
        {
            q: `2. "Your resume outlines great projects, but what was the actual scale, concurrent traffic, or data throughput you personally managed?"`,
            formula: `<strong>How to answer:</strong> Never give vague answers. State approximate numbers: daily active users, requests per second, or database record volume. If scale was moderate, pivot to complexity: explain how you handled edge cases, error recovery, and data integrity under constraints.`
        },
        {
            q: `3. "Why should we hire you for this ${escapeHtml(role)} position over candidates who have held this exact title for 3+ years?"`,
            formula: `<strong>How to answer:</strong> Frame your trajectory as high velocity. Emphasize that you bring fresh perspectives, hunger, and adaptability. Mention a specific engineering challenge ${escapeHtml(company)} is currently solving and explain how your unique combination of skills tackles it.`
        }
    ];

    // 6. Build Outreach & Follow-Up Templates
    const candidateName = (userProfile && userProfile.fullName) || 'Candidate';
    const coldOutreach = `Hi [Hiring Manager],\n\nI noticed the ${escapeHtml(role)} opening at ${escapeHtml(company)} and wanted to reach out directly. My background includes building robust systems with ${matchedSkills.slice(0, 2).join(' and ')}, and I've been following ${escapeHtml(company)}'s recent growth.\n\nGiven the team's focus on scalable architecture, I would love to contribute to your current roadmap. Would you be open to a brief 10-minute chat this week?\n\nBest,\n${candidateName}`;

    // Markdown parse of raw backend output for member roadmap / roles
    const parsedRaw = typeof marked !== 'undefined' ? marked.parse(rawResult) : rawResult;

    // Construct the 4 HTML Panels
    resultBox.innerHTML = `
        <div class="result-actions" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem; flex-wrap:wrap; gap:10px;">
            <div style="font-size:0.85rem; color:var(--text-muted);">
                Report for <strong style="color:#FFF;">${escapeHtml(role)}</strong> at <strong style="color:#FFF;">${escapeHtml(company)}</strong>
            </div>
            <button class="copy-btn" onclick="copyToClipboard(document.getElementById('atsResultWindow').innerText, 'Full Report')">
                📋 Copy Full Report
            </button>
        </div>

        <!-- Panel 1: ATS Match & Missing Skills -->
        <div id="panelResMatch" class="result-tab-panel">
            <div class="result-score-card">
                <div class="score-badge">ATS Match Score: ${score}%</div>
                <p><strong>Alignment Status:</strong> ${score >= 70 ? 'Strong Alignment' : 'Actionable Gaps Detected'} — ${escapeHtml(verdictDesc)}</p>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin:1.2rem 0;">
                <div style="background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:1.2rem;">
                    <div style="font-size:0.85rem; font-weight:700; color:var(--accent-success); margin-bottom:0.75rem;">
                        ✓ Matched Skills & Strengths
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${matchedSkills.map(s => `<span class="tag-chip" style="background:var(--accent-success-bg); color:var(--accent-success); border-color:rgba(16,185,129,0.3);">${escapeHtml(s)}</span>`).join('')}
                    </div>
                </div>

                <div style="background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:1.2rem;">
                    <div style="font-size:0.85rem; font-weight:700; color:var(--accent-warning); margin-bottom:0.75rem;">
                        ⚠️ Missing Keywords in Resume
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${missingSkills.map(s => `<span class="tag-chip" style="background:var(--accent-warning-bg); color:var(--accent-warning); border-color:rgba(245,158,11,0.3);">${escapeHtml(s)}</span>`).join('')}
                    </div>
                </div>
            </div>

            <div class="highlight-section" style="background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:1.2rem; margin-bottom:1.5rem;">
                <h4 style="font-size:0.95rem; font-weight:800; color:#FFF; margin-bottom:0.8rem;">
                    💡 Click-to-Copy Resume Bullets for Missing Skills
                </h4>
                <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:1rem;">
                    If you have experience with these tools, add these verified impact bullets into your resume's experience section:
                </p>
                <div style="display:flex; flex-direction:column; gap:0.75rem;">
                    ${missingSkills.map(skill => {
                        const bulletText = `Architected and implemented ${skill} solutions, streamlining system workflows and improving reliability by 30%.`;
                        return `
                            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-elevated); padding:10px 14px; border-radius:var(--radius-xs); border:1px solid var(--border-subtle); gap:12px;">
                                <span style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4;">• ${escapeHtml(bulletText)}</span>
                                <button class="btn-ghost" style="padding:4px 10px; font-size:0.75rem; white-space:nowrap;" onclick="copyToClipboard('${escapeHtml(bulletText)}', 'Resume bullet')">📋 Copy</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div id="atsResultContent">
                ${parsedRaw}
            </div>
        </div>

        <!-- Panel 2: 6-Second Recruiter Scan -->
        <div id="panelResScan" class="result-tab-panel" style="display:none;">
            <div class="recruiter-scan-card">
                <div class="scan-header-badge">⏱️ 6-Second Recruiter Skim Simulation</div>
                
                <div class="scan-verdict-banner">
                    <div>
                        <div class="verdict-title">Recruiter Skim Verdict</div>
                        <p style="font-size:0.82rem; color:var(--text-muted); margin-top:2px;">What a human reviewer decides in the first 6 seconds.</p>
                    </div>
                    <div class="verdict-tag ${verdictClass}">${verdict}</div>
                </div>

                <div class="scan-grid">
                    <div class="scan-col">
                        <div class="scan-col-title green">
                            <span>🟢</span>
                            <span>3 Instant Green Flags</span>
                        </div>
                        <ul class="scan-list">
                            ${greenFlags.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                        </ul>
                    </div>

                    <div class="scan-col">
                        <div class="scan-col-title red">
                            <span>🔴</span>
                            <span>3 Instant Red Flags / Friction</span>
                        </div>
                        <ul class="scan-list">
                            ${redFlags.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                        </ul>
                    </div>
                </div>

                <div style="margin-top:1.2rem; padding:1rem; background:var(--bg-elevated); border-radius:var(--radius-xs); border-left:3px solid var(--accent-primary); font-size:0.84rem; color:var(--text-secondary);">
                    <strong>💡 How to flip this verdict:</strong> Ensure your top 3 projects prominently feature the target keywords (${missingSkills.slice(0, 3).join(', ')}) with quantified metrics in the top half of your resume.
                </div>
            </div>
        </div>

        <!-- Panel 3: Interview Trap Predictor -->
        <div id="panelResTraps" class="result-tab-panel" style="display:none;">
            <div class="interview-trap-card">
                <div style="margin-bottom:1.2rem;">
                    <h3 style="font-size:1.1rem; font-weight:800; color:#FFF;">🎯 Interview Trap Predictor</h3>
                    <p style="font-size:0.84rem; color:var(--text-muted); margin-top:4px;">
                        Interviewers probe where your resume does not directly match the job description. Here are the 3 hardest questions you will face and how to defend each gap without getting trapped.
                    </p>
                </div>

                ${trapQuestions.map(trap => `
                    <div class="trap-item">
                        <div class="trap-question">${trap.q}</div>
                        <div class="trap-answer-framework">${trap.formula}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <!-- Panel 4: Recruiter Outreach & Anti-Ghosting Timeline -->
        <div id="panelResOutreach" class="result-tab-panel" style="display:none;">
            <div class="ghosting-timeline-card">
                <div style="margin-bottom:1.5rem;">
                    <h3 style="font-size:1.1rem; font-weight:800; color:#FFF;">✉️ Recruiter Outreach & Anti-Ghosting Timeline</h3>
                    <p style="font-size:0.84rem; color:var(--text-muted); margin-top:4px;">
                        A proven communication sequence to get responses from engineering managers and recruiters before and after applying.
                    </p>
                </div>

                <!-- Cold Outreach -->
                <div style="background:var(--bg-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:1.2rem; margin-bottom:1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                        <span style="font-size:0.88rem; font-weight:700; color:#FFF;">Ready-to-Send Cold Outreach Note (&lt;120 words)</span>
                        <button class="copy-btn" onclick="copyToClipboard(document.getElementById('coldOutreachBox').innerText, 'Cold outreach note')">📋 Copy Note</button>
                    </div>
                    <pre id="coldOutreachBox" style="white-space:pre-wrap; font-family:inherit; font-size:0.84rem; color:var(--text-secondary); line-height:1.5; margin:0;">${escapeHtml(coldOutreach)}</pre>
                </div>

                <!-- Timeline Steps -->
                <div class="timeline-step">
                    <div class="timeline-step-icon">03</div>
                    <div class="timeline-step-content">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div class="timeline-step-title">Day 3: LinkedIn Connection Note (&lt;300 chars)</div>
                            <button class="copy-btn mini" onclick="copyFollowupNote('day3')">📋 Copy</button>
                        </div>
                        <div class="timeline-step-desc">Send with your LinkedIn connection request to the recruiter or team lead.</div>
                        <div style="background:var(--bg-elevated); padding:10px; border-radius:var(--radius-xs); font-size:0.82rem; color:var(--text-secondary); border:1px solid var(--border-subtle); margin-top:4px;">
                            Hi [Name], applied for the ${escapeHtml(role)} position at ${escapeHtml(company)}! Given my work in ${matchedSkills[0] || 'software development'}, I'm very excited about the team's direction. Would love to connect.
                        </div>
                    </div>
                </div>

                <div class="timeline-step">
                    <div class="timeline-step-icon">07</div>
                    <div class="timeline-step-content">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div class="timeline-step-title">Day 7: Polite Status Check</div>
                            <button class="copy-btn mini" onclick="copyFollowupNote('day7')">📋 Copy</button>
                        </div>
                        <div class="timeline-step-desc">Send via email or LinkedIn DM if you haven't received an update after 1 week.</div>
                        <div style="background:var(--bg-elevated); padding:10px; border-radius:var(--radius-xs); font-size:0.82rem; color:var(--text-secondary); border:1px solid var(--border-subtle); margin-top:4px;">
                            Hi [Name], following up on my application for ${escapeHtml(role)} submitted last week. I noticed ${escapeHtml(company)}'s recent work and believe my background with ${matchedSkills[0] || 'core technologies'} allows me to contribute immediately. Happy to share work samples.
                        </div>
                    </div>
                </div>

                <div class="timeline-step">
                    <div class="timeline-step-icon">14</div>
                    <div class="timeline-step-content">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div class="timeline-step-title">Day 14: Value-Add Final Touch</div>
                            <button class="copy-btn mini" onclick="copyFollowupNote('day14')">📋 Copy</button>
                        </div>
                        <div class="timeline-step-desc">Share a quick observation about their product or engineering challenge.</div>
                        <div style="background:var(--bg-elevated); padding:10px; border-radius:var(--radius-xs); font-size:0.82rem; color:var(--text-secondary); border:1px solid var(--border-subtle); margin-top:4px;">
                            Hi [Name], checking in regarding the ${escapeHtml(role)} opening. Regardless of timing, really admire what ${escapeHtml(company)} is building and would love to stay in touch for future opportunities.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    switchResultTab('ats');
}

async function runATSExecution() {
    const role = document.getElementById('targetJobRole').value.trim() || "Target Role";
    const company = document.getElementById('targetJobCompany').value.trim() || "Target Company";
    const jd = document.getElementById('jobDesc').value.trim();
    const resume = document.getElementById('userResume').value.trim();
    const resultBox = document.getElementById('atsResultWindow');

    if (!jd || jd.length < 10) {
        showToast("Please paste the target Job Description in Step 01.", "error");
        goToStep(1);
        return;
    }

    if (!resume || resume.length < 10) {
        showToast("Please paste or upload your resume in Step 02.", "error");
        goToStep(2);
        return;
    }

    goToStep(3);
    resultBox.innerHTML = getBrandedBufferingHTML("Analyzing resume match, recruiter scan, and interview traps...");

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
            renderATSResult(data.result, role, company, jd, resume, isGuest);
            updateDynamicJobLinks(role);
            showToast("Match report and recruiter scan ready!", "success");
        } else {
            resultBox.innerHTML = `<p style="color: var(--accent-coral); text-align: center; padding: 2rem;">Evaluation Error: ${data.detail || "Unable to complete request."}</p>`;
            showToast(data.detail || "Evaluation failed.", "error");
        }
    } catch (err) {
        resultBox.innerHTML = '<p style="color: var(--accent-coral); text-align: center; padding: 2rem;">Connection error. Ensure the server is online.</p>';
        showToast("Network connection error.", "error");
    }
}

// 5. Scroll Intersection Observer (Highlights active border without dimming others)
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                document.querySelectorAll('.reveal-card').forEach(c => c.classList.remove('active'));
                entry.target.classList.add('active');

                const fillLine = document.getElementById('activeProgressLine');
                if (fillLine) {
                    if (entry.target.id === 'step-1') fillLine.style.height = '33%';
                    else if (entry.target.id === 'step-2') fillLine.style.height = '66%';
                    else if (entry.target.id === 'step-3') fillLine.style.height = '100%';
                }
            }
        });
    }, { threshold: 0.25 });

    document.querySelectorAll('.reveal-card').forEach(card => observer.observe(card));
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserData();
    updateAuthUI();
    renderDashboard();
    initScrollAnimations();
});
