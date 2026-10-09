// Shows a month strip and the next meeting date for each chapter, worked out from its usual pattern.
//
// Each chapter <li> carries:
//   data-schedule="3wed:3,9,11"        nth weekday : months (n = -1 for the last one in the month)
//   data-schedule="4wed:1;4fri:3"      several patterns joined with ";"
//   data-install="11"                  month of the Installation meeting
// The written sentence on the page stays as the fallback without JavaScript.

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export function parseSchedule(schedule) {
    return schedule.split(';').flatMap((rule) => {
        const [, n, day, months] = rule.trim().match(/^(-?\d)([a-z]{3}):([\d,]+)$/) || [];
        if (!n || !DAYS.includes(day)) {
            console.warn(`Ignoring meeting rule "${rule}"`);
            return [];
        }
        return months.split(',').map((month) => ({ n: Number(n), day: DAYS.indexOf(day), month: Number(month) }));
    });
}

// Date of the nth weekday (n = -1 for last) in a month (1-12)
function nthWeekday(year, month, n, day) {
    if (n < 0) {
        const last = new Date(year, month, 0);
        last.setDate(last.getDate() - ((last.getDay() - day + 7) % 7));
        return last;
    }
    const first = new Date(year, month - 1, 1);
    return new Date(year, month - 1, 1 + ((day - first.getDay() + 7) % 7) + (n - 1) * 7);
}

export function nextMeeting(meetings, today) {
    return [today.getFullYear(), today.getFullYear() + 1]
        .flatMap((year) => meetings.map(({ n, day, month }) => nthWeekday(year, month, n, day)))
        .filter((date) => date >= today)
        .sort((a, b) => a - b)[0];
}

function buildStrip(meetingMonths, installMonth) {
    const strip = document.createElement('ol');
    strip.className = 'rc-months';
    strip.setAttribute('aria-hidden', 'true');
    MONTH_LETTERS.forEach((letter, index) => {
        const cell = document.createElement('li');
        cell.textContent = letter;
        if (index + 1 === installMonth) {
            cell.className = 'is-install';
        } else if (meetingMonths.has(index + 1)) {
            cell.className = 'is-on';
        }
        strip.appendChild(cell);
    });
    return strip;
}

function buildNextLine(date, isInstall, today) {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    if (date.getFullYear() !== today.getFullYear()) {
        options.year = 'numeric';
    }
    const when = date.toLocaleDateString('en-GB', options).replace(',', '');

    const line = document.createElement('p');
    line.className = 'rc-next-meeting';
    line.textContent = `Next meeting: ${date.getTime() === today.getTime() ? `today, ${when}` : when}`;
    if (isInstall) {
        const tag = document.createElement('span');
        tag.className = 'rc-next-meeting-install';
        tag.textContent = ' · Installation';
        line.appendChild(tag);
    }
    return line;
}

function buildLegend(eventsHref) {
    const legend = document.createElement('div');
    legend.className = 'rc-months-legend';
    legend.innerHTML = `
        <p class="rc-months-key" aria-hidden="true">
            <span><i class="is-on"></i>Meeting month</span>
            <span><i class="is-install"></i>Installation meeting</span>
        </p>
        <p class="rc-months-note">
            Next meeting dates follow each Chapter's usual pattern and may occasionally change.
            ${eventsHref ? `See <a href="${eventsHref}" class="text-[#6b1a1a] hover:underline font-semibold">Meetings &amp; Events</a> for confirmed dates.` : ''}
        </p>
    `;
    return legend;
}

export function initChapterSchedule() {
    const lists = document.querySelectorAll('[data-chapter-list]');
    if (!lists.length) {
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    lists.forEach((list) => {
        const chapters = list.querySelectorAll('li[data-schedule]');
        if (!chapters.length) {
            return;
        }

        list.before(buildLegend(list.dataset.eventsHref));

        chapters.forEach((chapter) => {
            const meetings = parseSchedule(chapter.dataset.schedule);
            if (!meetings.length) {
                return;
            }
            const installMonth = Number(chapter.dataset.install) || 0;
            const sentence = chapter.querySelector('div');

            chapter.insertBefore(buildStrip(new Set(meetings.map(({ month }) => month)), installMonth), sentence);

            const date = nextMeeting(meetings, today);
            if (date) {
                chapter.appendChild(buildNextLine(date, date.getMonth() + 1 === installMonth, today));
            }
        });
    });
}
