// Cookie consent: stores the visitor's choice, shows the settings panel and
// loads or stops optional scripts. See COOKIE_IMPLEMENTATION.md before changing.

const STORAGE_KEY = 'rc-cookie-consent';
// Bump whenever the categories, or what they cover, change so everyone is asked again
const CONSENT_VERSION = 2;
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const GA_MEASUREMENT_ID = 'G-F4RM5B8KMJ';
const GA_SCRIPT_ID = 'rc-ga-script';

const SHEET_QUERY = '(max-width: 640px)';
const SWIPE_CLOSE_DISTANCE = 80;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled])';
const SITE_ROOT = new URL('../../', import.meta.url);

// undefined = not read yet, null = no choice stored, object = stored choice
let storedChoice;
let analyticsOn = false;
let panel = null;

function createIcon(name) {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', name);
    icon.setAttribute('aria-hidden', 'true');
    return icon;
}

function readChoice() {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const choice = JSON.parse(raw);
        const isValid = choice
            && choice.version === CONSENT_VERSION
            && typeof choice.analytics === 'boolean'
            && typeof choice.decidedAt === 'number'
            && Date.now() - choice.decidedAt < MAX_AGE_MS;
        return isValid ? choice : null;
    } catch {
        return null;
    }
}

function writeChoice(choice) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch {
        // Storage blocked (private window etc.): the choice lasts for this visit only
    }
}

// --- Google Analytics ---------------------------------------------------------

function loadAnalytics() {
    window[`ga-disable-${GA_MEASUREMENT_ID}`] = false;

    if (document.getElementById(GA_SCRIPT_ID)) {
        return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
        window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID);

    const script = document.createElement('script');
    script.id = GA_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
}

function deleteAnalyticsCookies() {
    const names = document.cookie
        .split(';')
        .map((cookie) => cookie.split('=')[0].trim())
        .filter((name) => /^_g(a|id|at)(_|$)/.test(name));
    const parts = window.location.hostname.split('.');

    names.forEach((name) => {
        document.cookie = `${name}=; Max-Age=0; path=/`;
        // GA sets its cookies on the top-level domain, so expire them on every parent domain too
        for (let i = 0; i < parts.length - 1; i++) {
            document.cookie = `${name}=; Max-Age=0; path=/; domain=.${parts.slice(i).join('.')}`;
        }
    });
}

