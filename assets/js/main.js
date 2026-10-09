import { initCookieConsent } from './consent.js';
import { initNavigation } from './nav.js';
import { initHero } from './hero.js';
import { initForms } from './forms.js';
import { initLazyLoading } from './lazyload.js';
import { initIcons } from './icons.js';
import { initNews } from './news.js';

window.addEventListener('DOMContentLoaded', async () => {
    initCookieConsent();
    initNavigation();
    initHero();
    initForms();
    initLazyLoading();
    await initNews();
    await initIcons();
});
