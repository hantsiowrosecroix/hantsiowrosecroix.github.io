// Fades content blocks up into place as they scroll into view, and draws the
// rule under section headings. Content already on screen at load is left alone,
// and nothing happens for visitors who prefer reduced motion.

const BLOCKS = [
    'h1', 'h2', 'h3', 'p', 'ul', 'ol', 'figure', 'table', 'form', 'blockquote',
    '.rc-card', '.rc-chapter-filter', '[class*="border-l-4"]', '[class*="bg-[#f5f5f0]"]',
].join(', ');
const RULED_HEADING = 'h3.border-b-2';
const STAGGER_MS = 70;
const MAX_STAGGER_STEPS = 5;

export function initReveal() {
    const main = document.querySelector('main');

    if (!main || !('IntersectionObserver' in window)
        || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
    }

    // Only animate the outermost block, so a card fades as one rather than line by line
    const candidates = [...main.querySelectorAll(BLOCKS)];
    const blocks = candidates.filter((el) => !candidates.some((other) => other !== el && other.contains(el)));

    const foldLine = window.innerHeight;
    const pending = blocks.filter((el) => el.getBoundingClientRect().top > foldLine);

    if (!pending.length) {
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        const entering = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);

        // Blocks arriving together appear one after another, top to bottom
        entering
            .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
            .forEach((el, index) => {
                el.style.setProperty('--rc-reveal-delay', `${Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS}ms`);
                el.classList.add('is-revealed');
                observer.unobserve(el);
                // Hand back to the element's own transitions (such as a card's hover lift) once faded in
                el.addEventListener('transitionend', function done(event) {
                    if (event.target === el && event.propertyName === 'opacity') {
                        el.classList.remove('rc-reveal');
                        el.style.removeProperty('--rc-reveal-delay');
                        el.removeEventListener('transitionend', done);
                    }
                });
            });
    }, { rootMargin: '0px 0px -8% 0px' });

    pending.forEach((el) => {
        el.classList.add('rc-reveal');
        if (el.matches(RULED_HEADING)) {
            el.classList.add('rc-rule-draw');
        }
        observer.observe(el);
    });
}
