// District officers: the one place to update names, ranks and titles.
// Pages mark where each detail goes with data-officer="<district>.<role>" and
// data-officer-field="title" or "name". The HTML holds the same text as a
// fallback for visitors without JavaScript.

export const OFFICERS = {
    solent: {
        inspectorGeneral: { title: 'Inspector General', name: 'David Hannan', degree: 33 },
        recorder: { title: 'District Recorder', name: 'Graham Wisely', degree: 31 },
    },
    wessex: {
        inspectorGeneral: { title: 'Inspector General Designate in Charge', name: 'Charles McGeoch', degree: 33 },
        recorder: { title: 'District Recorder', name: 'Colin Brown', degree: 32 },
    },
};

// 33° members are Very Illustrious; 31° and 32° are Illustrious
function formatName({ name, degree }) {
    const prefix = degree === 33 ? 'V∴Ill∴Bro.' : 'Ill∴Bro.';
    return `${prefix} ${name} ${degree}°`;
}

export function initOfficers() {
    document.querySelectorAll('[data-officer]').forEach((el) => {
        const [district, role] = el.dataset.officer.split('.');
        const officer = OFFICERS[district]?.[role];

        if (!officer) {
            console.warn(`Unknown officer "${el.dataset.officer}"`);
            return;
        }

        el.textContent = el.dataset.officerField === 'title' ? officer.title : formatName(officer);
    });
}
