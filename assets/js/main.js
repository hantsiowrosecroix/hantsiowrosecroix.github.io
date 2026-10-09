import { initCookieConsent } from './consent.js';
import { initNavigation } from './nav.js';
import { initOfficers } from './officers.js';
import { initHero } from './hero.js';
import { initForms } from './forms.js';
import { initLazyLoading } from './lazyload.js';
import { initIcons } from './icons.js';
import { initNews } from './news.js';

// Module scripts run after the page is parsed, so fill officer names straight away to avoid a flash
initOfficers();

window.addEventListener('DOMContentLoaded', () => {
    initCookieConsent();
    initNavigation();
    initHero();
    initForms();
    initLazyLoading();
    // Run side by side so icons don't wait for the news request
    initIcons();
    initNews();
});
