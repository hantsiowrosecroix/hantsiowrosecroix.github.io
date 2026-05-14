import { initNavigation } from './nav.js';
import { initForms } from './forms.js';
import { initLazyLoading } from './lazyload.js';
import { initIcons } from './icons.js';
import { initNews } from './news.js';

window.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initForms();
    initLazyLoading();
    await initNews();
    await initIcons();
});
