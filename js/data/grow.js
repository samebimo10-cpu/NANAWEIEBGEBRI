/*
 * Content for growing in the Word. Scripture is stored as references only and the text is
 * read from the bundled KJV at runtime, so every verse shown is exact KJV wording.
 * Prayers, notes and word meanings are original to this app.
 */

/* "A word for how I feel" */
window.FEELINGS = [
  { id: 'anxious', icon: '😟', name: 'Anxious', refs: ['Philippians 4:6-7', '1 Peter 5:7', 'Matthew 6:34', 'Isaiah 26:3', 'John 14:27', 'Psalm 94:19'],
    prayer: 'Lord, my mind is racing. I give You every worry I am carrying. Guard my heart with Your peace, which passes all understanding. Amen.' },
  { id: 'afraid', icon: '😨', name: 'Afraid', refs: ['Isaiah 41:10', 'Psalm 27:1', '2 Timothy 1:7', 'Psalm 56:3', 'Joshua 1:9', 'Deuteronomy 31:6'],
    prayer: 'Father, I am afraid. You are my light and my salvation. Hold me with Your right hand, and teach my heart to trust You. Amen.' },
  { id: 'grieving', icon: '💔', name: 'Grieving', refs: ['Psalm 34:18', 'Matthew 5:4', 'Psalm 147:3', '2 Corinthians 1:3-4', 'John 11:25-26', 'Revelation 21:4'],
    prayer: 'God of all comfort, my heart is broken. Be near to me as You promised. Hold what I cannot hold, and heal what I cannot heal. Amen.' },
  { id: 'lonely', icon: '🫂', name: 'Lonely', refs: ['Hebrews 13:5', 'Deuteronomy 31:8', 'Matthew 28:20', 'Psalm 27:10', 'Isaiah 43:2', 'Psalm 68:6'],
    prayer: 'Lord, I feel alone. Thank You that You will never leave me nor forsake me. Let me sense Your presence today, and lead me to people who love You. Amen.' },
  { id: 'tempted', icon: '⚔️', name: 'Tempted', refs: ['1 Corinthians 10:13', 'James 4:7', 'Hebrews 4:15-16', 'Psalm 119:11', 'Matthew 26:41', 'James 1:12'],
    prayer: 'Jesus, You were tempted in every way, yet without sin. Show me the way of escape You have promised, and give me strength to take it. Amen.' },
  { id: 'discouraged', icon: '🌧️', name: 'Discouraged', refs: ['Isaiah 40:31', 'Galatians 6:9', 'Psalm 42:11', '2 Corinthians 4:16-17', 'Lamentations 3:22-23', 'Philippians 1:6'],
    prayer: 'Lord, I am tired of trying. Renew my strength. Remind me that You finish what You begin, and that Your mercies are new this morning. Amen.' },
  { id: 'weary', icon: '😮‍💨', name: 'Weary', refs: ['Matthew 11:28-30', 'Isaiah 40:29', 'Psalm 55:22', '2 Corinthians 12:9', 'Psalm 46:1', 'Psalm 61:2'],
    prayer: 'Jesus, I come to You heavy-laden. Give me Your rest. Let Your strength be made perfect in my weakness today. Amen.' },
  { id: 'waiting', icon: '⏳', name: 'Waiting', refs: ['Psalm 27:14', 'Habakkuk 2:3', 'Lamentations 3:25-26', 'Psalm 130:5', 'Psalm 37:7', 'Romans 8:28'],
    prayer: 'Father, waiting is hard. Help me to rest in You and not run ahead of You. I trust that Your timing is good. Amen.' },
  { id: 'sick', icon: '🤒', name: 'Unwell', refs: ['Psalm 103:2-3', 'Jeremiah 17:14', 'James 5:14-15', 'Isaiah 53:5', '3 John 1:2', 'Psalm 41:3'],
    prayer: 'Lord, You are the God who heals. Touch my body, strengthen me through this sickness, and give wisdom to those caring for me. Amen.' },
  { id: 'guilty', icon: '😔', name: 'Guilty', refs: ['1 John 1:9', 'Romans 8:1', 'Psalm 103:12', 'Isaiah 1:18', 'Micah 7:19', 'Psalm 51:10'],
    prayer: 'Father, I have sinned. I confess it to You now. Thank You that in Christ there is no condemnation. Wash me, and make my heart clean. Amen.' },
  { id: 'angry', icon: '😠', name: 'Angry', refs: ['James 1:19-20', 'Ephesians 4:26', 'Proverbs 15:1', 'Colossians 3:13', 'Psalm 37:8', 'Romans 12:19'],
    prayer: 'Lord, I am angry. Help me not to sin in it. Slow my words, soften my heart, and teach me to forgive as You have forgiven me. Amen.' },
  { id: 'lost', icon: '🧭', name: 'Need guidance', refs: ['Proverbs 3:5-6', 'James 1:5', 'Psalm 32:8', 'Isaiah 30:21', 'Psalm 119:105', 'Jeremiah 33:3'],
    prayer: 'Lord, I do not know which way to go. I ask You for wisdom. Direct my paths, and give me peace about the next step. Amen.' },
  { id: 'thankful', icon: '🙏', name: 'Thankful', refs: ['Psalm 100:4-5', '1 Thessalonians 5:18', 'Psalm 107:1', 'James 1:17', 'Psalm 103:1-2', 'Colossians 3:17'],
    prayer: 'Father, thank You! Every good gift comes from You. I bless Your name for all You have done, and for who You are. Amen.' },
  { id: 'joyful', icon: '😊', name: 'Joyful', refs: ['Philippians 4:4', 'Psalm 16:11', 'Nehemiah 8:10', 'Psalm 118:24', 'Romans 15:13', 'Zephaniah 3:17'],
    prayer: 'Lord, my heart is glad! In Your presence is fulness of joy. Let my joy overflow to the people around me today. Amen.' }
];

