# PageInk: product review

Written after the first complete build. It says what the product is, how well it does the job, what is missing, and what to do next, in that order of honesty.

## 1. What it is

PageInk lets someone mark up a real web page, with an Apple Pencil on an iPad, the way they would mark up paper. The page stays a real page (live text, links, layout) instead of a screenshot, and the marks stay attached to the right words and pictures.

**Who it is for:** people who study, research or shop from web pages and think better with a pen: students, analysts, designers, anyone who screenshots and scribbles today.

**Why it is different from screenshots and from PDF markup:** the page is readable and searchable, reflows to the screen, rotates properly, and marks follow their content. Nothing needs an account.

## 2. What exists today

| Area | State |
|---|---|
| Import by address (plain fetch, rendered-browser fallback, re-capture) and by file | Works on news, reference, shop and bank pages tested |
| Reading: true-size layout, rotation re-flow, lazy images, same-site navigation with Back, dropdowns and FAQs, carousels | Works; tested in Chromium and WebKit |
| Marking: pen, highlighter, eraser, Mark tool (word/sentence/paragraph), notes, margin lane, spotlight, marks panel | Works; marks survive layout changes |
| Library: collections, tags, pins, search, sort, themes, accent colours | Works |
| Data: on-device storage, backup and restore, study sheet export | Works |
| Access: no login, no key for visitors; server limited to calls from the app itself | Works |
| Engineering: 207 unit tests, 86 browser tests on two engines, CI on every push | Green |

## 3. What is missing (in order of how much it matters)

1. **Real iPad testing.** Pencil pressure, palm rejection, pinch zoom and the Safari engine have been tested only in automated browsers. This is the biggest unknown.
2. **Pages are not fully saved.** Only the HTML is stored. Pictures and the site's stylesheets still load from the original site, so a page offline loses its pictures and may lose its styling, and a site that changes or removes a file changes your copy. This contradicts the idea of a durable study copy. Fix: store pictures and styles with the page (the database already has a `blobs` store).
3. **Data lives on one device.** No sync. Clear the browser's data or lose the iPad and the library is gone unless a backup file exists. Fix: optional accounts with encrypted sync, or automatic backup to iCloud Drive through the file picker.
4. **Some sites cannot be imported.** Sites with strong bot protection refuse the server (seen with a large shoe retailer). Only "Import file" works for them, and file imports cannot follow links.
5. **Script-driven features do not work in a copy.** "Load more", live prices, logins, tabs that swap panels. Dropdowns and FAQs are handled; tabs are next.
6. **Paywalls.** A metered paywall shows only its preview. PageInk will not bypass paywalls; subscribers can save the page from their own browser.
7. **Discoverability.** No first-run tour; "Mark vs Read" and "finger browses, Pencil marks" are explained only by a one-time hint.
8. **Search and sharing.** No search across all marks, no PDF export, no share link.
9. **A stale copy is silent.** There is a reload-with-rendering button, but nothing says a saved page is out of date.
10. **Accessibility.** Controls have names and large targets, but VoiceOver, keyboard-only use and Dynamic Type have not been audited.

## 4. Risks

- **Cost abuse.** The server fetches and renders pages for anyone using the app. Rate limits exist, but they are counted per server instance (see SECURITY.md). A determined abuser could still run up usage; the answer is a shared limiter (Upstash) and, if needed, a Vercel spend limit.
- **Being used as a proxy.** Fetching arbitrary public pages for anonymous visitors is what an open proxy does. Guards: same-origin only, public addresses only, size and time caps, no cookies forwarded.
- **Legal.** Saving pages for personal study is ordinary use; republishing them is not. The app does not publish anything. A license for the code has not been chosen yet (see section 6).
- **Platform changes.** Safari's pointer and Pencil behaviour changes between iPadOS versions; the Pencil log (`?debug=1`) exists to diagnose that.

## 5. Recommended next steps

**Now (days)**
1. Run docs/IPAD-CHECKLIST.md on a real iPad and fix what it finds.
2. Save pictures and styles with each page (true offline, durable copies).
3. First-run tour (30 seconds: finger browses, Pencil marks, margin lane).

**Next (weeks)**
4. Tab widgets; whole-section import ("save this site's next 10 pages").
5. Search across all marks and pages; PDF export of a page with its marks.
6. A "this copy is old" badge with one-tap refresh.
7. Shared rate limiter (Upstash) and spend alerts.

**Later**
8. Optional accounts and encrypted sync (Supabase), so the library follows the person across devices.
9. Share a marked-up page by link (read-only).

## 6. Decisions the owner needs to make

- **License.** The repository is public. Without a license, others may read the code but have no right to reuse it. Choose MIT (anyone may reuse), AGPL (reuse only if they also open their changes) or keep it unlicensed.
- **Open access vs a key.** Today anyone who opens the site can import pages (that is the point). If usage or cost becomes a problem, add a free sign-in or a daily quota.
- **Sync.** Build accounts, or stay account-free and invest in automatic file backup.
