function isMobileView() {
    return window.matchMedia('(max-width: 900px)').matches;
}

export function initNavigation() {
    const navs = document.querySelectorAll('header nav');

    navs.forEach((nav, navIndex) => {
        const navContainer = nav.querySelector('div');
        const navList = nav.querySelector('ul');

        if (!navContainer || !navList) {
            return;
        }

        nav.classList.add('nav-enhanced');
        navList.classList.add('js-nav-list');

        const menuToggle = document.createElement('button');
        menuToggle.type = 'button';
        menuToggle.className = 'rc-nav-toggle';
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-controls', `rc-nav-list-${navIndex}`);
        menuToggle.setAttribute('aria-label', 'Toggle navigation menu');

        const hamburgerIcon = document.createElement('i');
        hamburgerIcon.setAttribute('data-lucide', 'menu');
        hamburgerIcon.setAttribute('aria-hidden', 'true');
        hamburgerIcon.setAttribute('width', '36');
        hamburgerIcon.setAttribute('height', '36');
        menuToggle.appendChild(hamburgerIcon);

        navList.id = `rc-nav-list-${navIndex}`;
        navContainer.insertBefore(menuToggle, navList);

        menuToggle.addEventListener('click', () => {
            const open = navList.classList.toggle('is-open');
            menuToggle.setAttribute('aria-expanded', String(open));
        });

        const groups = navList.querySelectorAll('li.group');

        groups.forEach((group, groupIndex) => {
            const triggerLink = group.querySelector(':scope > a');
            const submenu = group.querySelector(':scope > ul');

            if (!triggerLink || !submenu) {
                return;
            }

            if (!triggerLink.querySelector(':scope > .rc-nav-link-chevron')) {
                const chevron = document.createElement('i');
                chevron.className = 'rc-nav-link-chevron';
                chevron.setAttribute('data-lucide', 'chevron-down');
                chevron.setAttribute('aria-hidden', 'true');
                triggerLink.appendChild(chevron);
            }

            const submenuId = `rc-submenu-${navIndex}-${groupIndex}`;
            submenu.id = submenuId;

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'rc-submenu-toggle';
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-controls', submenuId);
            toggle.setAttribute('aria-label', `Toggle submenu for ${triggerLink.textContent?.trim() || 'navigation item'}`);
            toggle.innerHTML = '<span aria-hidden="true">▼</span>';

            group.insertBefore(toggle, submenu);

            const closeSubmenu = () => {
                group.classList.remove('is-open');
                toggle.setAttribute('aria-expanded', 'false');
            };

            const openSubmenu = () => {
                group.classList.add('is-open');
                toggle.setAttribute('aria-expanded', 'true');
            };

            toggle.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();

                const isOpen = group.classList.contains('is-open');
                groups.forEach((otherGroup) => {
                    if (otherGroup !== group) {
                        otherGroup.classList.remove('is-open');
                        const otherToggle = otherGroup.querySelector(':scope > .rc-submenu-toggle');
                        if (otherToggle) {
                            otherToggle.setAttribute('aria-expanded', 'false');
                        }
                    }
                });

                if (isOpen) {
                    closeSubmenu();
                } else {
                    openSubmenu();
                }
            });

            triggerLink.addEventListener('focus', () => {
                if (!isMobileView()) {
                    openSubmenu();
                }
            });

            group.addEventListener('mouseleave', () => {
                if (!isMobileView()) {
                    closeSubmenu();
                }
            });
        });

        navList.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                if (isMobileView()) {
                    navList.classList.remove('is-open');
                    menuToggle.setAttribute('aria-expanded', 'false');
                    navList.querySelectorAll('li.group').forEach((group) => {
                        group.classList.remove('is-open');
                        const toggle = group.querySelector(':scope > .rc-submenu-toggle');
                        if (toggle) {
                            toggle.setAttribute('aria-expanded', 'false');
                        }
                    });
                }
            });
        });

        document.addEventListener('click', (event) => {
            if (!nav.contains(event.target)) {
                navList.classList.remove('is-open');
                menuToggle.setAttribute('aria-expanded', 'false');

                navList.querySelectorAll('li.group').forEach((group) => {
                    group.classList.remove('is-open');
                    const toggle = group.querySelector(':scope > .rc-submenu-toggle');
                    if (toggle) {
                        toggle.setAttribute('aria-expanded', 'false');
                    }
                });
            }
        });
    });
}
