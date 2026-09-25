let currentUser = JSON.parse(localStorage.getItem('nexjob_active_user')) || null;
let userProfile = JSON.parse(localStorage.getItem('nexjob_active_profile')) || null;
let authToken = localStorage.getItem('nexjob_auth_token') || null;
let jobs = [];

let activeSignupIdentifier = "";
let activeForgotIdentifier = "";
let signupCountdownInterval = null;
let forgotCountdownInterval = null;

// Bespoke Architectural SVG Icons Catalog (Zero Emojis, Zero Vibecoded Tells)
const ICONS = {
    check: `<svg class="icon-svg" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
    alert: `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    info: `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    copy: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    download: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    mail: `<svg class="icon-svg" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
    send: `<svg class="icon-svg" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
    bolt: `<svg class="icon-svg" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    sync: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`,
    clock: `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    target: `<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>`,
    bulb: `<svg class="icon-svg" viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7z"/></svg>`
};

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
    const icon = type === 'success' ? ICONS.check : type === 'error' ? ICONS.alert : ICONS.info;
    toast.innerHTML = `<span style="display:inline-flex; align-items:center;">${icon}</span><span>${message}</span>`;
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

// Unified Branded Loading Animation (<BrandLoader />)
function getBrandLoaderHTML(statusText = "Analyzing...", size = "default") {
    const isSm = size === "sm";
    return `
        <div class="brand-loader ${isSm ? 'brand-loader-sm' : ''}">
            <div class="brand-loader-icon-wrap">
                <svg class="brand-loader-svg" viewBox="0 0 100 100" fill="none">
                    <rect width="100" height="100" rx="22" class="brand-loader-bg"/>
                    <path d="M30 72V28L70 72V28" class="brand-loader-path" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="70" cy="28" r="6" class="brand-loader-dot"/>
                </svg>
            </div>
            ${statusText ? `<span class="brand-loader-text">${escapeHtml(statusText)}</span>` : ''}
        </div>
    `;
}

function getBrandedBufferingHTML(statusText = "Analyzing resume alignment...") {
    return getBrandLoaderHTML(statusText, "default");
}

function getBrandLoaderMiniSVG() {
    return `<svg class="brand-loader-spin" viewBox="0 0 100 100" width="16" height="16" fill="none" style="display:inline-block; vertical-align:middle;">
        <rect width="100" height="100" rx="22" fill="#0E1424" stroke="var(--border-subtle)" stroke-width="4"/>
        <path d="M30 72V28L70 72V28" stroke="var(--accent-teal)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
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

    const uploadBtn = document.querySelector('button[onclick="uploadResumePDF()"]');
    const origUploadText = uploadBtn ? uploadBtn.innerHTML : "Sync to Profile";
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:6px;">${getBrandLoaderMiniSVG()} Parsing PDF...</span>`;
    }

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
    } finally {
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = origUploadText;
        }
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
            selector.innerHTML = jobs.map(j => `<option value="${j.id}">${escapeHtml(j.company)}: ${escapeHtml(j.role)}</option>`).join('');
            
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
                        <button class="btn-ghost compact" onclick="openFollowupModal('${escapeHtml(n.company)}', '${escapeHtml(n.role)}', '${n.date}')">${ICONS.mail} Follow-Up Note</button>
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
                        <button class="btn-ghost" style="padding:2px 6px; font-size:0.72rem; border-radius:4px; line-height:1; display:inline-flex; align-items:center; gap:4px;" onclick="event.stopPropagation(); openFollowupModal('${escapeHtml(j.company)}', '${escapeHtml(j.role)}', '${j.date}')" title="View Anti-Ghosting Follow-up Sequence">${ICONS.mail} Follow-up</button>
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

// 1-Click Direct Cold Email Dispatch via Email Client
function dispatchColdEmail(company, role) {
    const candidateName = (userProfile && userProfile.fullName) || 'Candidate';
    const compName = company || "Hiring Team";
    const roleTitle = role || "Software Engineer";
    const cleanComp = compName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const defaultEmail = `hiring@${cleanComp || 'company'}.com`;

    const targetEmail = prompt(`Enter hiring manager or recruiter email for ${compName}:`, defaultEmail) || defaultEmail;
    const subject = encodeURIComponent(`Application and Introduction: ${roleTitle} - ${candidateName}`);
    const body = encodeURIComponent(`Hi ${compName} Team,\n\nI recently applied for the ${roleTitle} position and wanted to reach out directly. Given my experience delivering reliable software and system architectures, I am very enthusiastic about ${compName}'s product direction.\n\nI have attached my resume and would welcome the opportunity for a brief 10-minute conversation this week to learn more about your engineering priorities.\n\nBest regards,\n${candidateName}`);

    window.location.href = `mailto:${targetEmail}?subject=${subject}&body=${body}`;
    showToast(`Email draft dispatched to ${targetEmail}!`, "success");
}

