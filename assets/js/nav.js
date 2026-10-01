const MOBILE_QUERY = '(max-width: 975px)';
const SWIPE_CLOSE_DISTANCE = 80;
const FOCUSABLE = 'a[href], button:not([disabled])';

function isMobileView() {
    return window.matchMedia(MOBILE_QUERY).matches;
}

function createIcon(name) {
    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', name);
    icon.setAttribute('aria-hidden', 'true');
    return icon;
}

function isCurrentPage(link) {
    const target = new URL(link.href, window.location.href);
    const normalise = (path) => path.replace(/\/index\.html$/, '/');
    return normalise(target.pathname) === normalise(window.location.pathname);
}

function initDesktopDropdowns(nav, navList) {
    const groups = navList.querySelectorAll('li.group');

    const closeAll = () => groups.forEach((group) => group.classList.remove('is-open'));

    groups.forEach((group) => {
        const triggerLink = group.querySelector(':scope > a');
        const submenu = group.querySelector(':scope > ul');

        if (!triggerLink || !submenu) {
            return;
        }

        if (!triggerLink.querySelector(':scope > .rc-nav-link-chevron')) {
            const chevron = createIcon('chevron-down');
            chevron.className = 'rc-nav-link-chevron';
            triggerLink.appendChild(chevron);
        }

        triggerLink.addEventListener('focus', () => {
            if (!isMobileView()) {
                closeAll();
                group.classList.add('is-open');
            }
        });

        group.addEventListener('mouseleave', () => group.classList.remove('is-open'));

        group.addEventListener('focusout', (event) => {
            if (!group.contains(event.relatedTarget)) {
                group.classList.remove('is-open');
            }
        });
    });

    document.addEventListener('click', (event) => {
        if (!nav.contains(event.target)) {
            closeAll();
        }
    });
}

function buildDrawerItem(topItem, index) {
    const topLink = topItem.querySelector(':scope > a');
    const subLinks = [...topItem.querySelectorAll(':scope > ul a')];

    const item = document.createElement('li');
    item.className = 'rc-drawer-item';
    item.style.setProperty('--rc-i', index);

    const row = document.createElement('div');
    row.className = 'rc-drawer-row';

    const link = document.createElement('a');
    link.className = 'rc-drawer-link';
    link.href = topLink.getAttribute('href');
    link.textContent = topLink.textContent.trim();
    if (isCurrentPage(link)) {
        link.setAttribute('aria-current', 'page');
    }
    row.appendChild(link);
    item.appendChild(row);

    if (!subLinks.length) {
        return item;
    }

    const subId = `rc-drawer-sub-${index}`;
    const expand = document.createElement('button');
    expand.type = 'button';
    expand.className = 'rc-drawer-expand';
    expand.setAttribute('aria-expanded', 'false');
    expand.setAttribute('aria-controls', subId);
    expand.setAttribute('aria-label', `Show ${link.textContent} pages`);
    expand.appendChild(createIcon('chevron-down'));
    row.appendChild(expand);

    const sub = document.createElement('div');
    sub.className = 'rc-drawer-sub';
    sub.id = subId;
    sub.inert = true;

    const subInner = document.createElement('ul');
    subInner.className = 'rc-drawer-sublist';

    let containsCurrent = false;
    subLinks.forEach((source) => {
        const subItem = document.createElement('li');
        const subLink = document.createElement('a');
        subLink.className = 'rc-drawer-sublink';
        subLink.href = source.getAttribute('href');
        subLink.textContent = source.textContent.replace(/\s+/g, ' ').trim();
        if (isCurrentPage(subLink)) {
            subLink.setAttribute('aria-current', 'page');
            containsCurrent = true;
        }
        subItem.appendChild(subLink);
        subInner.appendChild(subItem);
    });

    sub.appendChild(subInner);
    item.appendChild(sub);

    const setExpanded = (expanded) => {
        item.classList.toggle('is-expanded', expanded);
        expand.setAttribute('aria-expanded', String(expanded));
        sub.inert = !expanded;
    };

    expand.addEventListener('click', () => setExpanded(!item.classList.contains('is-expanded')));

    // Open the section the visitor is currently in, so they can see where they are
    if (containsCurrent || link.hasAttribute('aria-current')) {
        item.classList.add('is-current-section');
        setExpanded(true);
    }

    return item;
}

