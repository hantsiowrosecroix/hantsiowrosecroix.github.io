export function initLazyLoading() {
    const images = document.querySelectorAll('img:not([loading])');

    images.forEach((image) => {
        image.loading = 'lazy';
        image.decoding = 'async';
    });
}