/* Topical studies: short guided paths through Scripture */
window.TOPICS = [
  { id: 'faith', icon: '🛡️', name: 'Faith', intro: 'What faith is, where it comes from, and how it grows.',
    steps: [
      ['Hebrews 11:1', 'Faith is confident trust in what God has promised, even before we see it.'],
      ['Romans 10:17', 'Faith grows by hearing the Word of God, which is why daily reading matters.'],
      ['Hebrews 11:6', 'Faith pleases God because it takes Him at His word.'],
      ['Ephesians 2:8-9', 'Even our salvation is received by faith, as a gift, not earned.'],
      ['Mark 11:22-24', 'Jesus calls us to have faith in God and to pray believing.'],
      ['Matthew 17:20', 'Small faith in a great God can move mountains.']
    ], question: 'Where is God asking you to trust Him before you can see the outcome?' },
  { id: 'forgiveness', icon: '🕊️', name: 'Forgiveness', intro: "Receiving God's forgiveness, and forgiving others.",
    steps: [
      ['1 John 1:9', 'When we confess, God is faithful to forgive and cleanse us.'],
      ['Psalm 103:10-12', 'He removes our sins as far as the east is from the west.'],
      ['Ephesians 4:32', 'We forgive others because God in Christ has forgiven us.'],
      ['Matthew 18:21-22', 'Forgiveness is not counted or rationed.'],
      ['Matthew 6:14-15', 'An unforgiving heart blocks our own fellowship with God.'],
      ['Luke 23:34', 'On the cross Jesus forgave the very people who crucified Him.']
    ], question: 'Is there someone you need to forgive, or a sin you need to bring to God?' },
  { id: 'prayer', icon: '🙏', name: 'Prayer', intro: 'How Jesus and the apostles teach us to pray.',
    steps: [
      ['Matthew 6:6', 'Prayer is first a private, honest meeting with your Father.'],
      ['Luke 11:9-10', 'Ask, seek, knock: keep coming to God.'],
      ['Philippians 4:6-7', 'Turn every worry into a prayer, with thanksgiving.'],
      ['1 Thessalonians 5:17', 'Prayer can become a constant conversation through the day.'],
      ['James 5:16', 'The prayers of a righteous person are powerful and effective.'],
      ['Romans 8:26', 'When you do not know what to pray, the Spirit helps you.']
    ], question: 'What would it look like to pray a little more honestly this week?' },
  { id: 'fear', icon: '🌊', name: 'Fear and Trust', intro: 'Replacing fear with trust in the God who is near.',
    steps: [
      ['Psalm 23:1-4', 'The Shepherd is with you even in the darkest valley.'],
      ['Isaiah 41:10', 'God promises His presence, His strength and His help.'],
      ['Psalm 91:1-2', 'There is a safe place to dwell: in the shadow of the Almighty.'],
      ['Matthew 6:31-33', 'Your Father knows what you need. Seek Him first.'],
      ['Proverbs 3:5-6', 'Trust Him with all your heart, not your own understanding.'],
      ['2 Timothy 1:7', 'God has not given you a spirit of fear.']
    ], question: 'What fear do you want to hand over to God today?' },
  { id: 'identity', icon: '👑', name: 'Who I Am in Christ', intro: 'What God says about those who belong to Him.',
    steps: [
      ['John 1:12', 'You are a child of God.'],
      ['2 Corinthians 5:17', 'You are a new creation; the old has passed away.'],
      ['Ephesians 2:10', "You are God's workmanship, created for good works."],
      ['Galatians 2:20', 'Christ lives in you.'],
      ['1 Peter 2:9', 'You are chosen and called out of darkness into His light.'],
      ['Romans 8:37-39', 'Nothing can separate you from the love of God.']
    ], question: 'Which of these truths do you most need to believe about yourself today?' },
  { id: 'spirit', icon: '🔥', name: 'The Holy Spirit', intro: 'Who the Holy Spirit is and what He does in us.',
    steps: [
      ['John 14:16-17', 'Jesus promised another Comforter who would be with us for ever.'],
      ['John 16:13', 'The Spirit guides us into all truth.'],
      ['Acts 1:8', 'The Spirit gives power to be witnesses.'],
      ['Romans 8:14-16', 'The Spirit assures us that we are children of God.'],
      ['Galatians 5:22-23', 'The Spirit grows His fruit in our character.'],
      ['1 Corinthians 6:19-20', 'Your body is a temple of the Holy Ghost.']
    ], question: 'Which fruit of the Spirit would you ask Him to grow in you this month?' },
  { id: 'money', icon: '💰', name: 'Money and Stewardship', intro: 'A heavenly view of possessions and giving.',
    steps: [
      ['Matthew 6:19-21', 'Your heart follows your treasure.'],
      ['1 Timothy 6:6-10', 'Godliness with contentment is great gain.'],
      ['Proverbs 3:9-10', 'Honour the Lord with the first of what you receive.'],
      ['Malachi 3:10', 'God invites His people to trust Him in their giving.'],
      ['2 Corinthians 9:7', 'God loves a cheerful giver.'],
      ['Hebrews 13:5', 'Be content, because He will never leave you.']
    ], question: 'Is there one step of generosity or contentment God is prompting you to take?' },
  { id: 'family', icon: '🏡', name: 'Marriage and Family', intro: "God's design for love at home.",
    steps: [
      ['Genesis 2:24', 'Marriage is a one-flesh covenant designed by God.'],
      ['Ephesians 5:25', 'Husbands are called to love as Christ loved the Church.'],
      ['Colossians 3:18-21', 'Each member of the family has a calling of love and honour.'],
      ['1 Corinthians 13:4-7', 'This is what love looks like day to day.'],
      ['Proverbs 22:6', 'Train children in the way they should go.'],
      ['Joshua 24:15', 'As for me and my house, we will serve the Lord.']
    ], question: 'How can you show patient, kind love to someone at home this week?' },
  { id: 'love', icon: '❤️', name: "God's Love", intro: 'How wide and long and high and deep is the love of Christ.',
    steps: [
      ['John 3:16', 'God so loved the world that He gave His Son.'],
      ['Romans 5:8', 'He loved us while we were still sinners.'],
      ['1 John 4:7-8', 'God is love, and love comes from Him.'],
      ['1 John 4:18-19', 'Perfect love casts out fear. We love because He first loved us.'],
      ['John 13:34-35', 'Our love for one another shows the world we are His.'],
      ['Romans 8:38-39', 'Nothing in all creation can separate us from His love.']
    ], question: "Who could you show God's love to in a practical way today?" }
];

