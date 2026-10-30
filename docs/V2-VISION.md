# PageInk Version 2: Vision and Strategy (2026 to 2036)

Written 30 October 2026, on branch `v2`. Version 1.0.0 is frozen (tag `v1.0.0`, branch `v1-stable`, production `main`). This document says where PageInk should go over the next ten years and why. The step-by-step build plan for the first part is in [V2-EXECUTION-PLAN.md](V2-EXECUTION-PLAN.md).

How to read the evidence labels: **Evidence** means a cited source says it. **Likely** means several signals point that way. **Speculation** means it is our bet, not a fact. Prices and dates from review sites can be wrong; they are marked "secondary".

---

## 1. The vision on one page

**PageInk is a pen for the web, and a memory for what you read.**

Today the web is something you look at and then lose. Pages change, move behind paywalls or disappear: Pew Research found that 38% of web pages from 2013 could no longer be reached ten years later ([Pew, 2024](https://www.pewresearch.org/data-labs/2024/05/17/when-online-content-disappears/)). Screenshots lose the text. Bookmarks lose the page. AI chat tools summarise pages but forget what *you* thought about them.

PageInk keeps a **complete, durable copy** of any page you care about, lets you **think on it with a pen** the way you would on paper, and turns your marks into a **personal memory** you can search, review, export and (if you want) ask an AI about. Your copy and your marks belong to you, live on your devices first, and use open formats so they will still open in 2036 even if PageInk does not exist.

**In ten years, success looks like this:** a student, a lawyer, a shopper and a teacher all open PageInk every day. They use it on an iPad with a Pencil, on a phone with a finger, on a laptop with a mouse, and perhaps in a headset. They save pages from wherever they are reading, their marks stay attached to the right words even after a page changes, they can find anything they ever marked in a second, and they trust PageInk because it never sells, leaks or locks up their data.

**The three bets that matter most:**
1. **Durable copies.** Every saved page is complete (text, pictures, styles, fonts) and readable offline forever, in a portable archive format.
2. **Pen-native, meaning-aware marks.** Ink and highlights that stay on the right words through layout changes. This is hard engineering that v1 already does and others mostly do not.
3. **Your marks become your memory.** Search, review, export and optional AI that answers from *your* highlights and cites them, running on the device when possible.

---

## 2. Principles (the rules that stay true for ten years)

These are deliberately boring. Boring rules age well.

1. **Your data is yours.** Everything works with no account. Export is always complete, free and in open formats. We never hold data hostage, not even for paying users who stop paying.
2. **Local first, cloud optional.** The device is the source of truth. A server may help (fetching, syncing, sharing) but the app must keep working when the server is gone. *Local-first* means: your library lives on your device and syncs between your devices, instead of living on our server.
3. **Untrusted pages never run code.** Every imported page is treated as hostile. No feature may weaken the sandbox or the server's protections in [SECURITY.md](../SECURITY.md).
4. **Marks follow meaning, not pixels.** A mark is attached to words or an element, with a position only as a fallback, so it survives layout changes, new devices and new page versions.
5. **Pen first, but never pen only.** The iPad and Pencil set the quality bar. Every feature must also work with a finger, a mouse, a keyboard and a screen reader.
6. **AI is a guest, not the host.** AI features are optional, clearly labelled, cite their sources (your marks or the page), and prefer on-device models. The product must be excellent with AI switched off.
7. **Open formats over clever formats.** Store and export in standards: W3C Web Annotations for marks, ZIP-based archives (WACZ-compatible where we can) for pages, Markdown for notes, PDF for printing.
8. **Respect publishers.** We save pages for personal use, never bypass paywalls or logins, and never republish someone else's page publicly.
9. **Small, tested steps.** Every change keeps all tests green and v1 behaviour working. No big rewrites.
10. **Plain language.** Every screen and document can be understood by someone who is not a developer.

---

## 3. The people we serve

PageInk should be universal, but it wins one group at a time. The **first circle** is the people v1 already fits (pen users who study and research). The **second circle** joins once pages are durable, searchable and shareable. The **third circle** needs collaboration, institutions or new devices.

| Persona | Circle | Job to be done ("When I..., I want to..., so I can...") | What PageInk must do for them |
|---|---|---|---|
| **Student** (secondary school to university) | 1 | When I study from web articles and course pages, I want to highlight and write in the margin like on paper, so I can revise and quote later. | Pencil ink, meanings (Important, Question), study sheet, search across everything, print/PDF to hand in, works offline in class. |
| **Researcher / analyst / journalist** | 1 | When I gather sources, I want an exact copy of what the page said on the day I read it, so I can cite it and prove it. | Complete archives with capture date, page history and "what changed", W3C annotation export, citation-ready quotes. |
| **Designer / UX reviewer / marketer** | 1 | When I review a competitor's or client's site, I want to draw on the real page and send my feedback, so I don't paste screenshots into slides. | Ink on real layouts at phone/tablet/desktop widths, PDF export, share a marked copy with a client. |
| **Shopper and travel planner** | 2 | When I compare products, hotels or routes across sites, I want to save the pages and circle what matters, so I can decide later (and on my phone). | Fast capture from any browser, phone-friendly reading, collections, "this price page is 9 days old" badges. |
| **Professional reader** (lawyer, compliance, auditor, policy) | 2 | When a web page is evidence or a rule I must follow, I want a tamper-evident, dated copy with my notes, so I can rely on it later. | Signed, timestamped archives (H3), exact page history, export to standard archive formats, privacy (nothing on our servers). |
| **Teacher** | 3 | When I assign web reading, I want to mark it up once and share it with the class, and see their questions, so reading becomes discussion. | Read-only share links (H2), class collections and shared notes (H3), works on cheap tablets and Chromebooks. |
| **Accessibility user** (low vision, dyslexia, motor or screen reader) | all | When pages are cluttered or small, I want to enlarge, simplify and listen, and mark without fine motor control. | Full screen-reader support, large text and reading view, read aloud (system voices), Mark tool snapping to words and sentences (already built). |
| **Non-English reader** | all | When I read in a second language, I want to translate and look up words without losing my marks, so I can learn. | Translated interface, right-to-left support, on-device translation of a selection (H2), marks that anchor in any script. |

---

## 4. Market and trends

### 4.1 Competitive landscape

| Category | Examples | What they do well | What they miss (our opening) | Confidence |
|---|---|---|---|---|
| Read-it-later | Instapaper, Matter, Readwise Reader, Raindrop, GoodLinks | Fast saving, clean reading view, highlight sync to note apps | Strip the page to plain text (layout and pictures of a shop or a design are lost); no real pen; cloud-first. Pocket, one of the biggest, was shut down by Mozilla in July 2025 ([Engadget](https://engadget.com/apps/mozilla-is-shutting-down-its-read-it-later-app-pocket-183247576.html)), which shows the risk of cloud-only libraries. | Evidence |
| Web annotation | Hypothesis, Liner, Glasp, web-highlights | Highlights on the live page, often social | Annotations break when the page changes or disappears; no durable copy. Hypothesis restricted its proxy (Via) to partner sites in early 2026 ([LAVX news, secondary](https://news.lavx.hu/article/hypothesis-restricts-access-to-via-proxy-server-shifting-focus-to-partnership-model)), which shows how expensive it is to proxy the web for free. Liner has moved toward AI search ([PricingSaaS](https://pricingsaas.com/companies/liner)). | Evidence (secondary) |
| Clippers | Notion and Obsidian Web Clipper, Evernote | Send page content into a notes system; Obsidian's clipper is open source and writes Markdown ([Firefox Add-ons](https://addons.mozilla.org/addon/web-clipper-obsidian/)) | Desktop browser extensions; no pen; content becomes a note, not a faithful page. | Evidence |
| Archiving | SingleFile, ArchiveBox, Webrecorder (ArchiveWeb.page, WACZ) | Faithful, complete copies; open formats ([SingleFile](https://github.com/gildas-lormeau/SingleFile), [WACZ spec](https://specs.webrecorder.net/wacz/1.2.0/)) | Built for archivists and power users; no reading or marking experience; not tablet-friendly. | Evidence |
| Handwriting notes | GoodNotes, Notability, Apple Notes, Freeform, OneNote, Samsung Notes, reMarkable | Superb ink on PDFs and blank pages; GoodNotes is cheap (about $10/year or $30 once, [GoodNotes](https://goodnotes.com/blog/introducing-goodnotes-6)) | Web pages enter only as PDFs or screenshots: links die, text reflow and search across the original are lost, layout is frozen at one width. | Evidence |
| AI research | NotebookLM, Perplexity, ChatGPT and Claude with browsing, Apple Intelligence | Summaries, answers, source finding; NotebookLM now finds sources for you ([Chrome Unboxed](https://chromeunboxed.com/notebooklm-is-getting-the-ability-to-find-sources-for-you-on-the-web/)) | They think for you, not with you. Your own marks and handwriting are not part of the picture; data lives in their cloud. | Evidence |
| AI browsers | Dia (Atlassian bought The Browser Company for about $610M, [BetaNews](https://betanews.com/2025/09/05/atlassian-moves-into-ai-browsers-with-610-million-purchase-of-the-browser-company/)), Comet | AI that reads and acts on the open tab | Small share; serious prompt-injection security problems reported through 2026 ([overview, secondary](https://www.gilricardo.com/blog/comet-vs-atlas-vs-dia-agentic-browser-2026)). Not durable, not pen-first. | Evidence (secondary) |

**What people pay for (evidence, secondary prices):** Readwise Reader about $10 to $13 a month ([Readless](https://www.readless.app/blog/readwise-reader-pricing-2026)); Matter Premium about $60 to $80 a year ([Readless](https://www.readless.app/blog/matter-app-pricing-2026)); Raindrop Pro about $28 a year, and its paid tier is exactly "permanent copy plus full-text search" ([Raindrop help](https://help.raindrop.io/permanent-copy), [ContextBolt](https://contextbolt.com/blog/raindrop-pricing/)); Liner around $15 a month for AI search. People pay for **permanence, search, sync and AI**. They do not pay for basic highlighting, which is free everywhere.

**What is commoditised:** basic highlighting, generic summaries ("summarise this page" is built into browsers and operating systems), simple bookmarking, and cloud sync of plain text.

**The gap nobody fills:** a **faithful, durable copy of the real page** + **pen-quality marks that stay attached** + **local-first ownership**, on a tablet. GoodNotes has the pen but not the web; Readwise has the reading but not the page or pen; Webrecorder has the archive but not the experience.

### 4.2 Technology trends (5 to 10 years)

| Trend | What we know | What it means for PageInk | Confidence |
|---|---|---|---|
| **On-device AI** | Apple's Foundation Models framework gives native apps a free, private, offline on-device model (about 3 billion parameters) on Apple Intelligence devices ([ADTmag](https://adtmag.com/articles/2025/06/10/apple-launches-ondevice-ai-framework-and-tools.aspx)). Chrome ships built-in Summarizer, Translator and Language Detector APIs from Chrome 138 on desktop, not mobile ([Chrome docs](https://developer.chrome.com/docs/ai/built-in-apis), [Translator](https://developer.chrome.com/docs/ai/translator-api)). WebGPU is on by default in Safari 26 on iPadOS ([App Developer Magazine](https://appdevelopermagazine.com/webgpu-in-ios-26/)). | Summaries, tagging, translation and "ask my marks" can run free and private. But on iPad the web page itself has no built-in AI API today, so the best on-device AI on iPad needs a native shell (see Decision 2) or a downloaded WebGPU model. Build one AI interface with interchangeable engines. | Evidence (today), Likely (spread) |
| **AI commoditisation** | Every browser and OS is adding summaries. | Never sell "AI summary" as the product. Sell *your* memory; AI is a feature on top. | Likely |
| **Agents that read pages** | MCP (a standard way for AI assistants to use tools and data) moved to a Linux Foundation fund in December 2025 with OpenAI, Google and Microsoft support ([Linuxiac](https://linuxiac.com/model-context-protocol-joins-linux-foundation-in-major-ai-shift/)). Agentic browsers exist but are insecure against prompt injection. | Let *your* AI assistant read *your* library (with permission) through a standard connector, instead of us building our own agent. Never let page text instruct an AI that can act. | Evidence (MCP), Speculation (how big) |
| **Bot blocking and AI-crawler wars** | Cloudflare (in front of about a fifth of the web) blocks AI crawlers by default since July 2025 and offers pay-per-crawl ([MIT Technology Review](https://www.technologyreview.com/2025/07/01/1119498/cloudflare-will-now-by-default-block-ai-bots-from-crawling-its-clients-websites/)). | Server-side fetching will get *harder* every year. The durable answer is capturing from the user's own browser (what they see, with their consent and login), not a smarter server crawler. | Evidence (trend), Likely (direction) |
| **PWAs on iPad** | iOS/iPadOS 26 open every Home Screen site as a web app by default ([MacRumors](https://www.macrumors.com/2025/06/18/safari-changes-on-ios-26/)). Home Screen web apps get the same large storage quota as Safari (up to about 60% of disk) and are not subject to Safari's 7-day clean-up ([WebKit](https://webkit.org/updates), [MDN](https://developer.mozilla.org/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)). Safari still does **not** support receiving shares into a web app (Web Share Target) ([WebKit bug 194593](https://bugs.webkit.org/show_bug.cgi?id=194593)). | A PWA is good enough to store thousands of complete pages. But "Share to PageInk" from Safari needs a native shell or a Safari extension. | Evidence |
| **Safari extensions on iOS** | Safari Web Extensions run on iOS and iPadOS, shipped inside an App Store app ([Apple](https://developer.apple.com/safari/extensions/), [WWDC21 notes](https://wwdcnotes.com/notes/wwdc21/10104)). | A small native app could add "Save to PageInk" inside Safari, capturing exactly what the user sees. | Evidence |
| **Handwriting** | Scribble converts Pencil handwriting to text in any text field, including in Safari ([Apple WWDC20](https://developer.apple.com/videos/play/wwdc2020/10106)). | Typed note fields get handwriting for free. Searching *ink* needs recognition: on-device in a native shell, or opt-in cloud. | Evidence |
| **Local-first sync** | CRDT libraries matured: Automerge 3 cut memory use dramatically ([Automerge](https://automerge.org/blog/automerge-3/)); Yjs is widely used for collaborative text. *CRDT: a data structure that lets two devices edit offline and merge without conflicts.* | PageInk's records already have IDs, timestamps and soft deletes, so simple record-level sync is enough for one person's devices. Use a CRDT only for co-editing text (collaboration, later). | Evidence |
| **Web archiving standards** | WARC (the archive standard), WACZ (a ZIP package of WARC files plus indexes, replayable in a browser) ([WACZ spec](https://specs.webrecorder.net/wacz/1.2.0/)), MHTML (single-file, Chrome-only), SingleFile HTML. | Store pages in our own simple ZIP archive now, designed so it can be exported as WACZ later. | Evidence |
| **Annotation standards** | The W3C Web Annotation model (2017 Recommendation) defines text-quote selectors (exact text plus prefix and suffix), the same idea v1 already uses ([W3C vocabulary](https://www.w3.org/TR/annotation-vocab/)). | Export marks as W3C Web Annotations, so other tools (Hypothesis-style) and future agents can read them. | Evidence |
| **Accessibility law** | The European Accessibility Act applies to apps and websites sold in the EU from 28 June 2025 ([Pluralsight](https://www.pluralsight.com/resources/blog/software-development/eu-accessiblity-act-2025)). | An accessibility audit is a requirement before any paid EU launch, not a nice-to-have. | Evidence |
| **Devices** | Apple ships about a third of the world's tablets (12.7 million in Q2 2025), Samsung about a fifth ([IDC via GSMArena](https://gsmarena.com/idc_global_tablet_shipments_grow_by_13_in_q2_apple_leads_the_way-news-68970.php)). Pen tablets on Android/Windows, foldables and headsets (visionOS) are growing. | iPad first is right. Android and Windows pen devices are the second market, and a web app reaches them almost free. Spatial computing is an H3/H4 experiment, not a bet. | Evidence (share), Speculation (headsets) |
| **Passkeys** | Passwordless sign-in is now standard on Apple, Google and Microsoft platforms. | If we ever add accounts (for sync), use passkeys only: no passwords to leak. | Likely |

### 4.3 What this tells us

1. **Capture must move to the user's side.** Server fetching will keep losing to bot blocks and costs money. The future is "save what I'm looking at" from the user's own browser.
2. **Durability is the product.** Link rot and the shutdown of cloud services (Pocket) make "your copy, forever, in an open format" a real selling point.
3. **AI is a commodity layer; personal context is not.** The valuable thing is not the summary but the link between AI and *your* marks.
4. **iPad is the right beachhead; the web platform is the right vehicle; a thin native shell is the right add-on** for share sheet, Safari capture and on-device AI.

---

## 5. Brainstorm, scoring and choices

### 5.1 Raw ideas (65)

**Capture:** (1) save pictures, styles and fonts with every page; (2) bookmarklet "Send to PageInk"; (3) Safari Web Extension via a native shell; (4) iOS Share Sheet extension; (5) Chrome/Firefox/Edge extension; (6) import SingleFile HTML; (7) import MHTML and WARC/WACZ; (8) import PDFs as pages; (9) import EPUB; (10) save a whole section of a site; (11) re-capture with history; (12) "what changed" diff; (13) watch a page for changes; (14) email-in address; (15) RSS/newsletter in; (16) YouTube transcript as a page; (17) screenshot fallback for canvas/video; (18) capture a logged-in page from the user's browser.

**Reading:** (19) reading view (simplified text) toggle; (20) clean read, hide layers; (21) read aloud; (22) dark mode for pages; (23) translation of a selection; (24) dictionary lookup; (25) tabs widgets; (26) table of contents from headings; (27) reading progress and time.

**Marking:** (28) lasso select and move ink; (29) shapes and arrows that snap; (30) sticky notes with Scribble; (31) voice notes on a mark; (32) stamps (tick, star); (33) ink recognition to text; (34) handwriting search; (35) link two marks across pages; (36) layer toggles; (37) mark templates (UX audit, legal review).

**Remember:** (38) search across all pages and marks; (39) review queue (spaced repetition of highlights); (40) daily "on this day" resurfacing; (41) export to Obsidian/Notion/Markdown; (42) W3C annotation export; (43) citations (APA/MLA) from a page; (44) knowledge graph of marks; (45) smart collections (rules).

**AI:** (46) explain this selection; (47) summarise my marks; (48) ask my library with citations; (49) auto-tag and auto-collect; (50) flashcards from highlights; (51) handwriting to text; (52) compare two pages; (53) MCP connector so your own AI can read your library.

**Share and collaborate:** (54) PDF/print with marks; (55) read-only share link; (56) share a "marks card" image; (57) class/team collections; (58) live co-marking; (59) teacher view of student questions.

**Platforms:** (60) native iPad shell; (61) Android/Windows pen QA; (62) visionOS; (63) desktop app; (64) e-ink tablets.

**Business and trust:** (65) end-to-end encrypted sync; (66) signed, timestamped evidence archives; (67) plugin system; (68) open-source the core; (69) education licence; (70) public API.

### 5.2 Clusters and scores

Scored 1 to 5 (5 is best; for Effort and Risk, 5 means *low* effort or *low* risk). "Ages well" asks whether it will still matter in 2036.

| Cluster | Ideas | Value | Defensible | Effort | Risk | Ages well | Total | Decision |
|---|---|---|---|---|---|---|---|---|
| Complete, durable pages | 1, 6, 7, 11 | 5 | 4 | 3 | 4 | 5 | **21** | H1 |
| Find anything | 38, 42, 41 | 5 | 3 | 4 | 5 | 5 | **22** | H1 |
| Open export / portable archive | 41, 42, 7 | 4 | 4 | 4 | 5 | 5 | **22** | H1 |
| Print / PDF with marks | 54 | 4 | 2 | 4 | 5 | 4 | **19** | H1 |
| Capture from the user's browser | 2, 3, 4, 5, 18 | 5 | 4 | 2 | 3 | 5 | **19** | H1 (bookmarklet), H2 (native) |
| Freshness and history | 11, 12, 13 | 4 | 4 | 3 | 4 | 4 | **19** | H1 (badge, history), H2 (watch) |
| Clean read, tour, accessibility | 19, 20, 21, 36 | 4 | 2 | 4 | 5 | 5 | **20** | H1 |
| Sync (encrypted, local-first) | 65 | 5 | 3 | 2 | 3 | 5 | **18** | H2 |
| AI on your marks | 46 to 53 | 4 | 3 | 3 | 3 | 3 | **16** | H2, opt-in |
| Native iPad shell | 3, 4, 60 | 4 | 3 | 2 | 3 | 4 | **16** | H2 (owner decision) |
| Share links | 55, 56 | 4 | 2 | 3 | 2 | 4 | **15** | H2 (annotation-first) |
| Handwriting intelligence | 33, 34, 51 | 4 | 4 | 2 | 3 | 4 | **17** | H2 to H3 |
| Review and resurfacing | 39, 40, 50 | 3 | 2 | 4 | 5 | 3 | **17** | H2 |
| Collaboration and classes | 57, 58, 59 | 4 | 3 | 1 | 2 | 4 | **14** | H3 |
| Evidence-grade archives | 66 | 3 | 5 | 3 | 3 | 5 | **19** | H3 (pro tier) |
| Extensions and plugins, MCP | 53, 67, 70 | 3 | 4 | 2 | 3 | 4 | **16** | H3 |
| New media (PDF, EPUB, video) | 8, 9, 16 | 3 | 2 | 2 | 4 | 4 | **15** | H3 |
| Spatial, e-ink | 62, 64 | 2 | 3 | 1 | 2 | 3 | **11** | H4 experiment |
| Email-in, RSS | 14, 15 | 2 | 1 | 3 | 3 | 3 | **12** | Not now |

### 5.3 The five strategic bets

1. **Durable, portable archives.** Every page saved complete, offline, in an open ZIP archive that can be exported as WACZ. *Why durable:* link rot only gets worse; open formats outlive companies.
2. **Capture where the reader is.** Move from "our server fetches it" to "you send what you see", first with a bookmarklet and file import, then a native share extension and Safari extension. *Why durable:* bot blocking and AI-crawler fights make server capture worse every year; user-side capture is cheaper and more respectful of publishers.
3. **Marks that last and connect.** Keep investing in anchoring (it survives layout, device and version changes), export marks as W3C Web Annotations, and make every mark searchable. *Why durable:* this is the hardest thing to copy and the most personal.
4. **Local-first memory with optional encrypted sync.** No account needed; sync is opt-in, end-to-end encrypted, and paid. *Why durable:* privacy rules and user distrust of clouds only grow; it also keeps server costs tiny.
5. **AI as a pluggable guest.** One interface, many engines (none, on-device, user's own cloud key, our paid cloud). AI always cites your marks. *Why durable:* models change every few months; the interface and your data do not.

### 5.4 Durable bets versus fashion

| Durable (invest) | Fashion (follow lightly, do not bet the product) |
|---|---|
| Open formats (Web Annotations, ZIP/WACZ archives, Markdown, PDF) | Our own AI chatbot |
| Local-first storage and user-owned data | Our own AI browser or agent that clicks on pages |
| Pen and touch quality on tablets | Social feeds, public profiles, likes |
| Accessibility and many languages | Crypto, tokens, NFTs for archives |
| Security of the sandbox | Headset-first design |
| Fast, reliable search | Gamified streaks as the core loop |

### 5.5 The moat

A moat is what makes it hard for a competitor to catch up. PageInk's moat is **not** lock-in; we give export away. It is:

1. **Anchoring engineering**: ink and highlights that stay on the right words through reflow, rotation, carousels, closed sections and re-captures. Most tools either freeze the page (PDF) or lose marks when it changes (live annotators).
2. **The personal corpus plus habit**: years of a person's marks on their own copies. Even with open export, the daily experience (search, review, AI on your marks) keeps people.
3. **Trust**: local-first, no ads, open formats, honest security docs. Hard to fake for a cloud company whose model depends on your data.
4. **Pen-first craft on the web platform**: one codebase that runs well on iPad, Android, Windows and desktop, which native-only competitors (GoodNotes, Notability) cannot cheaply match for web content.

---

## 6. Capability map

What PageInk does, now and later. H1 = next 6 months, H2 = 6 to 24 months, H3 = 2 to 5 years, H4 = 5 to 10 years.

| Area | Today (v1) | H1 | H2 | H3 / H4 |
|---|---|---|---|---|
| **Capture** | Address via server fetch/render; HTML file | Pictures, styles and fonts saved; bookmarklet hand-off; SingleFile files; re-capture keeps history | Native share extension and Safari extension; PDF pages; watch for changes | WACZ/WARC import; whole-site capture; signed evidence capture |
| **Read** | True-size layout, rotation, lazy images, same-site links, dropdowns, carousels | Fully offline pages; clean read (hide marks); first-run tour; age badge | Reading view (simplified); read aloud; translate a selection | Spatial reading (headset) experiment |
| **Mark** | Pen, highlighter, eraser, Mark tool, notes, margin lane, meanings | Layer toggles | Lasso move, shapes, handwriting to text (on-device) | Ink search; templates for audits and legal review; shared marks |
| **Remember** | Library, collections, tags, pins, local search of titles, study sheet | Search across all page text and all marks; jump to a mark | Review queue; smart collections; Obsidian/Notion export | Lifelong memory across devices; knowledge links between marks |
| **Understand with AI** | None | (AI interface designed, not shipped) | Explain selection, summarise my marks, ask my library with citations; on-device first | Your own AI reads your library via MCP; compare page versions |
| **Share and collaborate** | Backup file, study sheet Markdown | Print / PDF with marks; portable page archive; W3C annotation export | Read-only share links (marks first); encrypted sync between your devices | Classes and teams; live co-marking |
| **Platforms** | iPad-first PWA, works in desktop browsers and phones | Real-iPad verified; phone layout polish | Thin native iPad/iPhone shell; Android and Windows pen QA | visionOS, e-ink experiments |
| **Extend** | None | Clean internal boundaries (capture pipeline, archive, AI interface) | Documented import/export formats | Plugin surface (sandboxed), public API, MCP server |

---

## 7. Architecture evolution

**Keep** (it is good and tested): Preact + TypeScript + Vite; plain TypeScript for ink, viewer and anchoring; IndexedDB via `idb`; DOMPurify sanitizing; the sandboxed iframe with no scripts; SSRF protections in `api/_lib/`; perfect-freehand strokes; hybrid anchoring (text quote, element, point); Vitest + Playwright on Chromium and WebKit.

**Change**, in this order:

### 7.1 Versioned data model and migrations (H1, first)
*Today:* `Page.schemaVersion` is fixed at `1`; IndexedDB is at version 2; one ad-hoc migration (`migrateToAutoLayout` in `src/store/repo.ts`).
*Change:* one migration runner (`src/store/migrate.ts`) that records the data version and runs numbered, tested, non-destructive steps. Every future change to stored data goes through it. This is what lets us evolve for ten years without ever losing a user's library.

### 7.2 A portable page archive (H1)
*Today:* only the HTML is stored; pictures and styles load from the original site (not offline, not durable, and the site can track the reader).
*Change:* each page becomes **snapshot HTML + its assets** (pictures, stylesheets, fonts) stored as content-addressed blobs (named by a hash of their bytes, so the same logo on 50 pages is stored once). Assets are downloaded through a new, guarded `/api/asset` endpoint because browsers block reading pictures from other sites directly. On disk the archive is a simple ZIP: `page.html`, `assets/<hash>`, `annotations.json` (W3C Web Annotations), `manifest.json`. *Later (H3):* also export as WACZ, which needs the original HTTP responses, so the asset fetcher records the headers it saw.

### 7.3 An open annotation data model (H1 export, H2 internal)
*Today:* marks are stored in PageInk's own shape, which already contains W3C-style text quote and position selectors.
*Change:* a lossless converter to and from W3C Web Annotation JSON-LD (`src/export/web-annotation.ts`). Ink is exported as an SVG selector plus a PageInk extension for raw points. Internally we keep our shape (it is fast); the converter is the contract with the outside world.

### 7.4 A pluggable capture pipeline (H1 to H2)
*Today:* `importUrl` in `src/import/import-url.ts` hard-codes fetch, then render.
*Change:* captures become "sources" that all hand raw HTML (plus optional assets) to one `storePage` step: server fetch, server render, file, bookmarklet hand-off, share extension, Safari extension, PDF. Each source is a small module. This keeps the sanitizer as the single gate every page passes through.

### 7.5 Local-first sync (H2)
*Today:* single device, manual backup file.
*Change:* every write already carries an ID, `updatedAt` and soft delete. Add a change log (an "outbox") and a small sync server that only stores **encrypted** records it cannot read. Merge rule: newest record wins per record; tombstones for deletes. Accounts use passkeys. Snapshots and assets sync lazily (on demand) because they are large. A CRDT (Yjs or Automerge) is added only when people co-edit the same note text (H3).

### 7.6 An origin-isolated snapshot viewer (H2)
*Today:* snapshots are shown in an iframe with `allow-same-origin` and no scripts, so the app can read the page to place marks. Everything rests on the sanitizer (SECURITY.md, limit 4).
*Change:* serve snapshots from a **separate origin** (a different web address the app does not share cookies or storage with). The marking code that needs to read the page runs as a small trusted script inside that origin and talks to the app by messages. A sanitizer bug then cannot touch the library. This is the single biggest security upgrade and must be done before share links or plugins.

### 7.7 An on-device-first AI interface (H2)
One TypeScript interface `AiEngine` with `summarize`, `explain`, `embed`, `ask` and `recognizeInk`, and engines: `none` (default), `chrome-builtin` (desktop Chrome), `native` (the iPad shell's Apple model), `webgpu` (a downloaded small model, optional) and `cloud` (our `/api/ai` proxy to Claude, or the user's own key). The UI asks "what can this engine do?" and hides what it cannot. Page text sent to any AI is wrapped as untrusted data and the AI is never given tools that act.

### 7.8 A plugin and extension surface (H3)
Only after 7.6. Plugins run in their own sandboxed iframe with a message API (read marks, add marks, add a sidebar panel). No plugin ever runs inside a snapshot. First-party features (templates, exports) are built as plugins to prove the API.

### 7.9 A thin native shell (H2, owner decision)
A small iPad/iPhone app (Swift with a WKWebView, or Capacitor) that hosts the same web app and adds: Share Sheet capture, a Safari Web Extension for "Save to PageInk" from Safari with the reader's own session, Apple's on-device model, and real Files/iCloud Drive access for automatic backups. The web app stays the product; the shell is a bridge.

---

## 8. Horizons

### H1: Durable and trusted (now to April 2027, 0 to 6 months)
**Goal:** every saved page is complete and offline; you can find, print and export anything; v2 is verified on a real iPad.
- Versioned data model and migration runner.
- Pictures, styles and fonts saved with each page.
- Portable archive export/import; backup format v2 with assets; W3C annotation export.
- Search across all page text and all marks.
- Print / PDF with marks.
- Clean read, layer toggles, first-run tour; accessibility audit and fixes; interface strings ready for translation.
- Age badge, re-capture with page history and "what changed".
- Bookmarklet hand-off: capture from the reader's own browser.
- Cost and abuse guard (shared limiter behind configuration, daily budget).

**Measurable outcomes:**
- 95% of a fixed test set of 30 real pages (news, reference, shops, docs, banks) open offline with pictures and styling intact.
- Search returns results in under 300 ms on a library of 1,000 pages on an iPad.
- Every v1 test still passes; every new feature has unit and e2e tests on Chromium and WebKit.
- The real-iPad checklist ([IPAD-CHECKLIST.md](IPAD-CHECKLIST.md)) passes on at least one iPad with Pencil.
- No new item in SECURITY.md's "not protected" list; SSRF tests cover the new asset endpoint.

### H2: Everywhere you read (May 2027 to late 2028, 6 to 24 months)
**Goal:** PageInk follows you across devices, captures from anywhere, and helps you understand, without giving up privacy.
- Encrypted sync between your devices (opt-in, paid).
- Native shell: Share Sheet, Safari extension, on-device AI, iCloud Drive auto-backup.
- AI v1: explain, summarise my marks, ask my library with citations; on-device first, cloud opt-in.
- Origin-isolated viewer.
- Read-only share links (marks and quotes first; full copies private and expiring).
- Reading view, read aloud, translate a selection; interface in 5 languages including one right-to-left.
- Review queue; Obsidian/Notion/Markdown export.
- Android and Windows pen testing.

**Measurable outcomes:** 30-day retention of new users at 25% or better; 40% of weekly users use search or review; sync conflicts lose zero marks in a randomised test of 10,000 edits; server cost per active user under $0.05 a month; accessibility conformance to WCAG 2.2 AA confirmed by an outside audit.

### H3: Shared understanding (2028 to 2031, 2 to 5 years)
**Goal:** groups think together on the web, and professionals rely on PageInk for evidence.
- Classes and teams: shared collections, shared marks, teacher view.
- Evidence-grade archives: signed, timestamped, WACZ export.
- Plugins and a public API; an MCP connector so a person's own AI assistant can read their library with permission.
- Handwriting search; PDF and EPUB as first-class sources.
- Education and team pricing.

**Measurable outcomes:** 1,000 classrooms or teams active; at least 3 third-party plugins; archives verified by an independent tool.

### H4: The memory of the web you read (2031 to 2036, 5 to 10 years)
**Goal:** PageInk is the personal, portable record of everything a person has read and thought about online, usable by any device and any AI they choose.
- An open specification for "ink anchored to web content" proposed to the W3C (extending Web Annotations with ink selectors), so marks are portable between tools.
- Lifelong library with automatic, durable archiving and migration across format generations.
- Works on whatever devices then matter (headsets, e-ink, glasses) through the same web core.

**Measurable outcomes (Speculation):** an outside tool reads PageInk archives without PageInk; libraries older than 8 years open intact; PageInk is used in 50+ countries in 10+ languages.

---

## 9. Business model

| Option | How it works | For | Against |
|---|---|---|---|
| A. Free forever, donations | Everything free | Simple, trusted | Server costs grow with users; no team |
| B. Freemium subscription | Core free; paid "Plus" for sync, cloud AI, share links, larger server-capture quota | Matches what people pay for (Raindrop, Readwise); costs only where servers are used | Must keep free tier genuinely good |
| C. One-time purchase | Pay once for the app | Users like it | Sync and AI have ongoing costs |
| D. Education / team licences | Per seat for classes and teams | Big, steady revenue in H3 | Needs collaboration features first |
| E. Ads or data | — | — | Destroys trust; excluded |

**Recommendation: B now, D from H3.** Free tier: unlimited local pages, marks, search, print, export, bookmarklet, file import, a fair daily quota of server fetches and renders. **PageInk Plus** at about **$3.99 a month or $29.99 a year** (priced near Raindrop Pro and below Matter and Readwise, evidence above): encrypted sync, cloud AI credits, higher server-capture quota, share links, priority rendering. Later: a one-time "lifetime Plus" offer for early supporters, and education/team pricing. No paid features until H2 sync exists; H1 is about earning trust and usage.

---

## 10. Moats and risks

| Risk | What could happen | Mitigation |
|---|---|---|
| **Copyright and publisher complaints** | Saving pages is ordinary personal use, but sharing full copies could be seen as republishing. *(Not legal advice; take legal advice before launching share links.)* | Personal copies stay on the device. Share links show your marks and short quotes with a link to the original by default; full-copy sharing only to private, expiring links. Never bypass paywalls or logins; honour removal requests; keep the `noindex` on shared pages. |
| **Server capture gets blocked more and more** | More sites refuse `/api/fetch` and `/api/render` (Cloudflare default blocking). | Bet 2: capture from the user's browser (bookmarklet now, native/Safari extension in H2). Server capture becomes the fallback, not the core. |
| **Cost of server rendering** | Each render runs Chrome for up to about 50 s. Abuse or growth could cost real money; per-instance limits are weak (SECURITY.md). | Shared rate limiter and daily global budget (H1, needs an Upstash account), Vercel spend cap, bot check before expensive work, render only as fallback, paid quota for heavy users. |
| **Asset proxy becomes an open image proxy** | `/api/asset` could be abused to hotlink or flood. | Same-origin check, per-visitor limits, content-type allowlist, size caps, no caching of responses, same SSRF guard as fetch. |
| **Platform dependence (Apple)** | Safari behaviour, PWA support or storage rules change; App Store rules for a native shell. | Stay a web app first; keep the shell thin; test on every iPadOS beta; backups always available; storage persistence requested. |
| **AI commoditisation** | Browsers and operating systems give away summaries. | Do not sell summaries; sell memory, durability and pen. AI engines are pluggable and cheap to swap. |
| **AI safety (prompt injection)** | A saved page contains hidden text that tells the AI to do something. | AI never has tools that act; page text is passed as quoted data; answers must cite marks or page text. |
| **Sanitizer bug** | Hostile page escapes into the app origin. | Keep DOMPurify current; hostile-input tests; H2 origin-isolated viewer removes the blast radius. |
| **Data loss** | A migration bug or browser clean-up deletes a library. | Migrations never delete, are tested on real old backups; persistent storage request; backup reminders; H2 sync and iCloud auto-backup. |
| **Real-iPad Pencil behaviour** | Pencil scroll, palm rejection or zoom differs from tests. | The iPad checklist is part of every milestone's sign-off; Option B input routing is documented in DECISIONS.md. |
| **Single maintainer** | The owner is not a developer; work is done by AI models. | Small milestones, strict test gate, plain-language reports, decisions written down in docs. |

---

## 11. What we will not build

1. **Our own web browser or AI browser.** Expensive, insecure (prompt injection) and a losing fight with Apple, Google and Atlassian.
2. **A general notes app or blank canvas** competing with GoodNotes and Notability. Our canvas is the web page and its margin.
3. **A social network** (public feeds, followers, likes). Sharing is person-to-person or class-level only.
4. **Paywall or login bypassing**, or crawling the web for search.
5. **Ads, tracking or selling data**, ever.
6. **Our own large AI model** or a general chatbot. We plug into others.
7. **Running a page's own scripts** in a saved copy. Interactivity is rebuilt by PageInk (dropdowns, tabs) or captured at render time.
8. **Video annotation, project management, or task lists** in H1 to H2.
9. **A desktop Electron app** while the web app works well in desktop browsers.

---

## 12. Success measures

| Measure | H1 target | H2 target |
|---|---|---|
| Pages that open complete offline (test set) | 95% | 98% |
| Marks that are "Needs attention" (lost) after a re-capture | under 5% | under 3% |
| Search time, 1,000 pages, iPad | under 300 ms | under 150 ms |
| Weekly active users who mark at least one page | (baseline set at H1 launch) | +100% |
| 30-day retention | baseline | 25% |
| Server cost per active user per month | measured | under $0.05 |
| Accessibility | internal audit, no blockers | external WCAG 2.2 AA |
| Security | no new open item in SECURITY.md | origin-isolated viewer shipped |
| Test gate | 100% green before every commit | same |

H1 has no user analytics (local-first, no tracking). Usage is measured only with explicit, opt-in, anonymous counts added in H2, or by asking testers.

---

## 13. Decisions the owner must make

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | **Is v2 still "no account needed"?** | (a) Always no account; (b) optional account for sync | **(b)**: no account for everything local; an optional passkey account only for sync and share links (H2). |
| 2 | **Build a thin native iPad app in H2?** | (a) Web app only; (b) native shell alongside the web app | **(b)**: it unlocks Share Sheet, Safari capture, on-device Apple AI and iCloud backups, none of which a web app can do on iPad today. Costs an Apple developer account ($99/year) and App Store review. |
| 3 | **Business model** | Free / freemium / one-time / ads | **Freemium "Plus" at about $3.99/month or $29.99/year from H2**, nothing paid in H1, never ads. |
| 4 | **Licence for the code** | Unlicensed / MIT / AGPL | **AGPL for the app** (others can reuse it only if they share their changes), **MIT for the archive and annotation format libraries** (so others adopt the formats). |
| 5 | **AI provider for cloud features** | Claude / other / user's own key only | **On-device first; Claude via our proxy for Plus users; allow the user's own key.** Never send a page without the user asking. |
| 6 | **Share links: what is shared?** | Full page copies publicly / marks and quotes only / private expiring full copies | **Marks and quotes with a link to the original by default; full copy only as a private, expiring link.** Take legal advice before launch. |
| 7 | **Accounts for owner-side protection now** | Create Upstash and Cloudflare Turnstile accounts in H1 or wait | **Create them in H1** (both have free tiers): needed for the shared rate limiter and bot check before usage grows. |
| 8 | **Where v2 is tested before merge** | Localhost only / a private preview URL | **Localhost first, then a Vercel preview of branch `v2` (with Deployment Protection off only for testers)** so you can test on your iPad over the internet. |
| 9 | **First audience to recruit** | Students / researchers / designers | **Students and researchers** (they already think with a pen, and durable copies plus search solve a known pain). |
