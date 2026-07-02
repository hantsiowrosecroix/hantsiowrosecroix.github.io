import { CLOUDFLARE_PROXY_URL } from './config.js';

const SKELETON_COUNT = 3;

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatNewsDate(item) {
    const month = item.Month ? String(item.Month).trim() : '';
    const year = item.Year ? String(item.Year).trim() : '';
    const fallbackDate = item.Timestamp ? new Date(item.Timestamp) : null;

    if (month && year) {
        return `${month} ${year}`;
    }

    if (fallbackDate instanceof Date && !Number.isNaN(fallbackDate.getTime())) {
        return fallbackDate.toLocaleString('en-GB', {
            month: 'long',
            year: 'numeric'
        });
    }

    return 'Date unavailable';
}

function getSortDate(item) {
    const candidates = [item.Timestamp, item['Expire On']];

    for (const candidate of candidates) {
        const date = new Date(candidate);
        if (!Number.isNaN(date.getTime())) {
            return date;
        }
    }

    return new Date(0);
}

function isExpired(item) {
    const expiryValue = item['Expire On'];
    if (!expiryValue) {
        return false;
    }

    const expiryDate = new Date(expiryValue);
    if (Number.isNaN(expiryDate.getTime())) {
        return false;
    }

    return expiryDate.getTime() < Date.now();
}

function buildSkeletonMarkup() {
    return Array.from({ length: SKELETON_COUNT }, (_, index) => `
        <article class="news-card border-b border-gray-200 pb-8${index === SKELETON_COUNT - 1 ? ' news-card-last' : ''}" aria-hidden="true">
            <div class="news-skeleton news-skeleton-title"></div>
            <div class="news-skeleton news-skeleton-date"></div>
            <div class="news-skeleton news-skeleton-line"></div>
            <div class="news-skeleton news-skeleton-line"></div>
            <div class="news-skeleton news-skeleton-line news-skeleton-line-short"></div>
        </article>
    `).join('');
}

function buildEmptyMarkup(message) {
    return `
        <article class="news-empty">
            <p class="leading-relaxed">${escapeHtml(message)}</p>
        </article>
    `;
}

function buildNewsMarkup(items) {
    return items.map((item, index) => `
        <article class="news-card border-b border-gray-200 pb-8${index === items.length - 1 ? ' news-card-last' : ''}">
            <h4 class="text-2xl mb-2 text-[#6b1a1a]" style="font-family: 'Cinzel', serif;">${escapeHtml(item.Title || 'Untitled news item')}</h4>
            <p class="text-sm text-gray-500 mb-4 italic">${escapeHtml(formatNewsDate(item))}</p>
            <p class="leading-relaxed">${escapeHtml(item.News || 'No content available.')}</p>
        </article>
    `).join('');
}

function renderSection(target, items, emptyMessage) {
    if (!target) {
        return;
    }

    target.innerHTML = items.length ? buildNewsMarkup(items) : buildEmptyMarkup(emptyMessage);
}

function renderSkeletons(latestTarget, oldTarget) {
    const skeletonMarkup = buildSkeletonMarkup();

    if (latestTarget) {
        latestTarget.innerHTML = skeletonMarkup;
    }

    if (oldTarget) {
        oldTarget.innerHTML = skeletonMarkup;
    }
}

export async function initNews() {
    const latestTarget = document.querySelector('[data-news-section="latest"]');
    const oldTarget = document.querySelector('[data-news-section="old"]');

    if (!latestTarget || !oldTarget) {
        return;
    }

    renderSkeletons(latestTarget, oldTarget);

    try {
        const response = await fetch(`${CLOUDFLARE_PROXY_URL}news`, {
            method: 'GET',
            headers: {
                Accept: 'application/json'
            }
        });

        const payload = await response.json();

        if (!response.ok || payload?.ok === false || !Array.isArray(payload?.data)) {
            throw new Error('Unexpected news response');
        }

        const sortedItems = [...payload.data].sort((left, right) => getSortDate(right) - getSortDate(left));
        const latestItems = sortedItems.filter((item) => !isExpired(item));
        const oldItems = sortedItems.filter((item) => isExpired(item));

        renderSection(latestTarget, latestItems, 'There is no current news to display right now.');
        renderSection(oldTarget, oldItems, 'There are no archived news items yet.');
    } catch (error) {
        renderSection(latestTarget, [], 'News could not be loaded at the moment. Please try again later.');
        renderSection(oldTarget, [], 'News could not be loaded at the moment. Please try again later.');
    }
}
