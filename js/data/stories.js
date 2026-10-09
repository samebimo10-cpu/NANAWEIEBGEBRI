/*
 * Bible Story Quest — 12 short side-scrolling story levels.
 * Each story links to a site in JOURNEY (its KJV passage, context and quiz).
 * Facts are brief summaries with their Bible references (KJV wording where quoted).
 */
window.STORIES = [
  {
    id: 'eden', title: 'Let There Be Light', ref: 'Genesis 1–2', icon: '🌅',
    goal: 'Walk out of the darkness into the light of the first day.',
    theme: { sky: ['#0d1430', '#3a5a8c'], sun: 'sun', far: '#2b3d62', mid: '#2f6b46', ground: '#5b4127', top: '#6fbf4a', props: ['tree', 'flower', 'tree'], weather: 'fireflies', dawn: true },
    facts: [
      { text: 'God made the heavens and the earth in six days, and rested on the seventh day.', ref: 'Genesis 2:2' },
      { text: 'Man was formed "of the dust of the ground", and God breathed into his nostrils the breath of life.', ref: 'Genesis 2:7' },
      { text: 'A river went out of Eden to water the garden, and parted into four heads.', ref: 'Genesis 2:10' }
    ]
  },
  {
    id: 'ararat', title: "Noah's Ark", ref: 'Genesis 6–9', icon: '🌈',
    goal: 'Hurry through the rain to the ark on the mountain.',
    theme: { sky: ['#2a3140', '#6b7a8c'], sun: 'none', far: '#4a5466', mid: '#3e5a4a', ground: '#4a3a2c', top: '#5f8f4a', props: ['cedar', 'rock', 'cedar'], weather: 'rain', rainbow: true },
    facts: [
      { text: 'The ark was 300 cubits long, 50 cubits wide and 30 cubits high.', ref: 'Genesis 6:15' },
      { text: 'The rain fell upon the earth forty days and forty nights.', ref: 'Genesis 7:12' },
      { text: 'The dove came back to Noah with an olive leaf in her mouth.', ref: 'Genesis 8:11' }
    ]
  },
  {
    id: 'redsea', title: 'Through the Red Sea', ref: 'Exodus 14', icon: '🌊',
    goal: 'Cross the sea on dry ground between the walls of water.',
    theme: { sky: ['#1b2a4a', '#d98a52'], sun: 'sun', far: '#6b4a3a', mid: '#8a6a44', ground: '#b89566', top: '#e2c78f', props: ['reed', 'shell', 'rock'], weather: 'wind', kind: 'redsea' },
    facts: [
      { text: 'The LORD went before Israel in a pillar of a cloud by day and a pillar of fire by night.', ref: 'Exodus 13:21' },
      { text: 'About six hundred thousand men on foot left Egypt, besides children.', ref: 'Exodus 12:37' },
      { text: 'After the crossing, Miriam took a timbrel and the women danced and sang.', ref: 'Exodus 15:20' }
    ]
  },
  {
    id: 'jericho', title: 'The Walls of Jericho', ref: 'Joshua 6', icon: '🎺',
    goal: 'March to Jericho. When you arrive, the walls fall down flat.',
    theme: { sky: ['#4a7ab8', '#f2d49a'], sun: 'sun', far: '#a07a52', mid: '#7a8a4a', ground: '#8a6a44', top: '#c9a86a', props: ['palm', 'rock', 'palm'], weather: 'dust' },
    facts: [
      { text: 'Rahab hid the two spies and tied a line of scarlet thread in her window.', ref: 'Joshua 2:18' },
      { text: 'Israel marched around the city once a day for six days.', ref: 'Joshua 6:14' },
      { text: 'On the seventh day they went around the city seven times.', ref: 'Joshua 6:15' }
    ]
  },
  {
    id: 'elah', title: 'David and Goliath', ref: '1 Samuel 17', icon: '🪨',
    goal: 'Cross the Valley of Elah and face the giant in the name of the LORD.',
    theme: { sky: ['#3d6fb0', '#cfe3f5'], sun: 'sun', far: '#7a8a6a', mid: '#5f7a44', ground: '#6a5236', top: '#8fae5a', props: ['olive', 'rock', 'tent'], weather: 'none' },
    facts: [
      { text: 'Goliath of Gath stood "six cubits and a span", nearly three metres tall.', ref: '1 Samuel 17:4' },
      { text: 'David chose five smooth stones out of the brook.', ref: '1 Samuel 17:40' },
      { text: 'As a shepherd, David had killed both a lion and a bear.', ref: '1 Samuel 17:36' }
    ]
  },
  {
    id: 'nineveh', title: 'Jonah and the Great Fish', ref: 'Jonah 1–3', icon: '🐋',
    goal: 'Leap from boat to boat across the stormy sea to Nineveh.',
    theme: { sky: ['#1f2a3a', '#4f6f86'], sun: 'none', far: '#2f3f52', mid: '#3a4a5a', ground: '#6a5a46', top: '#a08a5a', props: ['rock'], weather: 'storm', kind: 'sea', fish: true },
    facts: [
      { text: 'Jonah went down to Joppa and took a ship to flee to Tarshish.', ref: 'Jonah 1:3' },
      { text: 'The sailors cast lots, and the lot fell upon Jonah.', ref: 'Jonah 1:7' },
      { text: 'Nineveh was "an exceeding great city of three days\' journey".', ref: 'Jonah 3:3' }
    ]
  },
  {
    id: 'babylon', title: "Daniel in the Lions' Den", ref: 'Daniel 6', icon: '🦁',
    goal: 'Walk through Babylon by night to the den where God shut the lions\' mouths.',
    theme: { sky: ['#0b1028', '#2b2f5a'], sun: 'moon', stars: true, far: '#2a3a6a', mid: '#3a3060', ground: '#4a3a2c', top: '#8a7a5a', props: ['palm', 'house', 'palm'], weather: 'fireflies' },
    facts: [
      { text: 'Daniel was one of three presidents over 120 princes of the kingdom.', ref: 'Daniel 6:1-2' },
      { text: 'King Darius sealed the den with his own signet.', ref: 'Daniel 6:17' },
      { text: 'The king passed the night fasting, then rose very early and hurried to the den.', ref: 'Daniel 6:18-19' }
    ]
  },
  {
    id: 'bethlehem', title: 'A Saviour Is Born', ref: 'Luke 2', icon: '⭐',
    goal: 'Follow the star across the shepherds\' fields to Bethlehem.',
    theme: { sky: ['#070b22', '#1f2a5a'], sun: 'none', stars: true, bigStar: true, far: '#1f2a4a', mid: '#25384a', ground: '#3a3024', top: '#5a6a3a', props: ['sheep', 'olive', 'sheep'], weather: 'none' },
    facts: [
      { text: 'A decree from Caesar Augustus brought Joseph and Mary to Bethlehem.', ref: 'Luke 2:1-4' },
      { text: 'A multitude of the heavenly host appeared, praising God.', ref: 'Luke 2:13' },
      { text: 'Wise men brought gold, frankincense and myrrh.', ref: 'Matthew 2:11' }
    ]
  },
  {
    id: 'galilee', title: 'Peace, Be Still', ref: 'Mark 4', icon: '⛵',
    goal: 'Cross the storm on the Sea of Galilee to the boat where Jesus is.',
    theme: { sky: ['#1a2230', '#47566a'], sun: 'none', far: '#2a3644', mid: '#33424f', ground: '#5a4a3a', top: '#6f8a4a', props: ['rock'], weather: 'storm', kind: 'sea', calm: true },
    facts: [
      { text: 'Jesus was asleep on a pillow in the back of the ship.', ref: 'Mark 4:38' },
      { text: 'The disciples asked, "What manner of man is this, that even the wind and the sea obey him?"', ref: 'Mark 4:41' },
      { text: 'Peter, Andrew, James and John were fishermen before they followed Jesus.', ref: 'Matthew 4:18-21' }
    ]
  },
  {
    id: 'golgotha', title: 'The Cross', ref: 'Luke 23', icon: '✝️',
    goal: 'Climb the road to Golgotha, outside the city.',
    theme: { sky: ['#1a1018', '#5a3a3a'], sun: 'dim', far: '#3a2a2a', mid: '#4a3a30', ground: '#4a3a2c', top: '#7a6a4a', props: ['rock', 'olive', 'rock'], weather: 'dust', dark: true },
    facts: [
      { text: 'The title on the cross was written in Hebrew, Greek and Latin.', ref: 'John 19:20' },
      { text: 'Darkness covered the land from the sixth hour until the ninth hour.', ref: 'Luke 23:44' },
      { text: 'The veil of the temple was torn in the midst.', ref: 'Luke 23:45' }
    ]
  },
  {
    id: 'tomb', title: 'He Is Risen', ref: 'Matthew 28', icon: '🌄',
    goal: 'Go early to the garden tomb as the sun rises.',
    theme: { sky: ['#2a2a5a', '#f2a76a'], sun: 'sunrise', far: '#5a4a6a', mid: '#4a6a4a', ground: '#5a4a36', top: '#7fae5a', props: ['flower', 'olive', 'flower'], weather: 'petals' },
    facts: [
      { text: 'Joseph of Arimathaea laid Jesus in his own new tomb, hewn out in the rock.', ref: 'Matthew 27:57-60' },
      { text: 'The risen Jesus appeared first to Mary Magdalene.', ref: 'Mark 16:9' },
      { text: 'He was seen by more than five hundred brethren at once.', ref: '1 Corinthians 15:6' }
    ]
  },
  {
    id: 'upperroom', title: 'Pentecost', ref: 'Acts 2', icon: '🔥',
    goal: 'Run through Jerusalem to the upper room as the mighty wind blows.',
    theme: { sky: ['#3a6aa8', '#f6d9a0'], sun: 'sun', far: '#a08a6a', mid: '#c2a77a', ground: '#7a6046', top: '#d8c39a', props: ['house', 'palm', 'house'], weather: 'sparks' },
    facts: [
      { text: 'Pentecost means "fiftieth". It was the Feast of Weeks, fifty days after Passover.', ref: 'Leviticus 23:16' },
      { text: 'Peter preached, saying this was what the prophet Joel had spoken of.', ref: 'Acts 2:16' },
      { text: 'About three thousand souls were added to the believers that day.', ref: 'Acts 2:41' }
    ]
  }
];
