const LUCIDE_CDN_URL = 'https://unpkg.com/lucide@0.487.0/dist/umd/lucide.min.js';

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (window.lucide?.createIcons) {
                resolve();
                return;
            }

            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Icon script failed to load.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.defer = true;
        script.crossOrigin = 'anonymous';

        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener('error', () => reject(new Error('Icon script failed to load.')), { once: true });

        document.head.appendChild(script);
    });
}

export async function initIcons() {
    try {
        if (!window.lucide?.createIcons) {
            await loadScript(LUCIDE_CDN_URL);
        }

        if (window.lucide?.createIcons) {
            window.lucide.createIcons({
                attrs: {
                    width: '18',
                    height: '18',
                    'stroke-width': '1.8',
                },
            });
        }
    } catch (error) {
        console.warn('Icon set could not be initialised, keeping text/SVG fallbacks.', error);
    }
}