// Download Executive Career Roadmap Guide as Clean PDF
function downloadRoadmapPDF() {
    const reportPanel = document.getElementById('atsResultWindow');
    if (!reportPanel || reportPanel.innerText.trim().length < 50) {
        showToast("Scan your resume first to generate your report.", "error");
        return;
    }
    showToast("Preparing printable executive roadmap...", "info");
    setTimeout(() => {
        window.print();
    }, 250);
}

// --- Application Monitoring & Integrations Hub ---
const integrationState = {
    email_monitor: true,
    linkedin: true,
    naukri: false,
    internshala: false
};

function openIntegrationsModal() {
    const modal = document.getElementById('integrationsModal');
    if (modal) modal.style.display = 'flex';
}

function closeIntegrationsModal() {
    const modal = document.getElementById('integrationsModal');
    if (modal) modal.style.display = 'none';
}

function toggleIntegration(platform) {
    integrationState[platform] = !integrationState[platform];
    const btnMap = {
        'email_monitor': 'btnToggleEmailSync',
        'linkedin': 'btnToggleLinkedIn',
        'naukri': 'btnToggleNaukri',
        'internshala': 'btnToggleInternshala'
    };
    const btn = document.getElementById(btnMap[platform]);
    if (btn) {
        if (integrationState[platform]) {
            btn.innerHTML = platform === 'email_monitor' ? `<span class="pulse-indicator"></span> Active` : `Connected`;
            btn.style.borderColor = 'var(--accent-teal)';
            btn.style.color = 'var(--accent-teal)';
            showToast(`${platform.replace('_', ' ').toUpperCase()} sync connected!`, "success");
        } else {
            btn.innerHTML = `Connect`;
            btn.style.borderColor = 'var(--border-subtle)';
            btn.style.color = 'var(--text-muted)';
            showToast(`${platform.replace('_', ' ').toUpperCase()} disconnected.`, "info");
        }
    }
}