function stopAnalytics() {
    // Google's documented opt-out flag stops an already-loaded script from sending anything
    window[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
    document.getElementById(GA_SCRIPT_ID)?.remove();
    deleteAnalyticsCookies();
}

function applyConsent(analytics) {
    analyticsOn = analytics;
    if (analytics) {
        loadAnalytics();
    } else if (storedChoice !== undefined) {
        // Only clear once the stored choice has been read, or a consenting visitor's _ga is wiped
        stopAnalytics();
    }
}

// --- Panel --------------------------------------------------------------------

function buildPanel() {
    const policyHref = new URL('data-protection.html#cookies', SITE_ROOT).href;

    const backdrop = document.createElement('div');
    backdrop.className = 'rc-drawer-backdrop rc-consent-backdrop';

    const drawer = document.createElement('aside');
    drawer.className = 'rc-drawer rc-consent';
    drawer.id = 'rc-consent';
    drawer.tabIndex = -1;
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', 'rc-consent-title');
    drawer.setAttribute('aria-describedby', 'rc-consent-subtitle');
    drawer.inert = true;

    drawer.innerHTML = `
        <div class="rc-consent-handle" aria-hidden="true"></div>
        <div class="rc-drawer-head rc-consent-head">
            <div class="rc-consent-heading">
                <h2 class="rc-consent-title" id="rc-consent-title">Cookie settings</h2>
                <p class="rc-consent-subtitle" id="rc-consent-subtitle">Choose which cookies this website may use.</p>
            </div>
            <button type="button" class="rc-drawer-close rc-consent-close" aria-label="Close cookie settings"></button>
        </div>
        <div class="rc-drawer-body rc-consent-body">
            <p class="rc-consent-intro">
                Necessary cookies are always on, as the website cannot work without them. Statistics are only
                collected if you switch them on, and you can change your mind at any time using the
                Cookie settings link at the foot of every page.
            </p>

            <section class="rc-consent-card" aria-labelledby="rc-consent-necessary-label">
                <div class="rc-consent-card-row">
                    <label class="rc-consent-card-title" id="rc-consent-necessary-label" for="rc-consent-necessary">Necessary</label>
                    <span class="rc-consent-switch-wrap">
                        <span class="rc-consent-always">Always on</span>
                        <input type="checkbox" role="switch" class="rc-switch" id="rc-consent-necessary"
                            checked disabled aria-describedby="rc-consent-necessary-desc">
                    </span>
                </div>
                <p class="rc-consent-card-desc" id="rc-consent-necessary-desc">
                    Keep the website working and secure: remembering this choice, keeping officers signed in to
                    the news and events editor, sending the contact form and loading news and events through
                    Cloudflare, loading the site's fonts and icons from Google Fonts and unpkg, and showing where
                    each Masonic centre is with Google Maps. We don't use any of these to track you.
                </p>
            </section>

            <section class="rc-consent-card" aria-labelledby="rc-consent-analytics-label">
                <div class="rc-consent-card-row">
                    <label class="rc-consent-card-title" id="rc-consent-analytics-label" for="rc-consent-analytics">Statistics and analytics</label>
                    <span class="rc-consent-switch-wrap">
                        <input type="checkbox" role="switch" class="rc-switch" id="rc-consent-analytics"
                            aria-describedby="rc-consent-analytics-desc">
                    </span>
                </div>
                <p class="rc-consent-card-desc" id="rc-consent-analytics-desc">
                    Google Analytics tells us how many people visit, which pages they read and roughly where they
                    are, so we can improve the website. It sets the <code>_ga</code> cookies, which last up to
                    2 years. Off unless you switch it on.
                </p>
            </section>

            <a class="rc-consent-policy" href="${policyHref}">Read about cookies in our Data Protection Policy</a>
        </div>
        <div class="rc-drawer-foot rc-consent-actions">
            <button type="button" class="rc-consent-btn rc-consent-btn--primary" data-consent-action="reject">Reject all</button>
            <button type="button" class="rc-consent-btn rc-consent-btn--primary" data-consent-action="save">Save my choices</button>
            <button type="button" class="rc-consent-btn rc-consent-btn--secondary" data-consent-action="accept">Accept all</button>
        </div>
    `;

    drawer.querySelector('.rc-consent-close').appendChild(createIcon('x'));

    document.body.append(backdrop, drawer);
    return { backdrop, drawer };
}

function initPanel() {
    const { backdrop, drawer } = buildPanel();
    const analyticsSwitch = drawer.querySelector('#rc-consent-analytics');
    const body = drawer.querySelector('.rc-consent-body');
    let returnFocusTo = null;

    const isOpen = () => drawer.classList.contains('is-open');

    const open = () => {
        if (isOpen()) {
            return;
        }
        returnFocusTo = document.activeElement;
        analyticsSwitch.checked = analyticsOn;
        drawer.inert = false;
        drawer.classList.add('is-open');
        backdrop.classList.add('is-open');
        document.documentElement.classList.add('rc-consent-open');
        drawer.focus({ preventScroll: true });
    };

    // Closing without choosing saves nothing, so the panel opens again on the next page load
    const close = ({ restoreFocus = true } = {}) => {
        if (!isOpen()) {
            return;
        }
        drawer.style.transform = '';
        drawer.classList.remove('is-open');
        backdrop.classList.remove('is-open');
        document.documentElement.classList.remove('rc-consent-open');
        drawer.inert = true;
        if (restoreFocus && returnFocusTo?.isConnected) {
            returnFocusTo.focus({ preventScroll: true });
        }
        returnFocusTo = null;
    };

    const decide = (analytics) => {
        storedChoice = { version: CONSENT_VERSION, analytics, decidedAt: Date.now() };
        writeChoice(storedChoice);
        applyConsent(analytics);
        close();
    };

    drawer.querySelector('[data-consent-action="reject"]').addEventListener('click', () => decide(false));
    drawer.querySelector('[data-consent-action="save"]').addEventListener('click', () => decide(analyticsSwitch.checked));
    drawer.querySelector('[data-consent-action="accept"]').addEventListener('click', () => decide(true));

    backdrop.addEventListener('click', () => close());
    drawer.querySelector('.rc-consent-close').addEventListener('click', () => close());
    drawer.querySelector('.rc-consent-policy').addEventListener('click', () => close({ restoreFocus: false }));

    // Keep keyboard focus inside the open panel; Escape closes it
    drawer.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            close();
            return;
        }

        if (event.key !== 'Tab') {
            return;
        }

        const focusable = [...drawer.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && (document.activeElement === first || document.activeElement === drawer)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    // Bottom sheet on phones: swipe down to dismiss
    let touchStartY = null;
    let touchStartX = 0;
    let swipeOffset = 0;

    drawer.addEventListener('touchstart', (event) => {
        const fromTop = event.target.closest('.rc-consent-handle, .rc-consent-head') || body.scrollTop <= 0;
        if (!window.matchMedia(SHEET_QUERY).matches || !fromTop) {
            touchStartY = null;
            return;
        }
        touchStartY = event.touches[0].clientY;
        touchStartX = event.touches[0].clientX;
        swipeOffset = 0;
    }, { passive: true });

    drawer.addEventListener('touchmove', (event) => {
        if (touchStartY === null) {
            return;
        }
        const dy = event.touches[0].clientY - touchStartY;
        const dx = event.touches[0].clientX - touchStartX;

        // Let scrolling the panel content win unless the gesture is clearly a downward swipe
        if (!swipeOffset && (dy <= 0 || Math.abs(dx) > Math.abs(dy))) {
            touchStartY = null;
            return;
        }

        swipeOffset = Math.max(dy, 0);
        drawer.classList.add('is-dragging');
        drawer.style.transform = `translateY(${swipeOffset}px)`;
    }, { passive: true });

    drawer.addEventListener('touchend', () => {
        drawer.classList.remove('is-dragging');
        drawer.style.transform = '';
        if (swipeOffset > SWIPE_CLOSE_DISTANCE) {
            close();
        }
        touchStartY = null;
        swipeOffset = 0;
    });

    return { open };
}

// --- Public API ---------------------------------------------------------------

export function useCookieConsent() {
    return {
        analytics: analyticsOn,
        openSettings: () => panel?.open(),
    };
}

export function initCookieConsent() {
    storedChoice = readChoice();
    // No choice yet, or a refusal: also removes analytics cookies left by the old always-on tag
    applyConsent(storedChoice?.analytics === true);

    panel = initPanel();

    // "Cookie settings" links in the footer and the Data Protection Policy
    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-cookie-settings]');
        if (trigger) {
            event.preventDefault();
            panel.open();
        }
    });

    if (!storedChoice) {
        panel.open();
    }
}