function buildDrawer(navList) {
    const homeHref = navList.querySelector('a')?.getAttribute('href') || './index.html';
    const basePath = homeHref.replace(/index\.html$/, '');
    const contactHref = navList.querySelector('a[href$="contact-us.html"]')?.getAttribute('href');

    const backdrop = document.createElement('div');
    backdrop.className = 'rc-drawer-backdrop';

    const drawer = document.createElement('aside');
    drawer.className = 'rc-drawer';
    drawer.id = 'rc-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', 'Site menu');
    drawer.inert = true;

    drawer.innerHTML = `
        <div class="rc-drawer-head">
            <a class="rc-drawer-brand" href="${homeHref}">
                <img src="${basePath}assets/images/golden_herald_360.webp" alt="">
                <span>
                    <span class="rc-drawer-brand-name">Rose Croix</span>
                    <span class="rc-drawer-brand-sub">Hampshire &amp; Isle of Wight</span>
                </span>
            </a>
            <button type="button" class="rc-drawer-close" aria-label="Close menu"></button>
        </div>
        <nav class="rc-drawer-body" aria-label="Site">
            <ul class="rc-drawer-list"></ul>
        </nav>
    `;

    drawer.querySelector('.rc-drawer-close').appendChild(createIcon('x'));

    const list = drawer.querySelector('.rc-drawer-list');
    navList.querySelectorAll(':scope > li').forEach((topItem, index) => {
        list.appendChild(buildDrawerItem(topItem, index));
    });

    if (contactHref) {
        const foot = document.createElement('div');
        foot.className = 'rc-drawer-foot';
        foot.innerHTML = `<a class="rc-drawer-cta" href="${contactHref}">Contact Us</a>`;
        foot.querySelector('a').prepend(createIcon('mail'));
        drawer.appendChild(foot);
    }

    document.body.append(backdrop, drawer);
    return { backdrop, drawer };
}

function initDrawer(navContainer, navList) {
    const { backdrop, drawer } = buildDrawer(navList);

    const menuToggle = document.createElement('button');
    menuToggle.type = 'button';
    menuToggle.className = 'rc-nav-toggle';
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-controls', drawer.id);
    menuToggle.setAttribute('aria-label', 'Open menu');
    menuToggle.appendChild(createIcon('menu'));
    navContainer.insertBefore(menuToggle, navList);

    const isOpen = () => drawer.classList.contains('is-open');

    const open = () => {
        drawer.inert = false;
        drawer.classList.add('is-open');
        backdrop.classList.add('is-open');
        document.documentElement.classList.add('rc-drawer-open');
        menuToggle.setAttribute('aria-expanded', 'true');
        drawer.querySelector('.rc-drawer-close').focus({ preventScroll: true });
    };

    const close = ({ restoreFocus = true } = {}) => {
        if (!isOpen()) {
            return;
        }
        drawer.style.transform = '';
        drawer.classList.remove('is-open');
        backdrop.classList.remove('is-open');
        document.documentElement.classList.remove('rc-drawer-open');
        menuToggle.setAttribute('aria-expanded', 'false');
        drawer.inert = true;
        if (restoreFocus) {
            menuToggle.focus({ preventScroll: true });
        }
    };

    menuToggle.addEventListener('click', open);
    backdrop.addEventListener('click', () => close());
    drawer.querySelector('.rc-drawer-close').addEventListener('click', () => close());
    drawer.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => close({ restoreFocus: false }));
    });

    // Keep keyboard focus inside the open drawer; Escape closes it
    drawer.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            close();
            return;
        }

        if (event.key !== 'Tab') {
            return;
        }

        const focusable = [...drawer.querySelectorAll(FOCUSABLE)].filter((el) => !el.closest('[inert]'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    // Swipe right to dismiss
    let touchStartX = null;
    let touchStartY = 0;
    let swipeOffset = 0;

    drawer.addEventListener('touchstart', (event) => {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        swipeOffset = 0;
    }, { passive: true });

    drawer.addEventListener('touchmove', (event) => {
        if (touchStartX === null) {
            return;
        }
        const dx = event.touches[0].clientX - touchStartX;
        const dy = event.touches[0].clientY - touchStartY;

        // Let vertical scrolling win unless the gesture is clearly a horizontal swipe
        if (!swipeOffset && Math.abs(dy) > Math.abs(dx)) {
            touchStartX = null;
            return;
        }

        swipeOffset = Math.max(dx, 0);
        drawer.classList.add('is-dragging');
        drawer.style.transform = `translateX(${swipeOffset}px)`;
    }, { passive: true });

    drawer.addEventListener('touchend', () => {
        drawer.classList.remove('is-dragging');
        drawer.style.transform = '';
        if (swipeOffset > SWIPE_CLOSE_DISTANCE) {
            close();
        }
        touchStartX = null;
        swipeOffset = 0;
    });

    window.matchMedia(MOBILE_QUERY).addEventListener('change', (event) => {
        if (!event.matches) {
            close({ restoreFocus: false });
        }
    });
}

export function initNavigation() {
    const nav = document.querySelector('header nav');
    const navContainer = nav?.querySelector(':scope > div');
    const navList = navContainer?.querySelector(':scope > ul');

    if (!navList) {
        return;
    }

    nav.classList.add('nav-enhanced');
    navList.classList.add('js-nav-list');

    initDesktopDropdowns(nav, navList);
    initDrawer(navContainer, navList);
}