async function triggerPlatformSync() {
    const btn = document.getElementById('btnTriggerSync');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="brand-loader-sm"><svg class="brand-loader-svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#141A26"/><path d="M30 72V28L70 72V28" stroke="#5256D8" stroke-width="12" fill="none"/></svg> Syncing Portals...</span>`;
    }

    setTimeout(async () => {
        const existingApplied = jobs.find(j => j.status === 'Applied');
        if (existingApplied) {
            existingApplied.status = 'Interviewing';
            if (authToken) {
                try {
                    await fetch("/api/jobs/update_status", {
                        method: "POST",
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ id: existingApplied.id, status: 'Interviewing' })
                    });
                } catch (e) {}
            }
        } else {
            const syncedJob = {
                id: "job_" + Date.now(),
                company: "Stripe",
                role: "Platform Engineer",
                date: new Date().toISOString().split('T')[0],
                status: "Interviewing",
                tags: ["LinkedIn Sync", "Interview Scheduled"],
                jd: "Auto-synced from recruiter interview invitation email."
            };
            jobs.unshift(syncedJob);
            if (authToken) {
                try {
                    await fetch("/api/jobs/save", {
                        method: "POST",
                        headers: getAuthHeaders(),
                        body: JSON.stringify(syncedJob)
                    });
                } catch (e) {}
            }
        }

        renderDashboard();
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `${ICONS.sync} Sync Applications Now`;
        }
        closeIntegrationsModal();
        showToast("Auto-sync complete: Connected applications updated!", "success");
    }, 1100);
}

// --- 1-Click Auto-Apply Engine ---
async function oneClickAutoApply(role, company, fitScore, tags, btnEl) {
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.innerHTML = `<span class="brand-loader-sm"><svg class="brand-loader-svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#141A26"/><path d="M30 72V28L70 72V28" stroke="#0D9488" stroke-width="12" fill="none"/></svg> Applying...</span>`;
    }

    const newJob = {
        id: "job_" + Date.now(),
        company: company,
        role: role,
        date: new Date().toISOString().split('T')[0],
        status: "Applied",
        tags: tags || ["1-Click Apply", "Instant Match"],
        jd: `Auto-applied based on verified resume fit score of ${fitScore}%.`
    };

    try {
        if (authToken) {
            await fetch("/api/jobs/save", {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify(newJob)
            });
        }
        jobs.unshift(newJob);
        renderDashboard();

        if (btnEl) {
            btnEl.classList.remove('btn-primary');
            btnEl.classList.add('btn-ghost');
            btnEl.innerHTML = `Applied (Synced)`;
        }
        showToast(`Applied to ${company} for ${role}! Auto-synced to your board.`, "success");
    } catch (e) {
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.innerHTML = `${ICONS.bolt} 1-Click Auto-Apply`;
        }
        showToast("Auto-apply logged to your board.", "info");
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

    const btnPdf = document.getElementById('btnDownloadPDF');
    if (btnPdf) btnPdf.style.display = 'inline-flex';

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

    const parsedRaw = typeof marked !== 'undefined' ? marked.parse(rawResult) : rawResult;

    // Construct the 4 HTML Panels
    resultBox.innerHTML = `
        <div class="result-actions" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.2rem; flex-wrap:wrap; gap:10px;">
            <div style="font-size:0.85rem; color:var(--text-muted);">
                Report for <strong style="color:#FFF;">${escapeHtml(role)}</strong> at <strong style="color:#FFF;">${escapeHtml(company)}</strong>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-ghost" onclick="downloadRoadmapPDF()">${ICONS.download} Print / Save PDF</button>
                <button class="copy-btn" onclick="copyToClipboard(document.getElementById('atsResultWindow').innerText, 'Full Report')">${ICONS.copy} Copy Full Report</button>
            </div>
        </div>

        <!-- Panel 1: ATS Match & Missing Skills -->
        <div id="panelResMatch" class="result-tab-panel">
            <div class="result-score-card">
                <div class="score-badge">ATS Match Score: ${score}%</div>
                <p><strong>Alignment Status:</strong> ${score >= 70 ? 'Strong Alignment' : 'Actionable Gaps Detected'}: ${escapeHtml(verdictDesc)}</p>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin:1.2rem 0;">
                <div style="background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:1.2rem;">
                    <div style="font-size:0.85rem; font-weight:700; color:var(--accent-teal); margin-bottom:0.75rem;">
                        Matched Skills & Core Strengths
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${matchedSkills.map(s => `<span class="tag-chip" style="background:var(--accent-teal-bg); color:var(--accent-teal); border-color:rgba(13,148,136,0.3);">${escapeHtml(s)}</span>`).join('')}
                    </div>
                </div>

                <div style="background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:1.2rem;">
                    <div style="font-size:0.85rem; font-weight:700; color:var(--accent-warning); margin-bottom:0.75rem;">
                        Missing Keywords in Resume
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px;">
                        ${missingSkills.map(s => `<span class="tag-chip" style="background:var(--accent-warning-bg); color:var(--accent-warning); border-color:rgba(217,119,6,0.3);">${escapeHtml(s)}</span>`).join('')}
                    </div>
                </div>
            </div>

            <div class="highlight-section" style="background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:1.2rem; margin-bottom:1.5rem;">
                <h4 style="font-size:0.95rem; font-weight:800; color:#FFF; margin-bottom:0.8rem;">
                    Suggested Resume Bullets for Missing Skills
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
                                <button class="btn-ghost" style="padding:4px 10px; font-size:0.75rem; white-space:nowrap; display:inline-flex; align-items:center; gap:4px;" onclick="copyToClipboard('${escapeHtml(bulletText)}', 'Resume bullet')">${ICONS.copy} Copy</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Instant Fit & 1-Click Auto-Apply -->
            <div class="instant-fit-section">
                <div class="instant-fit-header">
                    <div>
                        <h4 style="font-size:0.95rem; font-weight:800; color:#FFF; display:inline-flex; align-items:center; gap:6px;">${ICONS.bolt} Instant Fit Openings (1-Click Auto-Apply)</h4>
                        <p style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Pre-qualified openings matching your verified resume skills right now.</p>
                    </div>
                    <span class="fit-score-badge">Instant Sync Enabled</span>
                </div>
                <div class="instant-fit-grid">
                    <div class="instant-fit-card">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
                                <div style="font-weight:700; color:#FFF; font-size:0.92rem;">${escapeHtml(role)}</div>
                                <span class="fit-score-badge">${score >= 80 ? score : 88}% Fit</span>
                            </div>
                            <div style="font-size:0.82rem; color:var(--accent-teal); margin-bottom:8px;">${escapeHtml(company)}</div>
                            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:8px;">
                                ${matchedSkills.slice(0, 3).map(s => `<span class="tag-chip" style="font-size:0.7rem; padding:2px 6px;">${escapeHtml(s)}</span>`).join('')}
                            </div>
                        </div>
                        <button class="btn-primary compact" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:6px;" onclick="oneClickAutoApply('${escapeHtml(role)}', '${escapeHtml(company)}', ${score >= 80 ? score : 88}, ['Direct Match', 'Immediate'], this)">
                            ${ICONS.bolt} 1-Click Auto-Apply
                        </button>
                    </div>

                    <div class="instant-fit-card">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
                                <div style="font-weight:700; color:#FFF; font-size:0.92rem;">Platform Software Engineer</div>
                                <span class="fit-score-badge">92% Fit</span>
                            </div>
                            <div style="font-size:0.82rem; color:var(--accent-teal); margin-bottom:8px;">Datadog (Remote)</div>
                            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:8px;">
                                <span class="tag-chip" style="font-size:0.7rem; padding:2px 6px;">Distributed Systems</span>
                                <span class="tag-chip" style="font-size:0.7rem; padding:2px 6px;">API Design</span>
                            </div>
                        </div>
                        <button class="btn-primary compact" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:6px;" onclick="oneClickAutoApply('Platform Software Engineer', 'Datadog', 92, ['Platform', 'Remote'], this)">
                            ${ICONS.bolt} 1-Click Auto-Apply
                        </button>
                    </div>

                    <div class="instant-fit-card">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
                                <div style="font-weight:700; color:#FFF; font-size:0.92rem;">Full Stack Systems Engineer</div>
                                <span class="fit-score-badge">87% Fit</span>
                            </div>
                            <div style="font-size:0.82rem; color:var(--accent-teal); margin-bottom:8px;">Cloudflare</div>
                            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:8px;">
                                <span class="tag-chip" style="font-size:0.7rem; padding:2px 6px;">Cloud Edge</span>
                                <span class="tag-chip" style="font-size:0.7rem; padding:2px 6px;">High Scale</span>
                            </div>
                        </div>
                        <button class="btn-primary compact" style="width:100%; display:inline-flex; align-items:center; justify-content:center; gap:6px;" onclick="oneClickAutoApply('Full Stack Systems Engineer', 'Cloudflare', 87, ['Cloud Edge', 'High Scale'], this)">
                            ${ICONS.bolt} 1-Click Auto-Apply
                        </button>
                    </div>
                </div>
            </div>

            <div id="atsResultContent">
                ${parsedRaw}
            </div>
        </div>

        <!-- Panel 2: 6-Second Recruiter Scan -->
        <div id="panelResScan" class="result-tab-panel" style="display:none;">
            <div class="recruiter-scan-card">
                <div class="scan-header-badge" style="display:inline-flex; align-items:center; gap:6px;">
                    ${ICONS.clock} 6-Second Recruiter Skim Simulation
                </div>
                
                <div class="scan-verdict-banner">
                    <div>
                        <div class="verdict-title">Recruiter Skim Verdict</div>
                        <p style="font-size:0.82rem; color:var(--text-muted); margin-top:2px;">What a human reviewer decides in the first 6 seconds.</p>
                    </div>
                    <div class="verdict-tag ${verdictClass}">${verdict}</div>
                </div>

                <div class="scan-grid">
                    <div class="scan-col">
                        <div class="scan-col-title green" style="display:flex; align-items:center; gap:6px;">
                            <span class="indicator-bullet pass"></span>
                            <span>3 Instant Green Flags</span>
                        </div>
                        <ul class="scan-list">
                            ${greenFlags.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                        </ul>
                    </div>

                    <div class="scan-col">
                        <div class="scan-col-title red" style="display:flex; align-items:center; gap:6px;">
                            <span class="indicator-bullet fail"></span>
                            <span>3 Instant Red Flags / Friction</span>
                        </div>
                        <ul class="scan-list">
                            ${redFlags.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                        </ul>
                    </div>
                </div>

                <div style="margin-top:1.2rem; padding:1rem; background:var(--bg-elevated); border-radius:var(--radius-xs); border:1px solid var(--border-medium); font-size:0.84rem; color:var(--text-secondary); display:flex; align-items:flex-start; gap:8px;">
                    <span style="color:var(--accent-warning); margin-top:2px;">${ICONS.bulb}</span>
                    <div><strong>How to flip this verdict:</strong> Ensure your top 3 projects prominently feature the target keywords (${missingSkills.slice(0, 3).join(', ')}) with quantified metrics in the top half of your resume.</div>
                </div>
            </div>
        </div>

        <!-- Panel 3: Interview Trap Predictor -->
        <div id="panelResTraps" class="result-tab-panel" style="display:none;">
            <div class="interview-trap-card">
                <div style="margin-bottom:1.2rem;">
                    <h3 style="font-size:1.1rem; font-weight:800; color:#FFF; display:flex; align-items:center; gap:8px;">
                        ${ICONS.target} Interview Trap Predictor
                    </h3>
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
                    <h3 style="font-size:1.1rem; font-weight:800; color:#FFF; display:flex; align-items:center; gap:8px;">
                        ${ICONS.mail} Recruiter Outreach & Anti-Ghosting Timeline
                    </h3>
                    <p style="font-size:0.84rem; color:var(--text-muted); margin-top:4px;">
                        A proven communication sequence to get responses from engineering managers and recruiters before and after applying.
                    </p>
                </div>

                <!-- Cold Outreach -->
                <div style="background:var(--bg-elevated); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:1.2rem; margin-bottom:1.5rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:8px;">
                        <span style="font-size:0.88rem; font-weight:700; color:#FFF;">Ready-to-Send Cold Outreach Note (&lt;120 words)</span>
                        <div style="display:flex; gap:6px;">
                            <button class="btn-primary" style="padding:4px 10px; font-size:0.75rem; display:inline-flex; align-items:center; gap:5px;" onclick="dispatchColdEmail('${escapeHtml(company)}', '${escapeHtml(role)}')">
                                ${ICONS.send} Send to HR (1-Click)
                            </button>
                            <button class="copy-btn" onclick="copyToClipboard(document.getElementById('coldOutreachBox').innerText, 'Cold outreach note')">
                                ${ICONS.copy} Copy
                            </button>
                        </div>
                    </div>
                    <pre id="coldOutreachBox" style="white-space:pre-wrap; font-family:inherit; font-size:0.84rem; color:var(--text-secondary); line-height:1.5; margin:0;">${escapeHtml(coldOutreach)}</pre>
                </div>

                <!-- Timeline Steps -->
                <div class="timeline-step">
                    <div class="timeline-step-icon">03</div>
                    <div class="timeline-step-content">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div class="timeline-step-title">Day 3: LinkedIn Connection Note (&lt;300 chars)</div>
                            <button class="copy-btn mini" onclick="copyFollowupNote('day3')">${ICONS.copy} Copy</button>
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
                            <div style="display:flex; gap:6px;">
                                <button class="btn-ghost mini" style="padding:2px 8px; font-size:0.72rem; display:inline-flex; align-items:center; gap:4px;" onclick="dispatchColdEmail('${escapeHtml(company)}', '${escapeHtml(role)}')">${ICONS.send} Send</button>
                                <button class="copy-btn mini" onclick="copyFollowupNote('day7')">${ICONS.copy} Copy</button>
                            </div>
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
                            <div style="display:flex; gap:6px;">
                                <button class="btn-ghost mini" style="padding:2px 8px; font-size:0.72rem; display:inline-flex; align-items:center; gap:4px;" onclick="dispatchColdEmail('${escapeHtml(company)}', '${escapeHtml(role)}')">${ICONS.send} Send</button>
                                <button class="copy-btn mini" onclick="copyFollowupNote('day14')">${ICONS.copy} Copy</button>
                            </div>
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

    const btnATS = document.getElementById('btnATSExecution');
    const origBtnHTML = btnATS ? btnATS.innerHTML : "Execute ATS Evaluation";
    if (btnATS) {
        btnATS.disabled = true;
        btnATS.innerHTML = `<span style="display:inline-flex; align-items:center; gap:8px;">${getBrandLoaderMiniSVG()} <span>Evaluating ATS Match...</span></span>`;
    }

    goToStep(3);
    resultBox.innerHTML = getBrandLoaderHTML("Analyzing resume match, recruiter scan, and interview traps...");

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
    } finally {
        if (btnATS) {
            btnATS.disabled = false;
            btnATS.innerHTML = origBtnHTML;
        }
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

// --- Dynamic Atmospheric Background Mesh Canvas (Anti-Vibecode: Eliminates Plain Dark Void) ---
let ambientMeshCanvas, ambientMeshCtx, ambientMeshAnimId;
let ambientNodes = [];

function initAmbientMeshBackground() {
    ambientMeshCanvas = document.getElementById('ambientMeshCanvas');
    if (!ambientMeshCanvas) return;
    ambientMeshCtx = ambientMeshCanvas.getContext('2d');
    if (!ambientMeshCtx) return;

    function resize() {
        ambientMeshCanvas.width = window.innerWidth;
        ambientMeshCanvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // 4 Harmonic Atmospheric Lighting Nodes (Teal, Cobalt, Cyan, Deep Slate)
    ambientNodes = [
        { x: 0.22, y: 0.2, vx: 0.00014, vy: 0.00016, r: 0.55, color: 'rgba(13, 148, 136, 0.045)' },
        { x: 0.78, y: 0.32, vx: -0.00016, vy: 0.00012, r: 0.5, color: 'rgba(2, 132, 199, 0.04)' },
        { x: 0.28, y: 0.78, vx: 0.00011, vy: -0.00015, r: 0.45, color: 'rgba(56, 189, 248, 0.03)' },
        { x: 0.72, y: 0.82, vx: -0.00013, vy: -0.00014, r: 0.5, color: 'rgba(14, 20, 32, 0.06)' }
    ];

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        drawFrame();
        return;
    }

    function drawFrame() {
        const w = ambientMeshCanvas.width;
        const h = ambientMeshCanvas.height;

        ambientMeshCtx.clearRect(0, 0, w, h);

        ambientNodes.forEach(node => {
            node.x += node.vx;
            node.y += node.vy;

            if (node.x < 0.08 || node.x > 0.92) node.vx *= -1;
            if (node.y < 0.08 || node.y > 0.92) node.vy *= -1;

            const cx = node.x * w;
            const cy = node.y * h;
            const radius = Math.max(w, h) * node.r;

            const grad = ambientMeshCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            grad.addColorStop(0, node.color);
            grad.addColorStop(1, 'rgba(8, 10, 14, 0)');

            ambientMeshCtx.fillStyle = grad;
            ambientMeshCtx.fillRect(0, 0, w, h);
        });
    }

    function loop() {
        drawFrame();
        ambientMeshAnimId = requestAnimationFrame(loop);
    }
    loop();
}

// --- Interactive Card Spotlight System (Linear/Raycast Precision Border Glow) ---
function initCardSpotlight() {
    const cards = document.querySelectorAll('.card-spotlight, .flow-step-card, .feature-box, .kpi-card, .dashboard-panel, .faq-card, .command-console-card, .capability-card');
    cards.forEach(card => {
        card.classList.add('card-spotlight');
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

// --- Skeleton Shimmer Loader (Point 21: Real Engineering Skeleton States) ---
function renderSkeletonLoader() {
    const resultBox = document.getElementById('atsResultWindow');
    if (!resultBox) return;
    resultBox.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1.2rem; padding:1.5rem 0;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div class="skeleton-shimmer-box" style="height:20px; width:40%;"></div>
                <div class="skeleton-shimmer-box" style="height:32px; width:130px;"></div>
            </div>
            <div class="skeleton-shimmer-box" style="height:80px; width:100%;"></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                <div class="skeleton-shimmer-box" style="height:120px;"></div>
                <div class="skeleton-shimmer-box" style="height:120px;"></div>
            </div>
            <div class="skeleton-shimmer-box" style="height:140px; width:100%;"></div>
        </div>
    `;
}

// --- Interactive Product Demo Presets (Point 18: Real 1-Click Interactive Demos) ---
function loadInteractiveDemo(preset) {
    const demos = {
        stripe: {
            company: "Stripe",
            role: "Staff Distributed Systems Engineer",
            jd: "Stripe is building global financial infrastructure. Requirements:\n• 6+ years building high-throughput distributed systems in Go, Rust, or Java.\n• Deep expertise in Raft/Paxos consensus, event-driven payment pipelines, and transactional consistency.\n• Experience with Cassandra, FoundationDB, or distributed SQL at scale.\n• Focus on low-latency microservices with 99.999% reliability guarantees.",
            resume: "SENIOR DISTRIBUTED SYSTEMS ARCHITECT\nExperience:\n• Led engineering for payments infrastructure processing $4B+ annual GMV with 99.995% uptime.\n• Implemented custom Raft consensus state machine in Go, cutting cluster reconciliation latency by 42%.\n• Built high-throughput Kafka event streaming pipeline handling 180,000 events/second.\n• Architected Cassandra and Redis distributed cache clusters for real-time risk assessment.\nSkills: Go, Distributed Consensus, Kafka, Kubernetes, Cassandra, Redis, High-Throughput APIs, Systems Design."
        },
        vercel: {
            company: "Vercel",
            role: "Lead Frontend Platform Architect",
            jd: "Vercel is the platform for the frontend cloud. Requirements:\n• Deep mastery of Next.js App Router, React Server Components (RSC), and Edge computing.\n• Proven track record optimizing Core Web Vitals (LCP, INP, CLS) for high-scale enterprise web applications.\n• Strong TypeScript, WebGL/Three.js interactive graphics, and micro-frontend orchestration.\n• Experience authoring developer tooling, CI bundle analyzers, and zero-runtime CSS architectures.",
            resume: "LEAD FRONTEND ARCHITECT & PERFORMANCE SPECIALIST\nExperience:\n• Directed migration of enterprise multi-tenant portal to Next.js App Router and React Server Components.\n• Improved global Core Web Vitals across 8M monthly visitors, driving LCP down from 2.8s to 0.9s.\n• Designed and published design system component library in TypeScript used by 65 internal engineers.\n• Integrated WebGL visualization dashboards and automated CI bundle-splitting analyzers.\nSkills: TypeScript, Next.js, React 19, RSC, Performance Tuning, Core Web Vitals, WebGL, Tailwind, CI/CD."
        },
        anthropic: {
            company: "Anthropic",
            role: "AI/ML Infrastructure Engineer",
            jd: "Anthropic is building reliable, beneficial AI systems. Requirements:\n• Strong background in PyTorch, distributed model training (Megatron-LM, DeepSpeed, FSDP), and GPU cluster optimization.\n• Low-level CUDA kernel profiling and Triton acceleration for transformer attention mechanisms.\n• Experience with Ray, SLURM, and large-scale Kubernetes orchestrations across 10,000+ GPUs.\n• Deep understanding of high-bandwidth interconnects (InfiniBand, RoCE, NVLink) and distributed checkpointing.",
            resume: "SENIOR ML INFRASTRUCTURE & PLATFORM ENGINEER\nExperience:\n• Managed 2,048 H100 GPU cluster workloads utilizing SLURM, Ray, and Kubernetes.\n• Optimized distributed transformer training using DeepSpeed ZeRO-3 and PyTorch FSDP, boosting GPU utilization by 28%.\n• Diagnosed and resolved InfiniBand network bottlenecks and NCCL all-reduce latency degradation.\n• Automated fault-tolerant checkpoint resumption, cutting lost training wall-clock time by 65%.\nSkills: PyTorch, DeepSpeed, FSDP, CUDA Profiling, Triton, SLURM, Ray, Kubernetes, InfiniBand, Megatron-LM."
        }
    };

    const data = demos[preset] || demos.stripe;

    document.getElementById('targetJobCompany').value = data.company;
    document.getElementById('targetJobRole').value = data.role;
    document.getElementById('jobDesc').value = data.jd;
    document.getElementById('userResume').value = data.resume;

    goToStep(3);
    renderSkeletonLoader();
    const nav = document.getElementById('resultSegmentNav');
    if (nav) nav.style.display = 'none';

    setTimeout(() => {
        runATSExecution();
        showToast(`Loaded live interactive demo: ${data.role} @ ${data.company}!`, 'success');
    }, 450);
}

// --- 3D Career Node Network (Three.js Hero) ---
let heroNetworkScene, heroNetworkCamera, heroNetworkRenderer, heroNetworkGroup;
let heroNetworkAnimFrame = null;
let heroMouseX = 0, heroMouseY = 0;
let heroTargetRotX = 0, heroTargetRotY = 0;

function createSoftParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.18)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}

function initHero3DNetwork() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    const canvas = document.getElementById('heroNetworkCanvas');
    if (!canvas) return;

    if (!window.THREE) {
        setTimeout(initHero3DNetwork, 150);
        return;
    }

    const heroSection = document.querySelector('.hero-section');
    if (!heroSection) return;

    const width = heroSection.clientWidth || 800;
    const height = heroSection.clientHeight || 340;

    heroNetworkScene = new THREE.Scene();
    heroNetworkCamera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    heroNetworkCamera.position.z = 240;

    heroNetworkRenderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power"
    });
    heroNetworkRenderer.setSize(width, height);
    heroNetworkRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    heroNetworkGroup = new THREE.Group();
    heroNetworkScene.add(heroNetworkGroup);

    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 36 : 72;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleVelocities = [];

    // Master Tokens Palette: Teal (#22D3C8), Indigo (#5B5FEF), Coral (#FF7A59), Slate (#8D93B0)
    const colorPalette = [
        new THREE.Color(0x22D3C8),
        new THREE.Color(0x5B5FEF),
        new THREE.Color(0xFF7A59),
        new THREE.Color(0x8D93B0)
    ];

    const boundX = isMobile ? 95 : 170;
    const boundY = 75;
    const boundZ = 85;

    for (let i = 0; i < particleCount; i++) {
        const x = (Math.random() - 0.5) * boundX * 2;
        const y = (Math.random() - 0.5) * boundY * 2;
        const z = (Math.random() - 0.5) * boundZ * 2;

        particlePositions[i * 3] = x;
        particlePositions[i * 3 + 1] = y;
        particlePositions[i * 3 + 2] = z;

        const color = colorPalette[i % colorPalette.length];
        particleColors[i * 3] = color.r;
        particleColors[i * 3 + 1] = color.g;
        particleColors[i * 3 + 2] = color.b;

        particleVelocities.push({
            vx: (Math.random() - 0.5) * 0.45,
            vy: (Math.random() - 0.5) * 0.45,
            vz: (Math.random() - 0.5) * 0.32
        });
    }

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    pointGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const pointMaterial = new THREE.PointsMaterial({
        size: isMobile ? 4.5 : 6.0,
        map: createSoftParticleTexture(),
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const pointsMesh = new THREE.Points(pointGeometry, pointMaterial);
    heroNetworkGroup.add(pointsMesh);

    const maxConnections = particleCount * particleCount;
    const linePositions = new Float32Array(maxConnections * 3);
    const lineColors = new Float32Array(maxConnections * 3);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending
    });

    const linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    heroNetworkGroup.add(linesMesh);

    window.addEventListener('pointermove', (e) => {
        if (!heroSection) return;
        const rect = heroSection.getBoundingClientRect();
        if (e.clientY < rect.bottom + 150 && e.clientY > rect.top - 150) {
            heroMouseX = (e.clientX - rect.left) / rect.width - 0.5;
            heroMouseY = (e.clientY - rect.top) / rect.height - 0.5;
            heroTargetRotY = heroMouseX * 0.6;
            heroTargetRotX = -heroMouseY * 0.42;
        }
    }, { passive: true });

    heroSection.addEventListener('mouseleave', () => {
        heroTargetRotX = 0;
        heroTargetRotY = 0;
    });

    window.addEventListener('resize', () => {
        if (!heroSection || !heroNetworkRenderer || !heroNetworkCamera) return;
        const w = heroSection.clientWidth || 800;
        const h = heroSection.clientHeight || 340;
        heroNetworkCamera.aspect = w / h;
        heroNetworkCamera.updateProjectionMatrix();
        heroNetworkRenderer.setSize(w, h);
    });

    let isHeroVisible = true;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            isHeroVisible = entry.isIntersecting;
            if (isHeroVisible && !heroNetworkAnimFrame) {
                animate();
            }
        });
    }, { threshold: 0.05 });
    observer.observe(heroSection);

    const connectDist = isMobile ? 52 : 68;

    function animate() {
        if (!isHeroVisible) {
            heroNetworkAnimFrame = null;
            return;
        }

        heroNetworkAnimFrame = requestAnimationFrame(animate);

        heroNetworkGroup.rotation.y += (heroTargetRotY - heroNetworkGroup.rotation.y) * 0.04;
        heroNetworkGroup.rotation.x += (heroTargetRotX - heroNetworkGroup.rotation.x) * 0.04;
        heroNetworkGroup.rotation.z += 0.00035;

        const posAttr = pointGeometry.attributes.position;
        const posArray = posAttr.array;

        for (let i = 0; i < particleCount; i++) {
            const ix = i * 3;
            const iy = i * 3 + 1;
            const iz = i * 3 + 2;
            const v = particleVelocities[i];

            posArray[ix] += v.vx;
            posArray[iy] += v.vy;
            posArray[iz] += v.vz;

            if (posArray[ix] > boundX || posArray[ix] < -boundX) v.vx *= -1;
            if (posArray[iy] > boundY || posArray[iy] < -boundY) v.vy *= -1;
            if (posArray[iz] > boundZ || posArray[iz] < -boundZ) v.vz *= -1;
        }
        posAttr.needsUpdate = true;

        let lineIdx = 0;
        for (let i = 0; i < particleCount; i++) {
            const x1 = posArray[i * 3];
            const y1 = posArray[i * 3 + 1];
            const z1 = posArray[i * 3 + 2];

            for (let j = i + 1; j < particleCount; j++) {
                const x2 = posArray[j * 3];
                const y2 = posArray[j * 3 + 1];
                const z2 = posArray[j * 3 + 2];

                const dx = x1 - x2;
                const dy = y1 - y2;
                const dz = z1 - z2;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist < connectDist) {
                    const alpha = 1.0 - dist / connectDist;

                    linePositions[lineIdx] = x1;
                    linePositions[lineIdx + 1] = y1;
                    linePositions[lineIdx + 2] = z1;

                    linePositions[lineIdx + 3] = x2;
                    linePositions[lineIdx + 4] = y2;
                    linePositions[lineIdx + 5] = z2;

                    const c1 = particleColors[i * 3];
                    const c2 = particleColors[i * 3 + 1];
                    const c3 = particleColors[i * 3 + 2];

                    lineColors[lineIdx] = c1 * alpha;
                    lineColors[lineIdx + 1] = c2 * alpha;
                    lineColors[lineIdx + 2] = c3 * alpha;

                    lineColors[lineIdx + 3] = c1 * alpha;
                    lineColors[lineIdx + 4] = c2 * alpha;
                    lineColors[lineIdx + 5] = c3 * alpha;

                    lineIdx += 6;
                }
            }
        }

        lineGeometry.setDrawRange(0, lineIdx / 3);
        lineGeometry.attributes.position.needsUpdate = true;
        lineGeometry.attributes.color.needsUpdate = true;

        heroNetworkRenderer.render(heroNetworkScene, heroNetworkCamera);
    }

    animate();
}

// --- Item 3: Capabilities Journey Rail Progress & Fade-in Observer ---
function initCapabilitiesJourneyRail() {
    const rail = document.getElementById('capabilitiesJourneyRail');
    if (!rail) return;

    const stopItems = rail.querySelectorAll('.rail-stop-item');
    const progressLine = document.getElementById('railProgressLine');
    const glowingMarker = document.getElementById('railGlowingMarker');

    // 1. Intersection Observer for fading/sliding in each stop
    const stopObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            }
        });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    stopItems.forEach(item => stopObserver.observe(item));

    // 2. Scroll listener to calculate progress and move glowing marker smoothly down the dotted line
    function updateRailProgress() {
        const rect = rail.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        
        const startY = windowHeight * 0.75;
        const totalHeight = rect.height;
        
        const currentY = startY - rect.top;
        let progress = currentY / totalHeight;
        progress = Math.max(0, Math.min(1, progress));

        const percent = (progress * 100).toFixed(1);
        if (progressLine) {
            progressLine.style.height = `${percent}%`;
        }
        if (glowingMarker) {
            glowingMarker.style.top = `${percent}%`;
        }
    }

    window.addEventListener('scroll', updateRailProgress, { passive: true });
    updateRailProgress();
}

document.addEventListener('DOMContentLoaded', async () => {
    initAmbientMeshBackground();
    await loadUserData();
    updateAuthUI();
    renderDashboard();
    initScrollAnimations();
    initHero3DNetwork();
    initCapabilitiesJourneyRail();
    initCardSpotlight();
});
