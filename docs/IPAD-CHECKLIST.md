# iPad checklist

Run on the Vercel preview URL (or production), in Safari first, then from the Home Screen icon. Add `?debug=1` to see the pen log and the eruda console.

## Phase 0
- [ ] Share > Add to Home Screen; the icon launches full screen.
- [ ] Airplane Mode, relaunch: the app still opens.

## Phase 1
- [ ] `?debug=1`: Pencil events show `pen`, pressure between 0 and 1, and a Hz figure around 60 to 120.
- [ ] Pencil draws and never scrolls the page; no Safari zoom or text-selection popups.
- [ ] One finger scrolls; two fingers pinch-zoom the page content only (the toolbar does not scale).
- [ ] Resting a palm while writing leaves no marks.
- [ ] Ink stays under the tip at writing speed; pressure changes the line width.
- [ ] Highlighter is translucent and darkens over text, not over white.
- [ ] Eraser removes whole strokes; undo/redo buttons work; two-finger tap = undo, three-finger tap = redo.
- [ ] Rotate portrait/landscape: the page refits and the ink stays on the same words.
- [ ] Pinch to about 200%: ink stays crisp and aligned.
- [ ] Draw, force-quit from the app switcher, relaunch: the strokes are back.
- [ ] Toolbar can be dragged to the top, left, right and back; position is remembered.
- [ ] "Draw with finger" (hand icon) lets a finger draw; Reading mode lets it scroll again.

## Layout, rotation and loading speed
- [ ] Import a real site (for example Wikipedia): in portrait the page looks like it does in Safari on your iPad (the tablet design, normal-sized text), not a tiny desktop page.
- [ ] Rotate the iPad both ways: the page lays itself out again for the new width, and you are still reading the same paragraph.
- [ ] Try Split View and a narrow window: the page follows the width.
- [ ] Scroll a long page: images appear as you approach them, the view does not jump, and scrolling feels natural.
- [ ] Mark text and write beside a paragraph, rotate, rotate back: highlights and handwriting stay with their paragraph.
- [ ] Page options sheet, Layout: Auto vs Desktop, Tablet and Phone widths.

## Backup, restore and where you left off
- [ ] Settings, Your data: "Back up everything" opens the iPad share sheet; save to Files or iCloud Drive. "Last backup" then says today.
- [ ] Restore from backup picks that file and says how many pages and marks came back; nothing already there is lost.
- [ ] The Library shows "Back up your library" when you have your own pages and no recent backup, and it disappears after backing up.
- [ ] Open a page, go back: "Continue where you left off" shows that page.
- [ ] Open the short address (pageink1.vercel.app) in a private window: no Vercel login appears.

## Phase 3: living marks
- [ ] Import works with no key typed anywhere (Settings should only show an optional access key).
- [ ] Mark text: drag the Pencil over words and the highlight snaps to whole words; no Safari text-selection popup or magnifier appears.
- [ ] Hold the Pencil still at the end of a drag: it grows to the sentence, then the paragraph; the hold feels deliberate, not accidental.
- [ ] Meaning colours change the highlight colour; Note: tap a word, Scribble handwriting becomes text in the note card.
- [ ] Marks panel (list icon): jump to a mark, search, filter by meaning, delete; Spotlight dims everything but one highlight and a tap ends it.
- [ ] Heat strip on the right edge shows ticks and jumps; Pencil strokes near the right edge still draw.
- [ ] Margin lane: handwrite beside the page, a leader line reaches the paragraph; close and reopen the page and it is all still there.
- [ ] Share study sheet opens the iPad share sheet with Markdown grouped by meaning.
- [ ] Close and reopen a page: it returns to where you were reading. Rotate: marks stay on their words.

## Library and organisation
- [ ] Landscape: sidebar with collections and tags; portrait: the same filters as a row of chips across the top.
- [ ] New collection (colour and name); open a card's "..." and file it into the collection, add tags, pin it.
- [ ] Filter by collection, Pinned, Unsorted and by tag; search finds titles, sites and tags; empty results say so.
- [ ] Drag a card (touch and hold, then drag) onto a collection in the sidebar; check it works with the Pencil and a finger.
- [ ] Sort order and Cards/List layout persist after closing the app.
- [ ] Settings: Dark, Light, Paper and Auto themes; accent colours and the custom picker; Compact density. Check the toolbar and page backdrop follow the theme.
- [ ] Imported pages show their cover image; one without a cover shows a coloured tile.

## Phase 2 (needs APP_KEY set in Vercel, and the same key entered in Settings)
- [ ] Settings: enter the key; a wrong key shows "Key rejected" on import.
- [ ] Import a Wikipedia article by URL: appears under en.wikipedia.org, opens, can be drawn on.
- [ ] Import a blog post and a JavaScript app (https://react.dev): the app shows real text (watch for "Rendering JavaScript..." and note how long it took).
- [ ] Import without typing https:// (for example "example.com").
- [ ] Save a page as .html in Files, then Import file.
- [ ] Reading mode: tap a link inside a page, choose "Import this page" and "Open original in Safari".
- [ ] Reading mode: tap a #section link, it scrolls within the page.
- [ ] Airplane Mode: previously imported pages still open and keep their ink (images may be missing until Phase 4 caching).
- [ ] Rename and delete from the "..." menu; the layout choice (Desktop/Tablet/Phone) changes how the page is laid out.

- [ ] Open a site with an FAQ: tap a question (Read mode) and it opens; Expand all opens the rest.
- [ ] Tap a link to another page of the same site: it opens, and the Back chip returns.
