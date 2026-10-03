/*
 * The Pilgrim's Journey — 23 sacred sites, in roughly biblical order.
 * All scripture is from the King James Version (1611 / 1769), which is in the public domain.
 * Context notes, reflections and quiz questions are original to this app.
 * x / y are positions on the stylised world map (4800 x 3200 world units).
 */
window.JOURNEY = [
  {
    id: 'eden', name: 'Garden of Eden', region: 'Mesopotamia', x: 4000, y: 1640, icon: 'garden', testament: 'OT',
    passages: [{ ref: 'Genesis 1:1-5', verses: [
      [1, 'In the beginning God created the heaven and the earth.'],
      [2, 'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.'],
      [3, 'And God said, Let there be light: and there was light.'],
      [4, 'And God saw the light, that it was good: and God divided the light from the darkness.'],
      [5, 'And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.']
    ] }],
    context: {
      setting: 'The opening words of the Bible. Genesis 2 places Eden near four rivers, two of which are the Hiddekel (Tigris) and the Euphrates, so the map puts it in ancient Mesopotamia.',
      background: 'Genesis ("beginnings") is the first of the five books of the Torah, traditionally credited to Moses. Neighbouring ancient cultures told creation stories full of warring gods. Genesis 1 is different: one God speaks, and chaos becomes order, light and life.',
      themes: ['God as Creator of all things', 'Order brought out of chaos', 'The goodness of creation', 'The power of God\'s spoken word'],
      related: ['John 1:1-5', 'Psalm 33:6', 'Hebrews 11:3']
    },
    reflect: 'God brought light into darkness by speaking. Where do you need His light in your life today?',
    quiz: [
      { q: 'According to Genesis 1:3, what was the first thing God spoke into being?', options: ['Light', 'The sea', 'Man', 'The stars'], answer: 0, explain: '"And God said, Let there be light: and there was light."' },
      { q: 'What did God call the darkness?', options: ['Evening', 'Night', 'The deep', 'Shadow'], answer: 1, explain: '"...and the darkness he called Night." (v.5)' },
      { q: 'The Spirit of God moved upon the face of the...', options: ['Earth', 'Mountains', 'Waters', 'Garden'], answer: 2, explain: '"And the Spirit of God moved upon the face of the waters." (v.2)' }
    ]
  },
  {
    id: 'ararat', name: 'Mountains of Ararat', region: 'Anatolia', x: 3450, y: 360, icon: 'mountain', testament: 'OT',
    passages: [
      { ref: 'Genesis 8:4', verses: [[4, 'And the ark rested in the seventh month, on the seventeenth day of the month, upon the mountains of Ararat.']] },
      { ref: 'Genesis 9:13', verses: [[13, 'I do set my bow in the cloud, and it shall be for a token of a covenant between me and the earth.']] }
    ],
    context: {
      setting: 'The region of Ararat (Urartu) lay in the highlands of what is now eastern Turkey and Armenia.',
      background: 'After the flood, God makes a covenant with Noah, his descendants and every living creature: He will never again destroy the earth by flood. The rainbow is the sign of that promise. This is the first covenant named as such in the Bible.',
      themes: ['Judgment and mercy', 'Covenant promises', 'New beginnings', 'God remembers His people'],
      related: ['Genesis 6:8', 'Isaiah 54:9', 'Hebrews 11:7']
    },
    reflect: 'The rainbow is a reminder that God keeps His promises. Which promise of God do you want to hold on to this week?',
    quiz: [
      { q: 'Where did the ark come to rest?', options: ['Mount Sinai', 'The mountains of Ararat', 'Mount Zion', 'Mount Carmel'], answer: 1, explain: '"...upon the mountains of Ararat." (Genesis 8:4)' },
      { q: 'What sign did God set in the cloud as a token of His covenant?', options: ['A star', 'A dove', 'His bow (rainbow)', 'A pillar of fire'], answer: 2, explain: '"I do set my bow in the cloud..." (Genesis 9:13)' },
      { q: 'Who built the ark?', options: ['Abraham', 'Noah', 'Moses', 'Enoch'], answer: 1, explain: 'God told Noah to build the ark (Genesis 6:14).' }
    ]
  },
  {
    id: 'ur', name: 'Ur of the Chaldees', region: 'Mesopotamia', x: 4090, y: 2110, icon: 'ziggurat', testament: 'OT',
    passages: [
      { ref: 'Genesis 12:1-3', verses: [
        [1, 'Now the LORD had said unto Abram, Get thee out of thy country, and from thy kindred, and from thy father\'s house, unto a land that I will shew thee:'],
        [2, 'And I will make of thee a great nation, and I will bless thee, and make thy name great; and thou shalt be a blessing:'],
        [3, 'And I will bless them that bless thee, and curse him that curseth thee: and in thee shall all families of the earth be blessed.']
      ] },
      { ref: 'Genesis 15:6', verses: [[6, 'And he believed in the LORD; and he counted it to him for righteousness.']] }
    ],
    context: {
      setting: 'Ur was a great Sumerian city near the Euphrates, known for its ziggurat temple. Abram\'s family set out from Ur and travelled to Haran before he went on to Canaan (Genesis 11:31).',
      background: 'God calls Abram (later renamed Abraham) to leave everything familiar. In return He promises land, a great nation, and that all families of the earth will be blessed through him. The rest of the Bible\'s story of redemption grows from this promise.',
      themes: ['Faith that obeys', 'God\'s promise to bless all nations', 'Leaving the familiar to follow God', 'Righteousness through belief'],
      related: ['Hebrews 11:8', 'Galatians 3:8', 'Romans 4:3']
    },
    reflect: 'Abram went out without knowing where he was going. Is God asking you to take a step of faith?',
    quiz: [
      { q: 'What did God promise to make of Abram?', options: ['A mighty king', 'A great nation', 'A rich merchant', 'A prophet'], answer: 1, explain: '"And I will make of thee a great nation..." (Genesis 12:2)' },
      { q: '"In thee shall all ______ of the earth be blessed."', options: ['Kings', 'Nations', 'Families', 'Tribes'], answer: 2, explain: 'Genesis 12:3: "...in thee shall all families of the earth be blessed."' },
      { q: 'According to Genesis 15:6, what was counted to Abram for righteousness?', options: ['His sacrifice', 'His wealth', 'His belief in the LORD', 'His journey'], answer: 2, explain: '"And he believed in the LORD; and he counted it to him for righteousness."' }
    ]
  },
  {
    id: 'redsea', name: 'Crossing the Red Sea', region: 'Egypt', x: 1560, y: 2470, icon: 'pyramid', testament: 'OT',
    passages: [{ ref: 'Exodus 14:21-22', verses: [
      [21, 'And Moses stretched out his hand over the sea; and the LORD caused the sea to go back by a strong east wind all that night, and made the sea dry land, and the waters were divided.'],
      [22, 'And the children of Israel went into the midst of the sea upon the dry ground: and the waters were a wall unto them on their right hand, and on their left.']
    ] }],
    context: {
      setting: 'Israel had been enslaved in Egypt for generations. After the ten plagues, Pharaoh let them go, then changed his mind and chased them to the edge of the sea.',
      background: 'The crossing of the sea is the central act of salvation in the Old Testament. Israel celebrates it every year at Passover. God makes a way where there seems to be none, and Israel walks from slavery to freedom.',
      themes: ['Deliverance from bondage', 'God fights for His people', 'Faith in impossible situations', 'Freedom'],
      related: ['Exodus 15:1-2', 'Psalm 106:9', 'Hebrews 11:29']
    },
    reflect: 'The Israelites were trapped between an army and the sea. What feels impossible for you right now? Bring it to God.',
    quiz: [
      { q: 'What did Moses stretch out over the sea?', options: ['His rod only', 'His hand', 'A banner', 'The ark'], answer: 1, explain: '"And Moses stretched out his hand over the sea..." (Exodus 14:21)' },
      { q: 'What kind of wind drove the sea back?', options: ['A strong west wind', 'A whirlwind', 'A strong east wind', 'A gentle breeze'], answer: 2, explain: '"...the LORD caused the sea to go back by a strong east wind all that night..."' },
      { q: 'The waters were a ______ unto them on their right hand and on their left.', options: ['Wall', 'Mirror', 'Cloud', 'Shield'], answer: 0, explain: '"...the waters were a wall unto them..." (v.22)' }
    ]
  },
  {
    id: 'sinai', name: 'Mount Sinai', region: 'Sinai Wilderness', x: 1980, y: 2760, icon: 'mountain', testament: 'OT',
    passages: [{ ref: 'Exodus 20:1-3', verses: [
      [1, 'And God spake all these words, saying,'],
      [2, 'I am the LORD thy God, which have brought thee out of the land of Egypt, out of the house of bondage.'],
      [3, 'Thou shalt have no other gods before me.']
    ] }],
    context: {
      setting: 'About three months after leaving Egypt, Israel camped at the foot of Sinai (also called Horeb). The mountain shook with thunder, fire and smoke.',
      background: 'Here God gives the Ten Commandments and makes Israel His covenant people. Note the order: God first reminds them that He has already rescued them, and only then gives the law. Obedience is a response to grace, not a way to earn it.',
      themes: ['God\'s holiness', 'The covenant law', 'Grace comes before law', 'Exclusive worship of the one true God'],
      related: ['Deuteronomy 6:4-5', 'Matthew 22:37-40', 'Exodus 19:5-6']
    },
    reflect: 'Is anything taking first place in your heart before God? What would it look like to put Him first today?',
    quiz: [
      { q: 'From where did God say He had brought Israel?', options: ['The wilderness', 'The land of Egypt, the house of bondage', 'Babylon', 'Ur of the Chaldees'], answer: 1, explain: '"...out of the land of Egypt, out of the house of bondage." (Exodus 20:2)' },
      { q: 'What is the first commandment?', options: ['Thou shalt not kill', 'Honour thy father and thy mother', 'Thou shalt have no other gods before me', 'Remember the sabbath day'], answer: 2, explain: '"Thou shalt have no other gods before me." (Exodus 20:3)' },
      { q: 'How many commandments did God give on the tablets?', options: ['Seven', 'Ten', 'Twelve', 'Forty'], answer: 1, explain: 'Exodus 34:28 calls them "the ten commandments."' }
    ]
  },
  {
    id: 'jericho', name: 'Walls of Jericho', region: 'Canaan', x: 2420, y: 1560, icon: 'city', testament: 'OT',
    passages: [
      { ref: 'Joshua 1:9', verses: [[9, 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.']] },
      { ref: 'Joshua 6:20', verses: [[20, 'So the people shouted when the priests blew with the trumpets: and it came to pass, when the people heard the sound of the trumpet, and the people shouted with a great shout, that the wall fell down flat, so that the people went up into the city, every man straight before him, and they took the city.']] }
    ],
    context: {
      setting: 'Jericho, near the Jordan River just north of the Dead Sea, is among the oldest cities on earth. It was the first city Israel faced in Canaan.',
      background: 'After Moses died, Joshua led Israel across the Jordan. God told them to march around Jericho once a day for six days, then seven times on the seventh day. The victory came by obeying God\'s unusual plan, not by military strength.',
      themes: ['Courage through God\'s presence', 'Obedience even when it seems strange', 'Victory belongs to the LORD'],
      related: ['Hebrews 11:30', 'Deuteronomy 31:6', 'Joshua 24:15']
    },
    reflect: 'God promised Joshua, "the LORD thy God is with thee whithersoever thou goest." Where do you need that courage today?',
    quiz: [
      { q: '"Be strong and of a good ______."', options: ['Heart', 'Courage', 'Spirit', 'Hope'], answer: 1, explain: 'Joshua 1:9: "Be strong and of a good courage..."' },
      { q: 'What did the priests blow before the wall fell?', options: ['Trumpets', 'Flutes', 'Shofars of silver', 'Horns of oxen'], answer: 0, explain: '"...the people shouted when the priests blew with the trumpets..." (Joshua 6:20)' },
      { q: 'What happened to the wall of Jericho?', options: ['It was burned', 'It was climbed', 'It fell down flat', 'It was dug under'], answer: 2, explain: '"...the wall fell down flat..." (Joshua 6:20)' }
    ]
  },
  {
    id: 'elah', name: 'Valley of Elah', region: 'Judah', x: 2080, y: 1830, icon: 'tent', testament: 'OT',
    passages: [
      { ref: '1 Samuel 17:45', verses: [[45, 'Then said David to the Philistine, Thou comest to me with a sword, and with a spear, and with a shield: but I come to thee in the name of the LORD of hosts, the God of the armies of Israel, whom thou hast defied.']] },
      { ref: '1 Samuel 17:49', verses: [[49, 'And David put his hand in his bag, and took thence a stone, and slang it, and smote the Philistine in his forehead, that the stone sunk into his forehead; and he fell upon his face to the earth.']] }
    ],
    context: {
      setting: 'The Valley of Elah lies in the lowlands west of Bethlehem. The armies of Israel and the Philistines camped on hills facing each other across it.',
      background: 'For forty days Goliath of Gath challenged Israel and no one would face him. David was a young shepherd who had come to bring food to his brothers. He trusted God, not King Saul\'s armour, and won with a sling and a stone.',
      themes: ['Faith over fear', 'God uses the unlikely', 'The battle is the LORD\'s'],
      related: ['1 Samuel 17:47', 'Psalm 18:2', '2 Corinthians 12:9']
    },
    reflect: 'What "giant" are you facing? David\'s confidence came from God, not from his own strength.',
    quiz: [
      { q: 'In whose name did David come against the Philistine?', options: ['King Saul', 'The LORD of hosts', 'His father Jesse', 'The prophet Samuel'], answer: 1, explain: '"...I come to thee in the name of the LORD of hosts..." (1 Samuel 17:45)' },
      { q: 'What did David use to strike Goliath?', options: ['A spear', 'A sword', 'A stone from a sling', 'An arrow'], answer: 2, explain: '"...took thence a stone, and slang it, and smote the Philistine in his forehead..." (v.49)' },
      { q: 'What people did Goliath belong to?', options: ['The Philistines', 'The Egyptians', 'The Amalekites', 'The Babylonians'], answer: 0, explain: 'Goliath was a Philistine champion from Gath (1 Samuel 17:4).' }
    ]
  },
  {
    id: 'judah', name: 'Shepherd Hills of Judah', region: 'Judah', x: 2380, y: 1960, icon: 'sheep', testament: 'OT',
    passages: [{ ref: 'Psalm 23:1-6', verses: [
      [1, 'The LORD is my shepherd; I shall not want.'],
      [2, 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.'],
      [3, 'He restoreth my soul: he leadeth me in the paths of righteousness for his name\'s sake.'],
      [4, 'Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.'],
      [5, 'Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.'],
      [6, 'Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.']
    ] }],
    context: {
      setting: 'The hills around Bethlehem were shepherd country. David grew up here keeping his father\'s sheep.',
      background: 'Psalm 23 is titled "A Psalm of David". A shepherd guided, fed, protected and searched for his flock day and night. David, a shepherd himself, describes God caring for him in exactly that way. Jesus later says, "I am the good shepherd" (John 10:11).',
      themes: ['God\'s provision and guidance', 'Peace in the darkest valleys', 'Restoration', 'Eternal hope'],
      related: ['John 10:11', 'Isaiah 40:11', 'Ezekiel 34:15']
    },
    reflect: 'Read the psalm slowly again, replacing "me" with your own name. Which line speaks to you most today?',
    quiz: [
      { q: '"The LORD is my shepherd; I shall not ______."', options: ['Fear', 'Want', 'Fall', 'Wander'], answer: 1, explain: 'Psalm 23:1' },
      { q: 'Beside what does the shepherd lead?', options: ['The river Jordan', 'The still waters', 'The great sea', 'The springs of Judah'], answer: 1, explain: '"...he leadeth me beside the still waters." (v.2)' },
      { q: 'Who is traditionally named as the author of Psalm 23?', options: ['Moses', 'Solomon', 'David', 'Asaph'], answer: 2, explain: 'The psalm\'s title is "A Psalm of David".' }
    ]
  },
  {
    id: 'nineveh', name: 'Nineveh', region: 'Assyria', x: 3570, y: 940, icon: 'ziggurat', testament: 'OT',
    passages: [
      { ref: 'Jonah 1:17 – 2:1', verses: [
        [17, 'Now the LORD had prepared a great fish to swallow up Jonah. And Jonah was in the belly of the fish three days and three nights.'],
        [1, 'Then Jonah prayed unto the LORD his God out of the fish\'s belly,']
      ] },
      { ref: 'Jonah 3:10', verses: [[10, 'And God saw their works, that they turned from their evil way; and God repented of the evil, that he had said that he would do unto them; and he did it not.']] }
    ],
    context: {
      setting: 'Nineveh, on the Tigris River, was the great capital of the Assyrian Empire and the brutal enemy of Israel.',
      background: 'God sent Jonah to warn Nineveh, but Jonah ran the other way and sailed for Tarshish. God sent a storm and a great fish. Jonah prayed from the fish\'s belly, then preached in Nineveh, and the whole city repented. The book shows God\'s mercy reaching even Israel\'s enemies.',
      themes: ['You cannot outrun God', 'Prayer from the depths', 'Repentance and mercy', 'God\'s love for all nations'],
      related: ['Matthew 12:40-41', 'Jonah 4:2', '2 Peter 3:9']
    },
    reflect: 'Jonah prayed from the darkest place imaginable, and God heard him. No place is too deep for prayer.',
    quiz: [
      { q: 'How long was Jonah in the belly of the fish?', options: ['One day', 'Three days and three nights', 'Seven days', 'Forty days'], answer: 1, explain: 'Jonah 1:17' },
      { q: 'What did Jonah do inside the fish?', options: ['He slept', 'He prayed unto the LORD', 'He wrote a letter', 'He sang to the sailors'], answer: 1, explain: '"Then Jonah prayed unto the LORD his God out of the fish\'s belly" (Jonah 2:1)' },
      { q: 'Where did Jonah first try to flee?', options: ['Egypt', 'Tarshish', 'Damascus', 'Babylon'], answer: 1, explain: 'Jonah "rose up to flee unto Tarshish from the presence of the LORD" (Jonah 1:3).' }
    ]
  },
  {
    id: 'temple', name: 'The Temple, Jerusalem', region: 'Jerusalem', x: 2260, y: 1650, icon: 'temple', testament: 'OT',
    passages: [
      { ref: 'Isaiah 6:8', verses: [[8, 'Also I heard the voice of the Lord, saying, Whom shall I send, and who will go for us? Then said I, Here am I; send me.']] },
      { ref: 'Isaiah 9:6', verses: [[6, 'For unto us a child is born, unto us a son is given: and the government shall be upon his shoulder: and his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace.']] }
    ],
    context: {
      setting: 'Isaiah saw his great vision of the LORD "high and lifted up" in the temple in Jerusalem, in the year King Uzziah died (about 740 BC).',
      background: 'Isaiah preached to Judah for more than forty years. He warned of judgment but also gave some of the brightest promises of a coming Messiah. Christians have long read Isaiah 9:6 as a prophecy of Jesus\' birth, which came about seven centuries later.',
      themes: ['The holiness of God', 'Answering God\'s call', 'The promised Messiah', 'Peace and righteous rule'],
      related: ['Isaiah 6:1-3', 'Luke 1:32-33', 'Micah 5:2']
    },
    reflect: 'Isaiah answered, "Here am I; send me." Is there someone God is putting on your heart to serve or encourage?',
    quiz: [
      { q: 'How did Isaiah answer the Lord\'s call?', options: ['"Who am I?"', '"Here am I; send me."', '"Send someone else."', '"I am not eloquent."'], answer: 1, explain: 'Isaiah 6:8' },
      { q: 'Which of these is NOT one of the names in Isaiah 9:6?', options: ['Wonderful', 'The Prince of Peace', 'The Lion of Judah', 'The mighty God'], answer: 2, explain: 'The names are Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace.' },
      { q: 'What shall be upon his shoulder?', options: ['A cross', 'The government', 'A lamb', 'A mantle'], answer: 1, explain: '"...and the government shall be upon his shoulder..." (Isaiah 9:6)' }
    ]
  },
  {
    id: 'babylon', name: 'Babylon — The Lions\' Den', region: 'Babylon', x: 3780, y: 1760, icon: 'gate', testament: 'OT',
    passages: [
      { ref: 'Daniel 6:10', verses: [[10, 'Now when Daniel knew that the writing was signed, he went into his house; and his windows being open in his chamber toward Jerusalem, he kneeled upon his knees three times a day, and prayed, and gave thanks before his God, as he did aforetime.']] },
      { ref: 'Daniel 6:22', verses: [[22, 'My God hath sent his angel, and hath shut the lions\' mouths, that they have not hurt me: forasmuch as before him innocency was found in me; and also before thee, O king, have I done no hurt.']] }
    ],
    context: {
      setting: 'Babylon, on the Euphrates, was the capital of the empire that destroyed Jerusalem in 586 BC and carried the people of Judah into exile. After Babylon fell, it came under Persian rule.',
      background: 'Daniel was taken to Babylon as a young man and rose to high office. Jealous officials persuaded King Darius to forbid prayer to anyone but the king for thirty days. Daniel kept praying as he always had, and God protected him.',
      themes: ['Faithful prayer under pressure', 'Integrity in a hostile culture', 'God\'s sovereignty over kings'],
      related: ['Daniel 3:17-18', 'Hebrews 11:33', 'Psalm 55:17']
    },
    reflect: 'Daniel\'s habit of daily prayer was already in place before the crisis came. What prayer rhythm could you build into your day?',
    quiz: [
      { q: 'How many times a day did Daniel pray?', options: ['Once', 'Twice', 'Three times', 'Seven times'], answer: 2, explain: '"...he kneeled upon his knees three times a day, and prayed..." (Daniel 6:10)' },
      { q: 'Toward which city were Daniel\'s windows open?', options: ['Babylon', 'Jerusalem', 'Nineveh', 'Bethel'], answer: 1, explain: '"...his windows being open in his chamber toward Jerusalem..."' },
      { q: 'Who shut the lions\' mouths?', options: ['Daniel himself', 'The king\'s servants', 'God\'s angel', 'A great wind'], answer: 2, explain: '"My God hath sent his angel, and hath shut the lions\' mouths..." (Daniel 6:22)' }
    ]
  },
  {
    id: 'bethlehem', name: 'Bethlehem', region: 'Judea', x: 2270, y: 1870, icon: 'star', testament: 'NT',
    passages: [
      { ref: 'Luke 2:7', verses: [[7, 'And she brought forth her firstborn son, and wrapped him in swaddling clothes, and laid him in a manger; because there was no room for them in the inn.']] },
      { ref: 'Luke 2:10-11', verses: [
        [10, 'And the angel said unto them, Fear not: for, behold, I bring you good tidings of great joy, which shall be to all people.'],
        [11, 'For unto you is born this day in the city of David a Saviour, which is Christ the Lord.']
      ] }
    ],
    context: {
      setting: 'Bethlehem ("house of bread") was a small town about six miles south of Jerusalem. It was King David\'s hometown, and the prophet Micah named it as the Messiah\'s birthplace.',
      background: 'A Roman census brought Joseph and Mary to Bethlehem. The King of kings was born in humble surroundings, and the news went first to shepherds, who were ordinary working people.',
      themes: ['God with us (Immanuel)', 'Humility', 'Good news for all people', 'Prophecy fulfilled'],
      related: ['Micah 5:2', 'Matthew 1:23', 'Philippians 2:6-8']
    },
    reflect: 'The first people to hear the news of Jesus\' birth were shepherds. Who could you share good news with today?',
    quiz: [
      { q: 'Where was the baby Jesus laid?', options: ['In a cradle', 'In a manger', 'In the temple', 'In a tent'], answer: 1, explain: '"...and laid him in a manger; because there was no room for them in the inn." (Luke 2:7)' },
      { q: 'What were the angel\'s first words to the shepherds?', options: ['"Arise and go"', '"Fear not"', '"Peace be unto you"', '"Hail"'], answer: 1, explain: '"And the angel said unto them, Fear not..." (Luke 2:10)' },
      { q: 'Bethlehem is called the city of...', options: ['Abraham', 'Moses', 'David', 'Solomon'], answer: 2, explain: '"For unto you is born this day in the city of David a Saviour..." (Luke 2:11)' }
    ]
  },
  {
    id: 'beatitudes', name: 'Mount of the Beatitudes', region: 'Galilee', x: 2380, y: 1020, icon: 'hill', testament: 'NT',
    passages: [
      { ref: 'Matthew 5:3-9', verses: [
        [3, 'Blessed are the poor in spirit: for theirs is the kingdom of heaven.'],
        [4, 'Blessed are they that mourn: for they shall be comforted.'],
        [5, 'Blessed are the meek: for they shall inherit the earth.'],
        [6, 'Blessed are they which do hunger and thirst after righteousness: for they shall be filled.'],
        [7, 'Blessed are the merciful: for they shall obtain mercy.'],
        [8, 'Blessed are the pure in heart: for they shall see God.'],
        [9, 'Blessed are the peacemakers: for they shall be called the children of God.']
      ] },
      { ref: 'Matthew 6:9-13', verses: [
        [9, 'After this manner therefore pray ye: Our Father which art in heaven, Hallowed be thy name.'],
        [10, 'Thy kingdom come. Thy will be done in earth, as it is in heaven.'],
        [11, 'Give us this day our daily bread.'],
        [12, 'And forgive us our debts, as we forgive our debtors.'],
        [13, 'And lead us not into temptation, but deliver us from evil: For thine is the kingdom, and the power, and the glory, for ever. Amen.']
      ] }
    ],
    context: {
      setting: 'Tradition places the Sermon on the Mount on a hillside above the north-western shore of the Sea of Galilee.',
      background: 'The Sermon on the Mount (Matthew 5–7) is Jesus\' longest recorded teaching. The Beatitudes turn worldly values upside down. In the middle of the sermon Jesus teaches His disciples how to pray, giving the words now known as the Lord\'s Prayer.',
      themes: ['The values of God\'s kingdom', 'Blessing in unexpected places', 'How to pray', 'Forgiveness'],
      related: ['Luke 6:20-23', 'Luke 11:1-4', 'Micah 6:8']
    },
    reflect: 'Pray the Lord\'s Prayer slowly, stopping at each line to add your own words.',
    quiz: [
      { q: 'Who "shall inherit the earth"?', options: ['The strong', 'The meek', 'The wise', 'The faithful'], answer: 1, explain: '"Blessed are the meek: for they shall inherit the earth." (Matthew 5:5)' },
      { q: 'The peacemakers shall be called...', options: ['Blessed of the Father', 'The children of God', 'The salt of the earth', 'Friends of God'], answer: 1, explain: 'Matthew 5:9' },
      { q: 'Complete the prayer: "Give us this day our ______."', options: ['Daily bread', 'Strength', 'Peace', 'Portion'], answer: 0, explain: 'Matthew 6:11' }
    ]
  },
  {
    id: 'galilee', name: 'Sea of Galilee', region: 'Galilee', x: 2500, y: 1130, icon: 'boat', testament: 'NT',
    passages: [{ ref: 'Mark 4:39-40', verses: [
      [39, 'And he arose, and rebuked the wind, and said unto the sea, Peace, be still. And the wind ceased, and there was a great calm.'],
      [40, 'And he said unto them, Why are ye so fearful? how is it that ye have no faith?']
    ] }],
    context: {
      setting: 'The Sea of Galilee is a freshwater lake about 13 miles long, sitting low between hills. Sudden, violent storms often sweep down onto it.',
      background: 'Several of the disciples were experienced fishermen, yet even they were terrified by this storm while Jesus slept in the boat. His command shows authority over nature that belongs to God alone (see Psalm 107:29).',
      themes: ['Jesus\' authority over creation', 'Faith in the storm', 'Peace that comes from His presence'],
      related: ['Psalm 107:29', 'Matthew 14:27', 'John 14:27']
    },
    reflect: 'What storm are you in right now? Picture Jesus in the boat with you, and hear Him say, "Peace, be still."',
    quiz: [
      { q: 'What did Jesus say to the sea?', options: ['"Be gone!"', '"Peace, be still."', '"Return to thy place."', '"Hear the word of the Lord."'], answer: 1, explain: 'Mark 4:39' },
      { q: 'What happened after Jesus rebuked the wind?', options: ['Rain began', 'There was a great calm', 'The boat sank', 'The disciples slept'], answer: 1, explain: '"And the wind ceased, and there was a great calm."' },
      { q: 'What did Jesus ask His disciples afterward?', options: ['"Why are ye so fearful?"', '"Where are the fish?"', '"Who touched me?"', '"Lovest thou me?"'], answer: 0, explain: '"Why are ye so fearful? how is it that ye have no faith?" (Mark 4:40)' }
    ]
  },
  {
    id: 'nicodemus', name: 'Jerusalem by Night', region: 'Jerusalem', x: 2190, y: 1575, icon: 'house', testament: 'NT',
    passages: [
      { ref: 'John 3:3', verses: [[3, 'Jesus answered and said unto him, Verily, verily, I say unto thee, Except a man be born again, he cannot see the kingdom of God.']] },
      { ref: 'John 3:16', verses: [[16, 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.']] }
    ],
    context: {
      setting: 'Nicodemus, a Pharisee and "a ruler of the Jews", came to Jesus secretly at night in Jerusalem (John 3:1-2).',
      background: 'Nicodemus was a respected teacher, yet Jesus told him he needed to be "born again", a new birth by the Spirit of God. John 3:16 may be the best-known verse in the Bible. It sums up the gospel: God\'s love, God\'s gift, our faith, and eternal life.',
      themes: ['New birth', 'The love of God for the world', 'Eternal life through faith'],
      related: ['John 1:12-13', 'Romans 5:8', '1 John 4:9-10']
    },
    reflect: 'Put your own name into John 3:16 in place of "the world" and "whosoever." Read it aloud.',
    quiz: [
      { q: 'Who came to Jesus by night?', options: ['Zacchaeus', 'Nicodemus', 'Joseph of Arimathaea', 'Lazarus'], answer: 1, explain: 'John 3:1-2' },
      { q: 'Except a man be ______, he cannot see the kingdom of God.', options: ['Baptised', 'Born again', 'Made perfect', 'Called'], answer: 1, explain: 'John 3:3' },
      { q: 'According to John 3:16, whoever believes shall have...', options: ['Great riches', 'Everlasting life', 'A long life', 'Wisdom'], answer: 1, explain: '"...should not perish, but have everlasting life."' }
    ]
  },
  {
    id: 'bethany', name: 'Bethany', region: 'Judea', x: 2350, y: 1665, icon: 'tomb', testament: 'NT',
    passages: [
      { ref: 'John 11:25', verses: [[25, 'Jesus said unto her, I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live:']] },
      { ref: 'John 11:35', verses: [[35, 'Jesus wept.']] },
      { ref: 'John 11:43', verses: [[43, 'And when he thus had spoken, he cried with a loud voice, Lazarus, come forth.']] }
    ],
    context: {
      setting: 'Bethany was a village on the Mount of Olives, about two miles from Jerusalem. It was the home of Jesus\' close friends Mary, Martha and Lazarus.',
      background: 'Lazarus had been dead four days when Jesus arrived. Jesus wept with the grieving sisters, then called Lazarus out of the tomb. This miracle points ahead to Jesus\' own resurrection only days later.',
      themes: ['Jesus shares our grief', 'Power over death', 'Resurrection hope'],
      related: ['1 Thessalonians 4:13-14', '1 Corinthians 15:55', 'Hebrews 4:15']
    },
    reflect: '"Jesus wept." He feels our sorrow with us. Bring Him whatever is grieving you.',
    quiz: [
      { q: 'Whom did Jesus raise from the dead at Bethany?', options: ['Jairus\' daughter', 'Lazarus', 'The widow\'s son', 'Dorcas'], answer: 1, explain: '"Lazarus, come forth." (John 11:43)' },
      { q: 'What is the shortest verse in the KJV Bible?', options: ['"Jesus wept."', '"Rejoice evermore."', '"Pray without ceasing."', '"God is love."'], answer: 0, explain: 'John 11:35 is just two words.' },
      { q: '"I am the resurrection, and the ______."', options: ['Way', 'Truth', 'Life', 'Light'], answer: 2, explain: 'John 11:25' }
    ]
  },
  {
    id: 'golgotha', name: 'Golgotha', region: 'Jerusalem', x: 2160, y: 1690, icon: 'cross', testament: 'NT',
    passages: [
      { ref: 'Luke 23:34', verses: [[34, 'Then said Jesus, Father, forgive them; for they know not what they do. And they parted his raiment, and cast lots.']] },
      { ref: 'Luke 23:46', verses: [[46, 'And when Jesus had cried with a loud voice, he said, Father, into thy hands I commend my spirit: and having said thus, he gave up the ghost.']] }
    ],
    context: {
      setting: 'Golgotha, "a place of a skull" (Matthew 27:33), was just outside the walls of Jerusalem. The Romans crucified people there, beside a road where everyone passing could see.',
      background: 'Crucifixion was Rome\'s cruellest and most shameful execution. Even there, Jesus\' words were prayers: forgiveness for those killing Him, and trust in His Father. Christians believe His death paid for the sins of the world.',
      themes: ['Sacrificial love', 'Radical forgiveness', 'Trust in the Father', 'Atonement'],
      related: ['Isaiah 53:5', 'Romans 5:8', '1 Peter 2:24']
    },
    reflect: 'Jesus forgave even while He was suffering. Is there someone you need to forgive? Ask God for the strength.',
    quiz: [
      { q: '"Father, forgive them; for they know not..."', options: ['"...what they say."', '"...what they do."', '"...who I am."', '"...thy ways."'], answer: 1, explain: 'Luke 23:34' },
      { q: '"Father, into thy hands I commend my ______."', options: ['Soul', 'Body', 'Spirit', 'Life'], answer: 2, explain: 'Luke 23:46' },
      { q: 'What does "Golgotha" mean?', options: ['Place of peace', 'Place of a skull', 'Hill of olives', 'House of bread'], answer: 1, explain: '"...a place called Golgotha, that is to say, a place of a skull" (Matthew 27:33)' }
    ]
  },
  {
    id: 'tomb', name: 'The Empty Tomb', region: 'Jerusalem', x: 2210, y: 1770, icon: 'tomb', testament: 'NT',
    passages: [{ ref: 'Matthew 28:5-6', verses: [
      [5, 'And the angel answered and said unto the women, Fear not ye: for I know that ye seek Jesus, which was crucified.'],
      [6, 'He is not here: for he is risen, as he said. Come, see the place where the Lord lay.']
    ] }],
    context: {
      setting: 'Jesus was buried in a new rock-cut tomb belonging to Joseph of Arimathaea, near the place of crucifixion. A great stone was rolled across the door.',
      background: 'Early on the first day of the week, women came to the tomb and found it empty. The resurrection is the centre of Christian faith. Paul writes, "if Christ be not raised, your faith is vain" (1 Corinthians 15:17).',
      themes: ['Victory over death', 'God keeps His word ("as he said")', 'Living hope', 'Joy replacing fear'],
      related: ['1 Corinthians 15:3-4', '1 Peter 1:3', 'Romans 6:4']
    },
    reflect: '"He is not here: for he is risen." How does the resurrection change the way you face today?',
    quiz: [
      { q: 'Who spoke to the women at the tomb?', options: ['Peter', 'An angel', 'A gardener', 'Joseph of Arimathaea'], answer: 1, explain: '"And the angel answered and said unto the women..." (Matthew 28:5)' },
      { q: 'What did the angel say about Jesus?', options: ['"He is sleeping."', '"He is not here: for he is risen."', '"He has gone to Galilee to fish."', '"He was taken away."'], answer: 1, explain: 'Matthew 28:6' },
      { q: 'The angel said Jesus had risen...', options: ['"...as he said."', '"...in secret."', '"...at midnight."', '"...to judge."'], answer: 0, explain: '"He is not here: for he is risen, as he said."' }
    ]
  },
  {
    id: 'upperroom', name: 'The Upper Room — Pentecost', region: 'Jerusalem', x: 2290, y: 1565, icon: 'flame', testament: 'NT',
    passages: [{ ref: 'Acts 2:1-4', verses: [
      [1, 'And when the day of Pentecost was fully come, they were all with one accord in one place.'],
      [2, 'And suddenly there came a sound from heaven as of a rushing mighty wind, and it filled all the house where they were sitting.'],
      [3, 'And there appeared unto them cloven tongues like as of fire, and it sat upon each of them.'],
      [4, 'And they were all filled with the Holy Ghost, and began to speak with other tongues, as the Spirit gave them utterance.']
    ] }],
    context: {
      setting: 'Pentecost was the Jewish harvest festival held fifty days after Passover. Jews from many nations filled Jerusalem for it.',
      background: 'Before ascending, Jesus told His followers to wait in Jerusalem for the promised Holy Spirit. When the Spirit came, the believers proclaimed God\'s works in the languages of the visiting pilgrims, and about three thousand people believed that day. Pentecost is often called the birthday of the Church.',
      themes: ['The gift of the Holy Spirit', 'Power to witness', 'The gospel for every nation', 'Unity of believers'],
      related: ['Acts 1:8', 'Joel 2:28', 'John 14:26']
    },
    reflect: 'The disciples were "all with one accord" when the Spirit came. Pray for unity and boldness in your church and community.',
    quiz: [
      { q: 'The sound from heaven was like...', options: ['Thunder', 'A rushing mighty wind', 'Many waters', 'A trumpet'], answer: 1, explain: 'Acts 2:2' },
      { q: 'What appeared and sat upon each of them?', options: ['A dove', 'Cloven tongues like as of fire', 'A bright cloud', 'Crowns of gold'], answer: 1, explain: 'Acts 2:3' },
      { q: 'What did they begin to do when filled with the Holy Ghost?', options: ['Heal the sick', 'Speak with other tongues', 'Build a church', 'Sing psalms'], answer: 1, explain: '"...and began to speak with other tongues, as the Spirit gave them utterance." (v.4)' }
    ]
  },
  {
    id: 'damascus', name: 'Road to Damascus', region: 'Syria', x: 2800, y: 820, icon: 'road', testament: 'NT',
    passages: [{ ref: 'Acts 9:3-4', verses: [
      [3, 'And as he journeyed, he came near Damascus: and suddenly there shined round about him a light from heaven:'],
      [4, 'And he fell to the earth, and heard a voice saying unto him, Saul, Saul, why persecutest thou me?']
    ] }],
    context: {
      setting: 'Damascus, one of the oldest continuously inhabited cities in the world, lay about 150 miles north-east of Jerusalem.',
      background: 'Saul of Tarsus was a zealous Pharisee who was arresting followers of Jesus. On the road to Damascus the risen Jesus met him. Saul was blinded for three days, then healed and baptised. Known as Paul, he became the greatest missionary of the early Church and wrote much of the New Testament.',
      themes: ['Grace for the undeserving', 'Total transformation', 'Jesus identifies with His people'],
      related: ['1 Timothy 1:15', '2 Corinthians 5:17', 'Galatians 1:13-16']
    },
    reflect: 'No one is beyond the reach of God\'s grace. Pray for someone who seems far from God.',
    quiz: [
      { q: 'What surrounded Saul on the road?', options: ['A great army', 'A light from heaven', 'A storm', 'A flock of birds'], answer: 1, explain: '"...suddenly there shined round about him a light from heaven" (Acts 9:3)' },
      { q: 'What did the voice ask Saul?', options: ['"Where art thou?"', '"Why persecutest thou me?"', '"Whom seekest thou?"', '"Lovest thou me?"'], answer: 1, explain: 'Acts 9:4' },
      { q: 'By what name is Saul better known?', options: ['Peter', 'Barnabas', 'Paul', 'Silas'], answer: 2, explain: '"Then Saul, (who also is called Paul,)..." (Acts 13:9)' }
    ]
  },
  {
    id: 'philippi', name: 'Philippi', region: 'Macedonia', x: 880, y: 380, icon: 'pillar', testament: 'NT',
    passages: [
      { ref: 'Philippians 4:6-7', verses: [
        [6, 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.'],
        [7, 'And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.']
      ] },
      { ref: 'Philippians 4:13', verses: [[13, 'I can do all things through Christ which strengtheneth me.']] }
    ],
    context: {
      setting: 'Philippi was a Roman colony in Macedonia (northern Greece). It was the first city in Europe where Paul planted a church (Acts 16).',
      background: 'Paul wrote this warm letter while in chains (Philippians 1:13), yet joy runs through all of it. In the KJV, "Be careful for nothing" means "Do not be anxious about anything." Paul gives prayer with thanksgiving as the answer to worry.',
      themes: ['Prayer as the cure for anxiety', 'Joy in every circumstance', 'Strength in Christ', 'Contentment'],
      related: ['1 Peter 5:7', 'Matthew 6:34', 'Isaiah 26:3']
    },
    reflect: 'List three worries. Turn each one into a request to God, and thank Him for one thing alongside each.',
    quiz: [
      { q: 'In the KJV, "Be careful for nothing" means...', options: ['Be reckless', 'Do not be anxious about anything', 'Own nothing', 'Do nothing carelessly'], answer: 1, explain: 'In 1611 English, "careful" meant "full of care", that is, anxious.' },
      { q: 'Requests are to be made known to God with...', options: ['Fasting', 'Thanksgiving', 'Sacrifice', 'Tears'], answer: 1, explain: '"...by prayer and supplication with thanksgiving..." (Philippians 4:6)' },
      { q: '"I can do all things through Christ which ______ me."', options: ['Loveth', 'Strengtheneth', 'Calleth', 'Keepeth'], answer: 1, explain: 'Philippians 4:13' }
    ]
  },
  {
    id: 'corinth', name: 'Corinth', region: 'Achaia', x: 660, y: 1000, icon: 'pillar', testament: 'NT',
    passages: [
      { ref: '1 Corinthians 13:4-7', verses: [
        [4, 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,'],
        [5, 'Doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil;'],
        [6, 'Rejoiceth not in iniquity, but rejoiceth in the truth;'],
        [7, 'Beareth all things, believeth all things, hopeth all things, endureth all things.']
      ] },
      { ref: '1 Corinthians 13:13', verses: [[13, 'And now abideth faith, hope, charity, these three; but the greatest of these is charity.']] }
    ],
    context: {
      setting: 'Corinth was a wealthy, busy port city in southern Greece, famous for its commerce and its moral looseness. Paul lived there for eighteen months (Acts 18:11).',
      background: 'The Corinthian church was gifted but divided, proud and competitive. Paul reminds them that spiritual gifts mean nothing without love. "Charity" in the KJV translates the Greek "agape", the self-giving love that God shows.',
      themes: ['The supremacy of love', 'Love in action, not feeling only', 'Unity in the church'],
      related: ['John 13:34-35', '1 John 4:7-8', 'Colossians 3:14']
    },
    reflect: 'Read verses 4-7 putting your name where "charity" appears. Which line is hardest for you? Ask God for help there.',
    quiz: [
      { q: 'What is the greatest of faith, hope and charity?', options: ['Faith', 'Hope', 'Charity', 'They are equal'], answer: 2, explain: '"...but the greatest of these is charity." (1 Corinthians 13:13)' },
      { q: '"Charity suffereth long, and is ______."', options: ['Patient', 'Kind', 'Gentle', 'Wise'], answer: 1, explain: '1 Corinthians 13:4' },
      { q: 'In the KJV, "charity" is the word used for...', options: ['Giving money', 'Love (agape)', 'Hospitality', 'Mercy'], answer: 1, explain: 'It translates the Greek "agape", self-giving love.' }
    ]
  },
  {
    id: 'patmos', name: 'Isle of Patmos', region: 'Aegean Sea', x: 1250, y: 1150, icon: 'island', testament: 'NT',
    passages: [
      { ref: 'Revelation 1:9', verses: [[9, 'I John, who also am your brother, and companion in tribulation, and in the kingdom and patience of Jesus Christ, was in the isle that is called Patmos, for the word of God, and for the testimony of Jesus Christ.']] },
      { ref: 'Revelation 21:4', verses: [[4, 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away.']] }
    ],
    context: {
      setting: 'Patmos is a small, rocky island in the Aegean Sea, used by Rome as a place of exile.',
      background: 'John was exiled to Patmos for his faith. There he received the visions recorded in Revelation, written to encourage churches under persecution. The Bible ends where it began, with God making all things new: a new heaven and a new earth where He lives with His people.',
      themes: ['Hope in suffering', 'Christ\'s final victory', 'All things made new', 'God dwelling with His people'],
      related: ['Isaiah 25:8', 'Revelation 21:1-5', 'Romans 8:18']
    },
    reflect: 'Your journey through Scripture ends with a promise: no more tears. Thank God for the hope you carry.',
    quiz: [
      { q: 'Who was on the isle called Patmos?', options: ['Paul', 'Peter', 'John', 'Timothy'], answer: 2, explain: '"I John... was in the isle that is called Patmos..." (Revelation 1:9)' },
      { q: 'What will God wipe away from their eyes?', options: ['Darkness', 'All tears', 'Blindness', 'Dust'], answer: 1, explain: 'Revelation 21:4' },
      { q: 'Which of these will NOT be in the new creation, according to Revelation 21:4?', options: ['Joy', 'Death', 'God\'s people', 'Light'], answer: 1, explain: '"...there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain..."' }
    ]
  }
];
