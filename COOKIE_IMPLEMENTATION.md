# Cookie consent implementation guide

How to build your own cookie consent, without a third-party consent platform, for a UK website. The examples use React and Next.js, but the rules and structure apply to any framework.

> This guide reflects a reading of UK GDPR, PECR and the ICO's guidance on storage and access technologies. It is not legal advice. Check the current ICO guidance before deciding what needs consent.

## Summary

- A consent panel opens on a visitor's first visit. On desktop it slides in from the side; on phones it is a bottom sheet.
- There are two categories:
  - **Necessary** is always on: security, payments, sign-in.
  - **Statistics and analytics** is off until the visitor switches it on.
- Optional scripts don't load at all without consent. When consent is withdrawn, they stop sending data and their cookies are deleted.
- The choice is stored in the visitor's browser. Visitors are asked again after 12 months, or when the categories change.
- Visitors can change their choice at any time from a **Cookie settings** link in the site footer and in the privacy policy.

## Categorise every cookie and script

List everything that sets cookies, reads browser storage, or reads device information. That includes third-party scripts and widgets. Put each one in a category:

| Category                 | Typical examples                                                                                      | Consent needed? | Why                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------ |
| Necessary                | CDN or bot protection (for example Cloudflare's `__cf_bm`, and `cf_clearance` after a security check) | No              | Strictly necessary to protect the site                       |
| Necessary                | A payment provider's SDK (for example PayPal), loaded only at checkout                                | No              | Strictly necessary for a payment the visitor asked for       |
| Necessary                | Your own sign-in session, form drafts, the stored consent choice                                      | No              | Needed for the site to work, and not used for tracking       |
| Statistics and analytics | Google Analytics (`_ga`, `_ga_<id>`, up to 2 years) and similar                                       | **Yes, opt-in** | Analytics is never "strictly necessary" under ICO guidance   |
| Marketing / advertising  | Ad pixels, remarketing, social embeds that track                                                      | **Yes, opt-in** | Not covered by this guide; it needs stronger consent records |

**"Necessary" means strictly necessary for something the visitor asked for.** A payment SDK only counts as necessary where payment happens, so load it at checkout rather than on every page.

**The analytics exemption.** The Data (Use and Access) Act 2025 added a PECR exemption for analytics that only serves the site's own statistics, provided visitors get clear information and an easy opt-out. Third-party tools such as Google Analytics may use the data for their own purposes, so whether they qualify is unclear. Opt-in consent is the unambiguously compliant choice. Don't switch analytics on by default without legal advice.

## Rules the UI must keep

These follow ICO guidance. Do not change them without a legal review.

1. **No pre-ticked toggles.** Optional categories start off for every new visitor. A default "on" is not valid consent (the _Planet49_ ruling).
2. **Rejecting must be at least as easy as accepting.** "Reject all" is one tap, and must never be smaller, greyer or further away than "Accept all". Making accepting slightly _less_ prominent is allowed.
3. **Closing is not consent.** Dismissing the panel leaves optional categories off and stores nothing, so the visitor is asked again on the next page load.
4. **Nothing optional loads before consent.** Optional scripts must not be in the HTML template, the document head or a page component. Load them only through the consent provider.
5. **Withdrawing must be as easy as giving consent.** "Cookie settings" has to stay reachable from every page's footer and from the privacy policy.
6. **Name the third parties.** Name each provider in the panel (for example "Google Analytics", not "an analytics platform"). The ICO expects visitors to know who they are consenting to.

## Design principles

The consent UI is part of the site, not a bolted-on widget, so build it from the site's own design system:

- **Use the site's components.**
  - The panel: your existing drawer, modal or bottom-sheet component.
  - The actions: your standard primary and secondary buttons.
  - Closing: your existing close button and sheet handle.
  - The toggles: your UI library's switch, rendered inside the app's theme provider.
  - Don't create one-off buttons or modals just for consent.
- **Use the site's theme and branding.** Use your theme's colours and fonts, and the same spacing, corner radius and shadows as your other panels. Don't use a consent platform's default styling, logo or "powered by" badge.
- **Match the behaviour of other panels.** The consent panel should behave like the rest of the site, so build it on the same component. It should have:
  - a backdrop;
  - Escape to close;
  - focus trapping, with focus returning to where it was;
  - reduced-motion support;
  - on phones, a bottom sheet with a drag handle.
- **Keep to the site's tone of voice.** Use plain English in the same voice as the rest of the site, not legal boilerplate.
- **Branding never overrides the rules above.** Theme colours mustn't make "Reject all" look disabled, greyed out or secondary next to "Accept all".

## User experience

**First visit.** The panel opens automatically on whichever page the visitor lands on.

**Layout.**

- **Header:** a title ("Cookie settings"), a one-line subtitle, and a close button on desktop (phones use the sheet handle instead).
- **Intro:** a short explanation that necessary cookies are always on and that the visitor can change their choice later.
- **One card per category.** Each card has a title, a switch and a plain-English description naming the providers. The Necessary card's switch is checked, disabled and labelled "Always on".
- **Actions:**
  - Desktop: "Reject all" and "Save my choices" side by side in the primary style, with "Accept all" below in the secondary style.
  - Phones: the three stacked in the order Reject, Save, Accept.
- **A link to the privacy policy's cookie section.**

**Actions:**

| Action                                                               | Result                                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Reject all                                                           | All optional categories are saved as off                                                        |
| Save my choices                                                      | Saves whatever the switches are set to                                                          |
| Accept all                                                           | All optional categories are saved as on, and their scripts load straight away                   |
| Close: ×, backdrop, Escape, swipe down, or following the policy link | Nothing is saved. Optional categories stay off, and the panel opens again on the next page load |

**Returning visitor.** The stored choice is applied silently and the panel does not open.

**Changing their mind.** "Cookie settings" reopens the panel, with the switches showing the current choice.

## Architecture

```
App root
└─ Theme provider
   └─ CookieConsentProvider        reads/stores the choice, opens the panel, loads or stops optional scripts
      ├─ the rest of the app
      ├─ <CookieConsent />         the panel, built on the site's drawer/sheet component
      └─ optional <Script>s        rendered only while their category is on
```

- **Put the provider at the app root**, so the panel can open on any page and the footer link works everywhere.
- **Put it inside the theme provider**, so the switches and buttons pick up your theme.

### The consent hook

```ts
const {analytics, openSettings} = useCookieConsent()
```

- `analytics` (boolean): gate every optional script or feature on it.
- `openSettings()`: opens the panel, from the footer or the privacy policy.

### Storing the choice

Store the choice in `localStorage` as a small versioned record:

```json
{"version": 1, "analytics": true, "decidedAt": 1791298162175}
```

Treat the stored choice as missing, and open the panel again, when:

- the value is missing or invalid;
- `version` doesn't match the current consent version (bump it whenever the categories or what they cover change);
- it is older than 12 months.

Wrap every storage access in `try/catch`. In private windows, or when site data is blocked, the choice then lasts for that visit only and the site still works.

### Loading and stopping an analytics script (Google Analytics example)

**On consent,** render the tag only while `analytics` is true:

```tsx
{
  analytics && (
    <>
      <Script
        id="ga-load"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <Script id="ga-config" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_MEASUREMENT_ID}');`}
      </Script>
    </>
  )
}
```

**On refusal or withdrawal:**

- Set Google's documented opt-out flag, `window['ga-disable-<MEASUREMENT_ID>'] = true`. It stops an already-loaded script from sending anything.
- Delete `_ga`, `_ga_*`, `_gid` and `_gat`. GA sets them on the top-level domain, so expire each one on the host and on every parent domain:

```ts
const names = document.cookie
  .split(';')
  .map(cookie => cookie.split('=')[0].trim())
  .filter(name => /^_g(a|id|at)(_|$)/.test(name))
