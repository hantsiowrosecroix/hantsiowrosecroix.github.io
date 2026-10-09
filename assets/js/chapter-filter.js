// Adds a "find a chapter" box above a chapter list marked with data-chapter-list.
// Each card is one Masonic centre; its heading is the centre and each <li> is a chapter.

function normalise(text) {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Numbers must match whole ("9" finds No. 9, not No. 294); words can match part of a word
function matchesAll(haystack, tokens) {
    return tokens.every((token) => (/^\d+$/.test(token)
        ? new RegExp(`\\b${token}\\b`).test(haystack)
        : haystack.includes(token)));
}

function initList(list, index) {
    const cards = [...list.children].map((card) => {
        const centre = normalise(card.querySelector('h4')?.textContent || '');
        const chapters = [...card.querySelectorAll('li')].map((item) => ({
            item,
            text: `${centre} ${normalise(item.textContent)}`,
        }));
        return { card, chapters };
    });
    const total = cards.reduce((sum, { chapters }) => sum + chapters.length, 0);

    const inputId = `rc-chapter-filter-${index}`;
    const filter = document.createElement('div');
    filter.className = 'rc-chapter-filter form-field';
    filter.innerHTML = `
        <label for="${inputId}">Find a chapter</label>
        <input type="search" id="${inputId}" autocomplete="off" spellcheck="false"
            placeholder="Town, chapter or number">
        <p class="rc-chapter-filter-status" role="status" aria-live="polite"></p>
    `;
    list.before(filter);

    const input = filter.querySelector('input');
    const status = filter.querySelector('.rc-chapter-filter-status');

    const apply = () => {
        const query = input.value.trim();
        const tokens = normalise(query).split(' ').filter(Boolean);
        let shown = 0;

        cards.forEach(({ card, chapters }) => {
            let visibleInCard = 0;
            chapters.forEach(({ item, text }) => {
                const visible = !tokens.length || matchesAll(text, tokens);
                item.hidden = !visible;
                visibleInCard += visible ? 1 : 0;
            });
            card.hidden = visibleInCard === 0;
            shown += visibleInCard;
        });

        if (!tokens.length) {
            status.textContent = '';
        } else if (shown === 0) {
            status.textContent = `No chapters match "${query}". Try a town, centre, chapter name or number.`;
        } else {
            status.textContent = `Showing ${shown} of ${total} chapters`;
        }
    };

    input.addEventListener('input', apply);
}

export function initChapterFilter() {
    document.querySelectorAll('[data-chapter-list]').forEach(initList);
}