/* Reading plans. Days are generated from the Bible's chapter counts (see grow.js). */
window.PLANS = [
  { id: 'start21', icon: '🌱', name: 'First Steps', days: 21, desc: 'Twenty-one key chapters for new believers: creation, the cross, new life, and the hope of heaven.' },
  { id: 'gospels30', icon: '✝️', name: 'The Gospels in 30 Days', days: 30, desc: 'Matthew, Mark, Luke and John: the life, death and resurrection of Jesus.' },
  { id: 'pp31', icon: '🎵', name: 'Psalms and Proverbs', days: 31, desc: 'One Proverb and about five Psalms a day. Read all of both books in a month.' },
  { id: 'nt90', icon: '📜', name: 'New Testament in 90 Days', days: 90, desc: 'Every chapter from Matthew to Revelation in three months, about three chapters a day.' },
  { id: 'year', icon: '📖', name: 'Bible in a Year', days: 365, desc: 'The whole Bible, Genesis to Revelation, in 365 days: about 3 to 4 chapters a day.' },
  { id: 'chrono', icon: '⏳', name: 'Chronological Bible in a Year', days: 365, desc: 'The whole Bible in about the order events happened: Job with the patriarchs, the Psalms with David, the prophets with the kings, Paul’s letters within Acts.' }
];
/* Chronological order (approximate): [book name, first chapter, last chapter] */
window.CHRONO = [
  ['Genesis', 1, 11], ['Job', 1, 42], ['Genesis', 12, 50], ['Exodus', 1, 40], ['Leviticus', 1, 27], ['Numbers', 1, 36], ['Deuteronomy', 1, 34], ['Psalms', 90, 90],
  ['Joshua', 1, 24], ['Judges', 1, 21], ['Ruth', 1, 4], ['1 Samuel', 1, 31], ['1 Chronicles', 1, 10], ['2 Samuel', 1, 24], ['1 Chronicles', 11, 29],
  ['Psalms', 1, 89], ['Psalms', 91, 150], ['1 Kings', 1, 11], ['2 Chronicles', 1, 9], ['Proverbs', 1, 31], ['Song of Solomon', 1, 8], ['Ecclesiastes', 1, 12],
  ['1 Kings', 12, 22], ['2 Chronicles', 10, 20], ['2 Kings', 1, 14], ['2 Chronicles', 21, 25], ['Jonah', 1, 4], ['Amos', 1, 9], ['Hosea', 1, 14],
  ['2 Kings', 15, 20], ['2 Chronicles', 26, 32], ['Isaiah', 1, 66], ['Micah', 1, 7], ['2 Kings', 21, 23], ['2 Chronicles', 33, 35], ['Nahum', 1, 3],
  ['Zephaniah', 1, 3], ['Joel', 1, 3], ['Habakkuk', 1, 3], ['Jeremiah', 1, 52], ['2 Kings', 24, 25], ['2 Chronicles', 36, 36], ['Lamentations', 1, 5],
  ['Obadiah', 1, 1], ['Ezekiel', 1, 48], ['Daniel', 1, 12], ['Ezra', 1, 6], ['Haggai', 1, 2], ['Zechariah', 1, 14], ['Esther', 1, 10], ['Ezra', 7, 10],
  ['Nehemiah', 1, 13], ['Malachi', 1, 4],
  ['Luke', 1, 2], ['Matthew', 1, 28], ['Mark', 1, 16], ['Luke', 3, 24], ['John', 1, 21], ['Acts', 1, 14], ['James', 1, 5], ['Galatians', 1, 6], ['Acts', 15, 17],
  ['1 Thessalonians', 1, 5], ['2 Thessalonians', 1, 3], ['Acts', 18, 19], ['1 Corinthians', 1, 16], ['2 Corinthians', 1, 13], ['Acts', 20, 20], ['Romans', 1, 16],
  ['Acts', 21, 28], ['Ephesians', 1, 6], ['Philippians', 1, 4], ['Colossians', 1, 4], ['Philemon', 1, 1], ['1 Timothy', 1, 6], ['Titus', 1, 3], ['1 Peter', 1, 5],
  ['Hebrews', 1, 13], ['2 Timothy', 1, 4], ['2 Peter', 1, 3], ['Jude', 1, 1], ['1 John', 1, 5], ['2 John', 1, 1], ['3 John', 1, 1], ['Revelation', 1, 22]
];