const parts = window.location.hostname.split('.')
names.forEach(name => {
  document.cookie = `${name}=; Max-Age=0; path=/`
  for (let i = 0; i < parts.length - 1; i++) {
    document.cookie = `${name}=; Max-Age=0; path=/; domain=.${parts
      .slice(i)
      .join('.')}`
  }
})
```

**Only clear cookies once the stored choice has been read.** If you clear them while the choice is still "unknown", every page load wipes a consenting visitor's `_ga` cookie and every visit looks like a new user. Keep three states: unknown (not read yet), no choice, and a stored choice.

**Clean up on migration.** Visitors with no choice, or who said no, should have any analytics cookies left by a previous setup removed.

### Scope necessary third-party scripts

Load necessary third-party SDKs, such as a payment provider, inside the component that needs them, not at the app root. Their cookies then only appear where they really are necessary, which is what justifies treating them as necessary.

## Privacy policy requirements

The consent panel and the privacy policy must describe the same thing. Whenever the wording changes, update the policy's "last updated" date.

The policy should cover:

- **Lawful basis:** consent for analytics, and how to withdraw it ("Cookie settings").
- **Services you use:** each provider by name and what it receives, including analytics "only if you switch it on".
- **International transfers:** which providers send data abroad (for example to the US) and the safeguard relied on. For the US, that's usually the UK-US data bridge for certified providers, or otherwise the ICO-approved International Data Transfer Agreement or Addendum.
- **A cookies and browser storage section:**
  - Necessary cookies, with links to each provider's privacy policy.
  - Analytics cookies, by name, with their lifetime and the fact that they're deleted on withdrawal.
  - Your own browser storage: key, purpose and when it's cleared. Examples are the sign-in session, remembered email, form drafts, unread markers and the consent choice.
- **A "Cookie settings" link** that opens the panel.

## Adding a new third-party script or cookie

1. Decide its category: is it **strictly necessary** for something the visitor asked for, or optional?
2. **If it's optional:**
   - Gate it on the consent hook. If it doesn't fit an existing category, add a new one: a new field in the stored record, a new switch, and new copy.
   - Never load it unconditionally.
   - Delete its cookies on withdrawal.
3. **If it's necessary:** load it only where it's needed, and describe it in the Necessary card.
4. Bump the consent version if the categories or what they cover change, so everyone is asked again.
5. Update the panel copy and the privacy policy (services, transfers, cookies section), plus the "last updated" date.

## Testing checklist

Clear the stored choice and the site's cookies first.

- [ ] First visit to any page: the panel opens (side drawer on desktop, bottom sheet with a handle at phone width).
- [ ] Before choosing, no analytics script is in the DOM and no analytics cookies exist.
- [ ] **Accept all:** the stored record has `analytics: true`, the script loads and its cookies appear.
- [ ] Reload: the panel stays closed and the analytics cookie value is unchanged.
- [ ] **Cookie settings** from the footer: the switch shows "on". Switch it off and **Save my choices**: the cookies are deleted and the opt-out flag is set.
- [ ] **Reject all:** no analytics script and no analytics cookies.
- [ ] Close without choosing (×, backdrop, Escape, swipe down): nothing is stored, and the panel opens again on reload.
- [ ] On phones, the buttons are stacked as Reject, Save, Accept.
- [ ] Necessary third-party SDKs only load on the pages that need them, and still work there.
- [ ] The privacy policy's "Cookie settings" link opens the panel.
- [ ] Keyboard only: focus moves into the panel, Escape closes it, and focus returns to where it was.

## Settings outside the code

- **Google Analytics admin:**
  - Google Signals: off.
  - Ad personalisation: off.
  - Data-sharing settings: off.
  - Data retention: set to 2 or 14 months.
- **CDN or bot protection (for example Cloudflare):** if a bot protection feature such as Bot Fight Mode is on, its security cookies need listing as necessary. Check that the cookie lifetimes in the policy match the "Challenge Passage" setting.
- **Previous consent platform:** remove its script, cancel the subscription and remove the domain there. Its leftover cookie on visitors' devices is harmless.

## Known limitations

- **Consent is only recorded in the visitor's browser.** You can't prove that a particular person consented. That is acceptable for analytics-only consent, but add a server-side consent record before introducing advertising or marketing cookies.
- **Manual testing.** Unless you add automated tests for the consent provider, the checklist above is the regression test.
