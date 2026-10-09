# Rose Croix Hampshire / IoW Wessex (Static Site)

This repository now contains a **static multi-page website** built with:

- HTML
- CSS
- Vanilla JavaScript

The previous React/Vite application has been decommissioned and removed.

## Project structure

- Root HTML pages (for example Home, Events, Contact, District pages)
- [about-the-order/](about-the-order/) subpages
- [assets/css/styles.css](assets/css/styles.css)
- [assets/js/main.js](assets/js/main.js) and supporting modules

## Running locally

No build step or package install is required.

Open [index.html](index.html) directly in a browser, or serve the folder with any static file server.

## Notes

- Navigation, dropdowns, mobile menu, form validation, and lazy-loading are implemented in vanilla JavaScript.
- Styling is in [assets/css/styles.css](assets/css/styles.css).

## Updating district officers

Names, ranks and titles of the Inspectors General and District Recorders live in [assets/js/officers.js](assets/js/officers.js). Edit them there and every page picks up the change. Each page also contains the same text inside its `data-officer` elements as a fallback for visitors without JavaScript; update those too when you can, so the fallback stays current.

## Changing the menu or footer

The site menu and footer are shared by every page. Edit them in [scripts/partials/nav.html](scripts/partials/nav.html) and [scripts/partials/footer.html](scripts/partials/footer.html), then run:

```sh
node scripts/sync-layout.mjs
```

This copies them into each page between the `<!-- shared:nav -->` and `<!-- shared:footer -->` markers, fixing the relative paths for pages in subfolders. Don't edit the menu or footer inside a page directly, as the next sync will overwrite it. Run `node scripts/sync-layout.mjs --check` to list any page that has drifted. No build step is needed to deploy; the pages stay plain HTML.

## Chapter meeting dates

Each chapter on the two chapter pages has its usual meeting pattern on its `<li>`, which the page uses to draw the month strip and work out the next meeting:

```html
<li data-schedule="3wed:3,9,11" data-install="11">Canute Chapter No. 41
```

- `3wed:3,9,11` means the third Wednesday of March, September and November. Use `-1` for the last one in the month (`-1fri:1,4,10`), and join different patterns with `;` (`4wed:1;4fri:3;4thu:9`).
- `data-install` is the month of the Installation meeting.

When a chapter changes its pattern, update both this attribute and the written sentence below it.