window.START21 = ['Genesis 1', 'Genesis 3', 'Exodus 14', 'Exodus 20', 'Psalm 23', 'Psalm 51', 'Psalm 139', 'Isaiah 53', 'Matthew 5', 'Matthew 6', 'Matthew 7', 'John 1', 'John 3', 'John 11', 'John 15', 'Romans 8', 'Romans 12', '1 Corinthians 13', 'Ephesians 2', 'Philippians 4', 'Revelation 21'];

/* Fasting companion: a scripture for each day of a fast */
window.FAST_REFS = ['Isaiah 58:6', 'Matthew 6:16-18', 'Joel 2:12', 'Ezra 8:23', 'Matthew 4:4', 'Esther 4:16', 'Acts 13:2-3', 'Nehemiah 1:4', 'Daniel 9:3', 'Psalm 35:13', 'Isaiah 58:11', 'Matthew 6:33'];
window.TESTIMONY_REF = 'Psalm 66:20';

/* Old KJV words and what they mean today (shown when a reader taps an underlined word) */
window.GLOSSARY = {
  shew: 'show', shewed: 'showed', sheweth: 'shows', shewing: 'showing',
  wist: 'knew', wot: 'know', wotteth: 'knows',
  charity: 'love (Greek agape), self-giving love', conversation: 'conduct, way of life',
  quick: 'living, alive', quicken: 'make alive', quickened: 'made alive', quickeneth: 'gives life to',
  prevent: 'go before, come first', prevented: 'went before, met',
  suffer: 'allow, permit (or: endure)', suffered: 'allowed (or: endured)',
  corn: 'grain (wheat or barley, not maize)', meat: 'food of any kind',
  peculiar: "God's own special possession", carriage: 'baggage, belongings',
  communicate: 'share, give', comfortless: 'orphaned, without a helper',
  divers: 'various, different', anon: 'at once, immediately', straightway: 'immediately',
  howbeit: 'however, nevertheless', verily: 'truly', lest: 'so that … not',
  whither: 'to where', whence: 'from where', hither: 'here, to this place', thither: 'there, to that place',
  yonder: 'over there', wherefore: 'why; or: therefore', hath: 'has', doth: 'does', saith: 'says',
  spake: 'spoke', begat: 'became the father of', beseech: 'beg, urge earnestly', besought: 'begged',
  raiment: 'clothing', victuals: 'food, provisions', firmament: 'sky, the expanse of heaven',
  kine: 'cows, cattle', sore: 'very much, greatly', haply: 'perhaps', peradventure: 'perhaps',
  mammon: 'wealth, riches', publican: 'tax collector', publicans: 'tax collectors', scrip: "a traveller's bag",
  staves: 'staffs, walking sticks', wont: 'used to, accustomed', betimes: 'early',
  ere: 'before', afore: 'before', aught: 'anything', naught: 'nothing', nigh: 'near', twain: 'two',
  wroth: 'very angry', comely: 'beautiful, fitting', froward: 'stubborn, perverse',
  concupiscence: 'strong desire, lust', propitiation: 'the sacrifice that turns away wrath and makes peace with God',
  sanctify: 'set apart as holy', sanctified: 'set apart as holy', justified: 'declared righteous',
  reins: 'innermost being (literally kidneys)', bowels: 'deep feelings, compassion',
  countenance: 'face, expression', visage: 'face, appearance', apparel: 'clothing',
  ensample: 'example', ensamples: 'examples', holpen: 'helped', listeth: 'wishes, wants',
  sith: 'since', trow: 'think, suppose', shamefacedness: 'modesty', superfluity: 'overflow, excess',
  vex: 'trouble, distress', vexed: 'troubled', wax: 'grow, become', waxed: 'grew, became',
  dearth: 'famine', tarry: 'stay, wait', tarried: 'stayed, waited', cleave: 'cling to, hold fast',
  mete: 'measure out', anathema: 'accursed', maranatha: '"Our Lord, come!" (Aramaic)',
  thereof: 'of it', therein: 'in it', thereon: 'on it', whereby: 'by which', wherein: 'in which',
  hosanna: '"Save now!", a cry of praise', selah: 'probably a pause or musical rest',
  abide: 'remain, stay', abideth: 'remains', abode: 'stayed; or: home', alway: 'always',
  bewray: 'reveal, betray', bewrayeth: 'reveals', chambering: 'sexual immorality', churl: 'rude, miserly person',
  clave: 'clung to', durst: 'dared', fain: 'gladly', fatling: 'young fattened animal', fats: 'vats (for wine or oil)',
  hale: 'drag', hireling: 'hired worker', lucre: 'money, profit', minish: 'reduce', mortify: 'put to death',
  outgoings: 'boundaries, limits', paps: 'breasts', pate: 'head', pilled: 'peeled', purloining: 'stealing',
  ravin: 'prey', rereward: 'rear guard', seethe: 'boil', sop: 'piece of bread dipped in a dish', strait: 'narrow',
  surfeiting: 'overindulgence', tabret: 'small drum', usury: 'interest on a loan', wimples: 'shawls, cloaks',
  winebibber: 'heavy drinker', wit: 'know', withs: 'cords, bowstrings', yesternight: 'last night'
};
