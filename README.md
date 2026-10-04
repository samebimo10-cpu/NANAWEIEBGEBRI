# 🪔 Lamp & Path: Bible Journey

> "Thy word is a lamp unto my feet, and a light unto my path." (Psalm 119:105)

**Lamp & Path** is a Bible study and game app. It trains people to read scripture and to pray, through an explorable world, daily games and guided prayer.

## Features

### 📜 The full King James Bible
- **All 66 books, 1,189 chapters, 31,102 verses**, readable offline at any time. Books load as you open them.
- **Highlight** verses in five colours. Tap verses to select them, then pick a colour.
- **Verse notes**: attach your own notes to any verse.
- **"Pray this"**: send any verse to someone on your prayer list.
- **Search the whole Bible** for words or an `"exact phrase"`, or type a reference such as `Phil 4:6-7`, `Ps 23` or `1 John 1:9` to jump straight to it.
- **Listen**: the chapter is read aloud verse by verse, with the current verse lit up.
- Copy verses, adjust the text size, and the app remembers where you were reading.
- A **My highlights & notes** list, filterable by colour.

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
- **Who I'm praying for**: a prayer list sorted into groups (Family, Friends, Church, Work & School, Sick & Healing, Salvation, Leaders & Nation, Missions, Myself). For each person you can keep:
  - **prayer requests** (the reasons you are praying), which you can mark as **answered 🙌**,
  - the **scriptures you are praying over them**, looked up from the KJV by reference,
  - notes, and how many times and how recently you have prayed for them.
  - **Pray now** brings their requests and scriptures together into one focused prayer. "Today, pray for…" suggests the people you have prayed for least recently.
- **Prayer reminders**: set the times and days, and optionally link a person.
  - **Notifications** fire while the app is open (including in a background tab), and missed reminders catch up when you return within the hour.
  - **📅 Add to calendar** downloads a repeating calendar event with an alert, so your phone reminds you **even when the app is closed**. A browser web app cannot schedule notifications by itself once it is closed.
- **Guided A.C.T.S. prayer** (Adoration, Confession, Thanksgiving, Supplication), with a scripture for each step, a timer ring and a breathing cue.
- **Prayers from Scripture**: the Lord's Prayer, Psalm 23, the Priestly Blessing and more, with "pray along" read-aloud.
- A **prayer journal** where you can mark prayers as answered.

### 🏆 Progress
- XP, 12 levels (Seeker → Apostle), 15 badges, stats, and sound effects (generated in the browser, so no audio files are needed).

## Scripture & copyright

All scripture text in the app is from the **King James Version (KJV)**. The full text in `js/kjv/` was built from two public KJV datasets ([thiagobodruk/bible](https://github.com/thiagobodruk/bible) and [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases)), cross-checked word by word against each other. 41 verses where translators' margin notes had leaked into the verse text were cleaned, and the spacing before punctuation was fixed. All scripture is, which is in the **public domain** in most of the world. (In the United Kingdom the KJV is under a perpetual Crown patent. Quoting it in a free, non-commercial app like this is widely accepted.) Context notes, summaries, reflections, quizzes and prayer guides were written for this app.

## Running it

It is a static web app with no build step and no dependencies.

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000
```

You can also open `index.html` directly in a browser. Serving it over HTTP adds offline support and lets you **install it to a phone home screen** (it is a PWA).

To publish it, upload the folder to any static host, such as GitHub Pages, Netlify or Vercel.

### 100% offline
Open the app once while connected, from its own web address (for example GitHub Pages). It then saves everything on the device in the background: the app, its fonts, and **all 66 books of the Bible** (about 5 MB). A message says when it is ready, and **Profile → Offline** shows the status. After that, everything works with no internet: the game, the Bible, search, highlights, daily games, prayer list and reminders. Add it to your home screen to open it like a normal app.

Fonts are bundled in `fonts/` (Cinzel, EB Garamond, Inter; SIL Open Font License), so nothing loads from other websites.

### Your data
Everything (progress, highlights, notes, prayer list, reminders) is stored on your device. Use **Profile → 💾 Back up my data** to save a backup file, and **📂 Restore backup** to move it to another phone or browser.

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
js/kjv/01.js … 66.js  The full KJV text, one file per book
js/bible.js           Bible loading, reference parsing ("Phil 4:6-7"), lookup and search
js/reader.js          Bible reader UI: highlights, notes, search, listen
js/praylist.js        "Who I'm praying for", prayer reminders, calendar export, reminder scheduler
js/core.js            Saving, XP/levels, streaks, badges, sound, read-aloud, toasts
js/game.js            Map rendering engine (terrain, sprites, lighting, particles, input)
js/app.js             UI: reader, quizzes, daily games, study, prayer, profile
sw.js                 Offline support: saves the app, fonts and the whole Bible on the device
fonts/                Bundled fonts (no internet needed)
manifest.webmanifest  PWA manifest
```

Progress is stored in the browser's `localStorage`. There are no accounts and no data leaves the device.

## Adding content

- **New journey site:** add an entry to `js/data/journey.js` with `x`/`y` map coordinates (the world is 4800 × 3200), an `icon`, KJV `passages`, `context`, `reflect` and a 3-question `quiz`.
- **More daily verses or quiz questions:** append them to `DAILY_VERSES` or `QUIZ_BANK` in `js/data/library.js`. Please use KJV text so the content stays public domain.
