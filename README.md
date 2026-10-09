# 🪔 Lamp & Path: Bible Journey

> "Thy word is a lamp unto my feet, and a light unto my path." (Psalm 119:105)

**Lamp & Path** is a Bible study and game app. It trains people to read scripture and to pray, through an explorable world, daily games and guided prayer.

## Features

### ✨ Personal to each person
- On first open the app asks the person's name and favourite colour.
- Every time it opens, it greets them with their name **written in calligraphy**, as if by hand, with the verse of the day, for example "Grace and peace, Sarah".
- Their name appears around the app: the daily greeting, the profile and the wake-up alarm ("Rise and pray, Sarah").
- **⚙️ Personalize**: name, greeting style, six colour themes, a custom app title (e.g. "Sarah's Prayer Lamp"), and whether to show the welcome each time.

### 📲 Install and share
- Installable as an app (a PWA) with proper app icons and home-screen shortcuts (Bible, Prayer, Daily).
- An **Install app** button uses the phone's own install prompt on Android and in desktop Chrome or Edge, and shows step-by-step help on iPhone (Safari → Share → Add to Home Screen).
- It notices when it was opened inside WhatsApp, Instagram and similar apps, and explains how to open it in Chrome or Safari to install.
- **Share with someone** sends the link. Each person who opens it gets their own copy, with their own name, notes and prayers.
- To make the link work, host the app on GitHub Pages: **Settings → Pages → Deploy from a branch**. The link is `https://samebimo10-cpu.github.io/NANAWEIEBGEBRI/`.


### 📜 The full King James Bible
- **All 66 books, 1,189 chapters, 31,102 verses**, readable offline at any time. Books load as you open them.
- **Highlight** verses in five colours. Tap verses to select them, then pick a colour.
- **Verse notes**: attach your own notes to any verse.
- **"Pray this"**: send any verse to someone on your prayer list.
- **Search the whole Bible** for words or an `"exact phrase"`, or type a reference such as `Phil 4:6-7`, `Ps 23` or `1 John 1:9` to jump straight to it.
- **Listen**: the chapter is read aloud verse by verse, with the current verse lit up.
- Copy verses, adjust the text size, and the app remembers where you were reading.
- A **My highlights & notes** list, filterable by colour.

### 🎮 Bible Story Quest (2D story game, the last tab)
- **12 short side-scrolling stories**, from Creation to Pentecost: Let There Be Light, Noah's Ark, Through the Red Sea, The Walls of Jericho, David and Goliath, Jonah, Daniel in the Lions' Den, the birth of Jesus, Peace Be Still, the Cross, the Empty Tomb and Pentecost.
- **Movement**: run with momentum, jump higher by holding the jump button, and leap between boats that bob on the waves. Falling into the water gently returns you to solid ground. Keyboard (← → / A D, Space or ↑) or big on-screen buttons on phones.
- **Visuals for each story**: layered scrolling landscapes, skies, weather and light. Darkness turns to light in Eden, rain falls until the rainbow appears, you walk between walls of water at the Red Sea, the storm calms on Galilee, the sun rises at the tomb, and tongues of fire appear at Pentecost.
- **Finales**: the walls of Jericho fall, Goliath topples, the stone is rolled away, and more.
- **3 fact scrolls per story**: short facts, each with its Bible reference and checked against the KJV text. Any you miss are shown at the end.
- At the end of each story you **read the KJV passage** (with context and background) and answer a **3-question quiz** to earn up to 3 stars and unlock the next story.

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
- **⏰ Wake-up prayer alarms**: loud, repeating alarm sounds (church bells, gentle chimes, or a trumpet call) that get louder over 45 seconds, with vibration, snooze (5, 10 or 15 minutes), and a full-screen wake-up screen with a morning or midnight verse. "I'm awake" goes straight into guided prayer, or into prayer for the person linked to the alarm.
  - **🌙 Bedside mode**: phones do not let a closed web app make sound, so before sleeping you start bedside mode and leave the phone on charge with the app open. It keeps the screen on (dimmed, with a clock) so the alarm can ring. **📅 Add to calendar** also creates a calendar event with a sound alert as a backup.
- **📝 My requests**: your personal prayer requests, in three sections:
  - **🙏 Praying**: how long you have been asking, and how many times you have prayed;
  - **🙌 Answered**: the date it was answered and **how God answered**;
  - **⌛ Past needs**: needs and wants that are no longer relevant, with what changed.
- **🕊️ Led to pray**: a journal of what the Lord lays on your heart to pray about, with who it is for and any scripture that came to mind. Entries are grouped by day, can be marked as prayed, and can become a prayer request with one tap.
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

### One downloadable HTML file
`python3 tools/build_single_html.py` builds `dist/lamp-and-path.html`: the whole app in **one file** (about 6 MB), with the styles, fonts, code and the complete KJV inside. Copy it to a phone or computer and open it in a browser. It needs no internet and no server. Your progress is saved in that browser. Use Profile → Back up to move it between devices.

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
js/praylist.js        "Who I'm praying for", alarms & reminders, calendar export, scheduler
js/alarm.js           Wake-up alarm sounds, ringing screen, snooze, bedside mode
js/requests.js        My requests (praying / answered / past needs) and Led to pray
js/core.js            Saving, XP/levels, streaks, badges, sound, read-aloud, toasts
js/story.js           Bible Story Quest: 2D side-scrolling story game (levels, physics, drawing, finales)
js/data/stories.js    The 12 stories: themes, goals and fact scrolls with references
js/app.js             UI: reader, quizzes, daily games, study, prayer, profile
sw.js                 Offline support: saves the app, fonts and the whole Bible on the device
fonts/                Bundled fonts (no internet needed)
manifest.webmanifest  PWA manifest
```

Progress is stored in the browser's `localStorage`. There are no accounts and no data leaves the device.

## Adding content

- **New journey site:** add an entry to `js/data/journey.js` with `x`/`y` map coordinates (the world is 4800 × 3200), an `icon`, KJV `passages`, `context`, `reflect` and a 3-question `quiz`.
- **More daily verses or quiz questions:** append them to `DAILY_VERSES` or `QUIZ_BANK` in `js/data/library.js`. Please use KJV text so the content stays public domain.
