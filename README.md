# 🪔 Lamp & Path: Bible Journey

> "Thy word is a lamp unto my feet, and a light unto my path." (Psalm 119:105)

**Lamp & Path** is a Bible study and game app. It trains people to read scripture and to pray, through an explorable world, daily games and guided prayer.

## Features

### 🗺️ The Pilgrim's Journey (exploration game)
- A hand-drawn map of the Bible lands: the Mediterranean, Egypt and the Nile, Sinai, Canaan, Galilee, Mesopotamia, Greece and the Aegean islands.
- Everything is drawn in code: shaded terrain, animated water, swaying palms, cedars and olive groves, drifting clouds and their shadows, fireflies, and a full **day and night cycle** with lit lamps and lantern light.
- **23 sacred sites** in biblical order, from the **Garden of Eden** to the **Isle of Patmos**. Each site has its own animated landmark: Noah's ark and a rainbow on Ararat, the walls of Jericho (which fall once you complete the site), the star over Bethlehem, a boat on the Sea of Galilee, the empty tomb, tongues of fire at Pentecost, and more.
- Walk to a glowing site and a **scripture passage pops up**. You can read it or listen to it aloud. It comes with its setting, historical background, key themes, further reading and a reflection question.
- Pass the **quiz** (2 of 3 correct) to light a lamp at the site and unlock the road to the next one. Earn up to 3 stars per site.
- A guide arrow, a compass auto-walk button, a minimap with fast travel to unlocked sites, and zoom.

### ☀️ Daily
- **Verse of the Day**, with read-aloud.
- **Four daily Bible games**, which change every day:
  - ❓ **Daily Quiz**: five questions from a bank of 50.
  - 🧩 **Verse Scramble**: rebuild a verse from its pieces. Helps memorisation.
  - ✍️ **Fill the Blank**: choose the missing words of a verse.
  - 📚 **Books in Order**: tap five books in their Bible order.
- **Streaks** with a six-step daily checklist: verse, quiz, scramble, fill-in, books and prayer.

### 📖 Study
- Every journey passage can be browsed and searched, with its full context and a **personal notes** box that is saved on the device.
- **All 66 books of the Bible**, each with its section and a one-line summary, filterable by section (Law, History, Poetry, Prophets, Gospels, Epistles and so on).

### 🙏 Prayer
- **Guided A.C.T.S. prayer** (Adoration, Confession, Thanksgiving, Supplication), with a scripture for each step, a timer ring and a breathing cue.
- **Prayers from Scripture**: the Lord's Prayer, Psalm 23, the Priestly Blessing and more, with "pray along" read-aloud.
- A **prayer journal** where you can mark prayers as answered.

### 🏆 Progress
- XP, 12 levels (Seeker → Apostle), 15 badges, stats, and sound effects (generated in the browser, so no audio files are needed).

## Scripture & copyright

All scripture text in the app is from the **King James Version (KJV)**, which is in the **public domain** in most of the world. (In the United Kingdom the KJV is under a perpetual Crown patent. Quoting it in a free, non-commercial app like this is widely accepted.) Context notes, summaries, reflections, quizzes and prayer guides were written for this app.

## Running it

It is a static web app with no build step and no dependencies.

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000
```

You can also open `index.html` directly in a browser. Serving it over HTTP adds offline support and lets you **install it to a phone home screen** (it is a PWA).

To publish it, upload the folder to any static host, such as GitHub Pages, Netlify or Vercel.

### Controls (Journey)
| Action | Keyboard | Touch / mouse |
|---|---|---|
| Move | `W A S D` / arrow keys | Tap a spot, or hold and drag |
| Read at a site | `E`, `Enter` or `Space` | Tap the site, or the gold prompt |
| Zoom | `+` / `-` / mouse wheel | ＋ / － buttons |
| Walk to next site | — | 🧭 button |
| Fast travel | — | Tap an unlocked site on the minimap |

## Project structure

```
index.html            App shell
css/styles.css        All styling (desktop + mobile)
js/data/journey.js    23 sites: KJV passages, context, reflections, quizzes, map positions
js/data/library.js    Daily verses, quiz bank, 66 books, scripture prayers, ACTS guide
js/core.js            Saving, XP/levels, streaks, badges, sound, read-aloud, toasts
js/game.js            Map rendering engine (terrain, sprites, lighting, particles, input)
js/app.js             UI: reader, quizzes, daily games, study, prayer, profile
sw.js                 Offline cache (service worker)
manifest.webmanifest  PWA manifest
```

Progress is stored in the browser's `localStorage`. There are no accounts and no data leaves the device.

## Adding content

- **New journey site:** add an entry to `js/data/journey.js` with `x`/`y` map coordinates (the world is 4800 × 3200), an `icon`, KJV `passages`, `context`, `reflect` and a 3-question `quiz`.
- **More daily verses or quiz questions:** append them to `DAILY_VERSES` or `QUIZ_BANK` in `js/data/library.js`. Please use KJV text so the content stays public domain.
