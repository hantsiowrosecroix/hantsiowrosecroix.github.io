import { CLOUDFLARE_PROXY_URL } from './config.js';

const SKELETON_COUNT = 3;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function renderNewsBody(value) {
    const text = String(value ?? '');
    const parts = text.split(/(https?:\/\/[^\s<]+)/g);

    return parts.map((part) => {
        if (/^https?:\/\/[^\s<]+$/.test(part)) {
            const safeUrl = escapeHtml(part);
            return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-[#6b1a1a] hover:underline font-semibold break-words">${safeUrl}</a>`;
        }

        return escapeHtml(part);
    }).join('');
}

function parseTimestamp(value) {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
        return null;
    }

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateOnly(value, endOfDay = false) {
    const normalized = String(value ?? '').trim();
    const match = normalized.match(DATE_ONLY_PATTERN);

    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const parsed = endOfDay
        ? new Date(year, monthIndex, day, 23, 59, 59, 999)
        : new Date(year, monthIndex, day, 0, 0, 0, 0);

    if (
        parsed.getFullYear() !== year
        || parsed.getMonth() !== monthIndex
        || parsed.getDate() !== day
    ) {
        return null;
    }

    return parsed;
}

function getExpiryDate(item) {
    return parseDateOnly(item.expire_on, true) || parseTimestamp(item.expire_on);
}

function formatNewsDate(item) {
    const month = String(item.month ?? '').trim();
    const year = item.year === null || item.year === undefined ? '' : String(item.year).trim();
    const fallbackDate = parseTimestamp(item.timestamp);

    if (month && year) {
        return `${month} ${year}`;
    }

    if (fallbackDate) {
        return fallbackDate.toLocaleString('en-GB', {
            month: 'long',
            year: 'numeric'
        });
    }

    return 'Date unavailable';
}

function getSortDate(item) {
    return parseTimestamp(item.timestamp)
        || parseDateOnly(item.expire_on)
        || getExpiryDate(item)
        || new Date(0);
}

function isExpired(item) {
    const expiryDate = getExpiryDate(item);
    if (!expiryDate) {
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
        <article class="news-card border-b border-gray-200 pb-8${index === items.length - 1 ? ' news-card-last' : ''}" data-news-id="${escapeHtml(item.id || '')}">
            <h4 class="text-2xl mb-2 text-[#6b1a1a]" style="font-family: 'Cinzel', serif;">${escapeHtml(item.title || 'Untitled news item')}</h4>
            <p class="text-sm text-gray-500 mb-4 italic">${escapeHtml(formatNewsDate(item))}</p>
            <p class="leading-relaxed whitespace-pre-line">${renderNewsBody(item.news || 'No content available.')}</p>
        </article>
    `).join('');
}

function normalizeNewsItems(items) {
    return items
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
            id: String(item.id ?? '').trim(),
            timestamp: String(item.timestamp ?? '').trim(),
            title: String(item.title ?? '').trim(),
            month: String(item.month ?? '').trim(),
            year: item.year,
            expire_on: String(item.expire_on ?? '').trim(),
            news: String(item.news ?? '').trim()
        }));
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

        const newsItems = normalizeNewsItems(payload.data);
        const sortedItems = [...newsItems].sort((left, right) => getSortDate(right) - getSortDate(left));
        const latestItems = sortedItems.filter((item) => !isExpired(item));
        const oldItems = sortedItems.filter((item) => isExpired(item));

        renderSection(latestTarget, latestItems, 'There is no current news to display right now.');
        renderSection(oldTarget, oldItems, 'There are no archived news items yet.');
    } catch (error) {
        renderSection(latestTarget, [], 'News could not be loaded at the moment. Please try again later.');
        renderSection(oldTarget, [], 'News could not be loaded at the moment. Please try again later.');
    }
}
