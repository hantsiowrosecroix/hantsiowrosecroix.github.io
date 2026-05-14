import { initNavigation } from './nav.js';
import { initForms } from './forms.js';
import { initLazyLoading } from './lazyload.js';
import { initIcons } from './icons.js';

window.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initForms();
    initLazyLoading();
    await initIcons();
});
