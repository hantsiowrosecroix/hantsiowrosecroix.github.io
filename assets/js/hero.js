// Matches the mobile breakpoint in nav.js (max-width: 975px)
const DESKTOP_QUERY = '(min-width: 976px)';
const DOCKED_EMBLEM_SIZE = 36;

export function initHero() {
    const header = document.querySelector('header.rc-hero');
    const banner = header?.querySelector('.rc-hero-banner');
    const emblem = header?.querySelector('.rc-hero-emblem-link');
    const nav = header?.querySelector('nav');
    const navContainer = nav?.querySelector(':scope > div');

    if (!banner || !emblem || !navContainer) {
        return;
    }

    const desktop = window.matchMedia(DESKTOP_QUERY);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let metrics = null;
    let frame = 0;

    // Positions are measured relative to the header. The nav moves with the header,
    // so the docking target is fixed in header space regardless of scroll position.
    const measure = () => {
        emblem.style.transform = '';
        header.classList.toggle('rc-hero--sticky', desktop.matches);

        if (!desktop.matches) {
            metrics = null;
            header.classList.remove('is-docked');
            return;
        }

        const bannerHeight = banner.offsetHeight;
        header.style.setProperty('--rc-banner-h', `${bannerHeight}px`);

        const headerRect = header.getBoundingClientRect();
        const emblemRect = emblem.getBoundingClientRect();
        const navRect = nav.getBoundingClientRect();
        const containerRect = navContainer.getBoundingClientRect();
        const containerPadding = parseFloat(getComputedStyle(navContainer).paddingLeft) || 0;

        metrics = {
            bannerHeight,
            size: emblemRect.width,
            dx: containerRect.left + containerPadding - emblemRect.left,
            dy: (navRect.top + (navRect.height - DOCKED_EMBLEM_SIZE) / 2) - emblemRect.top,
        };
    };

    const update = () => {
        frame = 0;

        if (!metrics) {
            return;
        }

        let progress = Math.min(Math.max(window.scrollY / metrics.bannerHeight, 0), 1);
        if (reducedMotion.matches) {
            progress = progress >= 1 ? 1 : 0;
        }

        const scale = 1 + (DOCKED_EMBLEM_SIZE / metrics.size - 1) * progress;
        emblem.style.transform =
            `translate(${metrics.dx * progress}px, ${metrics.dy * progress}px) scale(${scale})`;
        header.classList.toggle('is-docked', progress >= 1);
    };

    const scheduleUpdate = () => {
        if (!frame) {
            frame = requestAnimationFrame(update);
        }
    };

    const remeasure = () => {
        measure();
        update();
    };

    // Covers viewport resizes and late font loads that change the banner height
    new ResizeObserver(remeasure).observe(banner);
    desktop.addEventListener('change', remeasure);
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    remeasure();
}
