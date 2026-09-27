/* KARLCON Studio — Season 2, part two: FROM STAND TO KEYS.
   Six long episodes (Season 2 · Episodes 11–16) that follow one build from an empty stand to the day you
   get the keys, one stage per episode, each staged on one of the Heritage Series houses.
   Every episode runs the same segments, made for people who watch a whole Facebook Live:
     cold open (a question you want answered) · Heritage Corner (what our grandparents already knew) ·
     The Stage (the build, animated on the house behind us) · Myth or Fact (three quick-fire) ·
     Your Questions (the ones people send us most) · The Costly Mistakes (a checklist) ·
     The House Behind Us (the Season 2 design) · Comment below (a 1-or-2 poll) · next time.
   `music:` on a line tells the playlist what the show is doing (calm stories, hype quick-fire), see playlist.js.
   House rules as the rest of the series: engineering numbers only from the LB-1 engineering file, no prices
   quoted on air, council and legal steps described in general (every council has its own forms and fees),
   and every new mechanism called a concept until it is designed, tested and built.
   Appended to KC_EPISODES_S2, so /studio?season=2&ep=11 and `node render.mjs --season 2 --ep 11`. */
(() => {
  const PART = 'From Stand to Keys';
  const seg = (title, lines) => ({ kicker: PART, title, lines });
  const MYTH = (n, claim, verdict) => ({ kicker: `Myth or fact · ${n} of 3`, title: claim, lines: [verdict] });
  const POLL = (q, a, b) => ({ kicker: 'Comment below', title: q, lines: [`Type 1: ${a}`, `Type 2: ${b}`] });
  const ASK = (q) => ({ kicker: 'Your questions', title: q, lines: ['Send yours: @karlcon_lumen_builds_zw'] });
  const MAP = (now) => ({ kicker: PART, title: 'Six stages, one house', lines: ['1 The stand', '2 Plans and approvals', '3 Foundations', '4 Walls', '5 Roof and light', '6 Power, water and keys'].map((l, i) => (i + 1 === now ? `▶ ${l}` : l)) });
  const HONEST = { kicker: 'Honest engineering', title: 'What is proven, what is concept', lines: ['Proven on LB-1: 555 N lift, 1,544 N wind hold per actuator', 'Glass: 10.38 heat-strengthened laminated', 'New roof lights: concepts until designed and tested'] };
  const next = (no, title, city) => ({ kicker: `Next · Episode ${no}`, title, lines: [city, 'Follow @karlcon_lumen_builds_zw'] });

  const list = window.KC_EPISODES_S2 = window.KC_EPISODES_S2 || [];
  list.push({
    /* ================= S2 EPISODE 11 — The Stand · Harare ================= */
    id: 's2e11-the-stand', no: 11, season: 2, music: 'groove',
    title: 'From Stand to Keys: The Stand',
    subtitle: `Season 2 · Episode 11 · Harare · ${PART}, part 1 of 6`,
    concept: 'rondavel-concept', city: 'harare',
    lines: [
      { who: 'luma', cam: 'wide', build: 7, open: 0, mood: 'smile', look: 'camera', music: 'hype',
        slide: { kicker: `Season 2 · ${PART}`, title: 'Before you buy a stand, watch this', lines: ['Six episodes', 'One house, from bare ground to the keys', 'Stage 1: the stand'] },
        say: "Before you pay a single dollar for a stand, stay with us for the next few minutes. Welcome to From Stand to Keys, the long build on KARLCON Studios." },
      { who: 'karl', cam: 'cu', mood: 'smile',
        say: "Six episodes, one house, every stage from bare ground to the day you get the keys. Tonight is stage one, the stand. Most of the money people lose on a build, they lose right here, before anything is built." },
      { who: 'luma', cam: 'screen', look: 'screen', slide: MAP(1),
        say: "Here's the whole journey. The stand, plans and approvals, foundations, walls, the roof and the light, and last, power, water and the keys. Behind us, the KARLCON Rondavel, which we'll build stage by stage as we go." },
      { who: 'luma', cam: 'two',
        say: "So Karl, somebody at home has saved for years and they've found a stand. What's the first thing they do?" },
      { who: 'karl', cam: 'cu', mood: 'serious',
        say: "Slow down. Excitement is expensive. The first thing is paperwork, not bricks. Who is selling it, and can they actually sell it?" },

      /* — Heritage Corner — */
      { who: 'luma', cam: 'globe', look: 'globe', music: 'calm',
        slide: seg('Heritage Corner', ['Where our grandparents built', 'High, dry ground', 'Near water, not in its path']),
        say: "Heritage Corner. Before any of us had title deeds, our grandparents still chose their ground carefully. Karl, what did they know?" },
      { who: 'karl', cam: 'cu',
        say: "They built on the higher, drier ground and kept the homestead out of the path of the water. Near the river for the cattle and the gardens, never in the vlei. When the rains came, the huts stayed dry." },
      { who: 'luma', cam: 'cu', mood: 'smile',
        say: "And the doorway usually faced away from the weather." },
      { who: 'karl', cam: 'two',
        say: "Exactly. Read the land before you build on it. That hasn't changed. We just have surveyors and soil tests to help us now." },

      /* — The Stage — */
      { who: 'luma', cam: 'house', look: 'house', music: 'groove', build: 0,
        slide: seg('The stage: choosing the stand', ['Who owns it, and can they sell it?', 'Is it surveyed, with pegs you can find?', 'Is it serviced: road, water, sewer, power?', 'What does the ground do when it rains?']),
        say: "The stage. Walk us round the stand, Karl. What are we checking?" },
      { who: 'karl', cam: 'house', look: 'house', point: true,
        say: "Four things. One, ownership. Title deeds, or proper paperwork from the rightful developer, and you check it yourself at the council and the deeds office, not just with the seller." },
      { who: 'karl', cam: 'cu',
        say: "Two, the survey. A surveyed stand has pegs at the corners. Find them. Stand on them. If nobody can show you the pegs, that's your answer." },
      { who: 'luma', cam: 'react',
        say: "And three?" },
      { who: 'karl', cam: 'cu',
        say: "Services. Is there a road, council water, a sewer line, power? If not, that's fine, but budget now for a borehole, a tank, a septic system and solar. Those are real costs, and they belong in the plan from day one." },
      { who: 'karl', cam: 'house', look: 'house', build: 1,
        say: "Four, the ground itself. Visit it in the rainy season. Where does the water sit? Where does it run? The best stand in the dry season can be a pond in January." },
      { who: 'luma', cam: 'globe', look: 'globe', build: 2,
        slide: seg('The sun in Zimbabwe', ['We are south of the equator', 'The sun sits in the north', 'Living rooms face north, bedrooms east']),
        say: "And the sun. People forget the sun." },
      { who: 'karl', cam: 'cu',
        say: "We're south of the equator, so the sun sits in the north. Put the living rooms facing north, with a good overhang, and they're bright and warm in winter and shaded in summer. Morning sun for the bedrooms, on the east side. It's free, and you only get to choose it once." },

      /* — Myth or Fact — */
      { who: 'luma', cam: 'two', mood: 'smile', music: 'hype',
        slide: { kicker: 'Myth or fact', title: 'Three quick ones', lines: ['Karl answers', 'You keep score in the comments'] },
        say: "Time for Myth or Fact! Three quick ones. Karl, no long answers." },
      { who: 'luma', cam: 'cu', slide: MYTH(1, '“A cheap stand is always a good deal”', 'Myth: check what it costs to make it buildable'),
        say: "A cheap stand is always a good deal." },
      { who: 'karl', cam: 'cu',
        say: "Myth. If it needs a borehole, a long power line and a road, the cheap stand can end up the expensive one." },
      { who: 'luma', cam: 'cu', slide: MYTH(2, '“A corner stand gives you more options”', 'Fact, mostly: two frontages, more light'),
        say: "A corner stand gives you more options." },
      { who: 'karl', cam: 'cu',
        say: "Fact, mostly. Two frontages, more light, more ways in. Just check the building lines on both sides first." },
      { who: 'luma', cam: 'cu', slide: MYTH(3, '“Pegs don’t matter, the neighbours know the boundary”', 'Myth: only the surveyor’s pegs count'),
        say: "Pegs don't matter, the neighbours know where the boundary is." },
      { who: 'karl', cam: 'cu', mood: 'serious',
        say: "Myth, and it's the one that ends in court. Only the surveyor's pegs count." },

      /* — Your Questions — */
      { who: 'luma', cam: 'two', music: 'groove', slide: ASK('Can I build on a stand I am still paying off?'),
        say: "Your questions. The one we get the most: can I start building on a stand I'm still paying off?" },
      { who: 'karl', cam: 'cu',
        say: "Read your agreement of sale, and ask the developer and the council in writing. Some allow it, some don't. What you don't want is a house on land that isn't legally yours yet." },
      { who: 'luma', cam: 'cu', slide: ASK('How big should my stand be for a rondavel home?'),
        say: "And: how big a stand do I need for something like the Rondavel behind us?" },
      { who: 'karl', cam: 'house', look: 'house', point: true, build: 4,
        say: "The Rondavel is compact. The real limits are your council's building lines and coverage rules. Leave room for the septic system if you need one, the tank stand, the solar, and a yard for the children." },

      /* — The Costly Mistakes — */
      { who: 'luma', cam: 'screen', look: 'screen',
        slide: seg('Costly mistakes at stage 1', ['Paying cash with no paperwork', 'Never seeing the pegs', 'Never visiting in the rains', 'Forgetting water, power and sewer']),
        say: "The costly mistakes. What have you seen go wrong at this stage?" },
      { who: 'karl', cam: 'cu', mood: 'serious',
        say: "Cash with no paperwork. Never seeing the pegs. Never visiting in the rains. And not budgeting for water and power. Any one of those can cost more than the house." },
      { who: 'luma', cam: 'cu', mood: 'smile',
        say: "Screenshot that list, everyone. Send it to whoever is buying a stand this year." },

      /* — The House Behind Us — */
      { who: 'luma', cam: 'house', look: 'house', build: 7,
        say: "Now the house behind us, the KARLCON Rondavel. Watch the stand turn into a home." },
      { who: 'karl', cam: 'roof', look: 'roof', open: 1, music: 'hype',
        say: "A round white drum, a wide cone in white panels, and a roof light right at the apex, two glass leaves opening into a V. On a north-facing stand, that apex light brings in daylight all day." },
      { who: 'karl', cam: 'cu', slide: HONEST,
        say: "Honest engineering, as always. The actuators are from the family we proved on LB-1, 555 newtons of lift and 1,544 newtons of wind hold each. This roof light is a concept until it's designed and tested." },

      /* — Comment below — */
      { who: 'luma', cam: 'two', mood: 'smile', open: 0,
        slide: POLL('Where would you build?', 'In the city, on a serviced stand', 'Out of town, with a borehole and solar'),
        say: "Your turn. Where would you build? Type 1 for the city on a serviced stand, 2 for out of town with a borehole and solar. We read every comment." },
      { who: 'karl', cam: 'cu', mood: 'smile',
        say: "I'm a 2. Quiet, big sky, and a roof light full of stars." },
      { who: 'luma', cam: 'wide', slide: next(12, 'Plans and approvals', 'Your plans, the engineer and the council'),
        say: "Next time, stage two: plans and approvals, and why the council inspector is on your side. I'm Luma." },
      { who: 'karl', cam: 'wide', mood: 'smile',
        say: "I'm Karl. Find your pegs this week. See you next episode." }
    ]
  }, {
    /* ================= S2 EPISODE 12 — Plans & Approvals · Harare ================= */
    id: 's2e12-plans', no: 12, season: 2, music: 'groove',
    title: 'From Stand to Keys: Plans and Approvals',
    subtitle: `Season 2 · Episode 12 · Harare · ${PART}, part 2 of 6`,
    concept: 'chevron-pavilion', city: 'harare',
    lines: [
      { who: 'luma', cam: 'wide', build: 7, open: 0, mood: 'smile', look: 'camera', music: 'hype',
        slide: { kicker: `Season 2 · ${PART}`, title: 'The paper house comes first', lines: ['Stage 2: plans and approvals', 'Why skipping it costs you twice'] },
        say: "What's the most expensive building in Zimbabwe? The one that has to be knocked down because it was never approved. Welcome back to From Stand to Keys." },
      { who: 'karl', cam: 'cu',
        say: "Stage two, plans and approvals. You build the house on paper first, properly, and then you build it once in brick." },
      { who: 'luma', cam: 'screen', look: 'screen', slide: MAP(2),
        say: "Last time we found the stand. Tonight, the paper house. Behind us, the Chevron Pavilion, and its roof is a good lesson in why drawings matter." },

      /* — Heritage Corner — */
      { who: 'luma', cam: 'globe', look: 'globe', music: 'calm',
        slide: seg('Heritage Corner', ['Patterns with meaning', 'The chevron on Great Zimbabwe’s walls', 'A plan everyone understood']),
        say: "Heritage Corner. Our builders didn't have paper plans, but they had patterns everybody understood." },
      { who: 'karl', cam: 'cu',
        say: "Look at the chevron band on the walls of Great Zimbabwe. That pattern was planned, course by course, stone by stone, by people who knew exactly what the finished wall would look like before they laid the first stone." },
      { who: 'luma', cam: 'cu', mood: 'smile',
        say: "So the plan was in their heads." },
      { who: 'karl', cam: 'two',
        say: "In their heads and in their tradition. Today the tradition is a drawing, an engineer's stamp and a council approval. Same idea: everyone agrees on the wall before it goes up." },

      /* — The Stage — */
      { who: 'luma', cam: 'house', look: 'house', music: 'groove', build: 0,
        slide: seg('The stage: plans and approvals', ['Your brief: how you will live', 'Architect or draughtsman: the drawings', 'Structural engineer: the calculations', 'Council: approval before you dig']),
        say: "The stage. Who does what, Karl?" },
      { who: 'karl', cam: 'cu',
        say: "It starts with you, and a brief. How many people, how you cook, where the children sleep, whether you'll add rooms later. Write it down. That's the most useful page in the whole project." },
      { who: 'karl', cam: 'house', look: 'house', point: true, build: 2,
        say: "Then an architect or a qualified draughtsman turns it into drawings. Plans, sections, elevations, where every window goes and which way the house faces." },
      { who: 'luma', cam: 'react',
        say: "And the engineer?" },
      { who: 'karl', cam: 'cu',
        say: "The structural engineer does the calculations. Foundations, beams, the roof. A roof like this chevron, folding up and down in a zigzag, is exactly where you need one, because the loads don't go where a normal roof sends them." },
      { who: 'karl', cam: 'house', look: 'house', build: 4,
        say: "Then the drawings go to your local council for approval. Every council has its own forms and fees, so ask them directly. Don't dig until the plans are approved." },
      { who: 'luma', cam: 'cu', mood: 'serious',
        slide: seg('The building inspector', ['Visits at key stages', 'Call before you cover work up', 'Your free second pair of eyes']),
        say: "And then the building inspector. People are scared of the inspector." },
      { who: 'karl', cam: 'cu', mood: 'smile',
        say: "Don't be. The inspector comes at key stages, before the concrete covers the trenches, before the roof closes things in. Call them before you cover anything up. They're a free second pair of eyes on your money." },

      /* — Myth or Fact — */
      { who: 'luma', cam: 'two', mood: 'smile', music: 'hype',
        slide: { kicker: 'Myth or fact', title: 'Three quick ones', lines: ['Karl answers', 'You keep score in the comments'] },
        say: "Myth or Fact! Karl, you know the rules. Short answers." },
      { who: 'luma', cam: 'cu', slide: MYTH(1, '“I can build first and get approval later”', 'Myth: you risk demolition and fines'),
        say: "I can build first and get approval later." },
      { who: 'karl', cam: 'cu', mood: 'serious',
        say: "Myth. You risk fines and a demolition order, and you'll struggle to sell or insure it." },
      { who: 'luma', cam: 'cu', slide: MYTH(2, '“Good drawings save money on site”', 'Fact: every change on paper is cheap'),
        say: "Good drawings save money on site." },
      { who: 'karl', cam: 'cu',
        say: "Fact. Moving a wall on paper costs an eraser. Moving it on site costs a wall." },
      { who: 'luma', cam: 'cu', slide: MYTH(3, '“Any builder can do the engineer’s job”', 'Myth: calculations need an engineer'),
        say: "Any good builder can do the engineer's job." },
      { who: 'karl', cam: 'cu',
        say: "Myth. A good builder builds what's calculated. The calculations belong to an engineer." },

      /* — Your Questions — */
      { who: 'luma', cam: 'two', music: 'groove', slide: ASK('Can I use a plan from the internet?'),
        say: "Your questions. Can I use a house plan I found on the internet?" },
      { who: 'karl', cam: 'cu',
        say: "As inspiration, yes. As your plan, no. It was drawn for someone else's stand, soil and climate. Take it to a local professional and have it adapted and drawn properly for your stand." },
      { who: 'luma', cam: 'cu', slide: ASK('Can I plan now and build in phases?'),
        say: "And: can I get the full house approved but build it in phases?" },
      { who: 'karl', cam: 'cu', mood: 'smile',
        say: "That's one of the smartest things you can do. Design the whole house, get it approved, then build phase one so phase two joins on cleanly. The foundations and drainage for later rooms are planned from day one." },

      /* — The Costly Mistakes — */
      { who: 'luma', cam: 'screen', look: 'screen',
        slide: seg('Costly mistakes at stage 2', ['No written brief', 'Unapproved plans', 'No engineer for the roof', 'Changing the design on site']),
        say: "The costly mistakes at stage two." },
      { who: 'karl', cam: 'cu', mood: 'serious',
        say: "No written brief, so the house doesn't fit the family. Unapproved plans. No engineer on a roof that needs one. And changing your mind on site, which is the most expensive way to design a house." },

      /* — The House Behind Us — */
      { who: 'luma', cam: 'house', look: 'house', build: 7,
        say: "Let's see the paper house become a real one. The Chevron Pavilion." },
      { who: 'karl', cam: 'house', look: 'house', point: true, music: 'hype',
        say: "A roof folded into a zigzag, like the chevron band on the old walls. Every fold is a line on the drawings long before it's steel on site." },
      { who: 'karl', cam: 'roof', look: 'roof', open: 1,
        say: "And the roof light opens along the folds. A concept, until the engineer has drawn and tested it. That's this whole episode in one roof." },

      /* — Comment below — */
      { who: 'luma', cam: 'two', mood: 'smile', open: 0,
        slide: POLL('How would you build?', 'All at once', 'In phases, room by room'),
        say: "Comment below. Would you build all at once, type 1, or in phases, room by room, type 2?" },
      { who: 'karl', cam: 'cu',
        say: "Either works, as long as the whole house is on paper first." },
      { who: 'luma', cam: 'wide', slide: next(13, 'Foundations', 'Black cotton soil, footings and the damp-proof course'),
        say: "Next time, stage three, foundations, and the soil that cracks houses all over Zimbabwe. I'm Luma." },
      { who: 'karl', cam: 'wide', mood: 'smile',
        say: "I'm Karl. Draw it first. See you next episode." }
    ]
  }, {
    /* ================= S2 EPISODE 13 — Foundations · Bulawayo ================= */
    id: 's2e13-foundations', no: 13, season: 2, music: 'groove',
    title: 'From Stand to Keys: Foundations',
    subtitle: `Season 2 · Episode 13 · Bulawayo · ${PART}, part 3 of 6`,
    concept: 'matobo-boulder-house', city: 'bulawayo',
    lines: [
      { who: 'luma', cam: 'wide', build: 7, open: 0, mood: 'smile', look: 'camera', music: 'hype',
        slide: { kicker: `Season 2 · ${PART}`, title: 'Why do so many walls crack?', lines: ['Stage 3: foundations', 'The part of the house nobody sees'] },
        say: "Seen a crack running up a wall from the corner of a window? Tonight you'll find out where it really started. Welcome to From Stand to Keys." },
      { who: 'karl', cam: 'cu',
        say: "Stage three, foundations. The part nobody sees, and the part that decides whether everything above it stays straight." },
      { who: 'luma', cam: 'screen', look: 'screen', slide: MAP(3),
        say: "We have a stand and approved plans. Now we dig. And behind us, the Matobo Boulder House, a house that sits among granite." },

      /* — Heritage Corner — */
      { who: 'luma', cam: 'globe', look: 'globe', music: 'calm',
        slide: seg('Heritage Corner', ['Great Zimbabwe: dry stone, no mortar', 'Standing for centuries', 'Built on granite']),
        say: "Heritage Corner. The walls of Great Zimbabwe have stood for centuries, without mortar. How?" },
      { who: 'karl', cam: 'cu',
        say: "A big part of it is what they stand on. Granite. Solid ground that doesn't move. The builders chose it, and they shaped the walls to it." },
      { who: 'luma', cam: 'cu',
        say: "And in the Matopos, people have lived among the boulders for thousands of years." },
      { who: 'karl', cam: 'two',
        say: "The lesson is the same. Know your ground. Our ancestors could see the granite. We have to dig and test to find out what we're standing on." },

      /* — The Stage — */
      { who: 'luma', cam: 'house', look: 'house', music: 'groove', build: 0,
        slide: seg('The stage: foundations', ['Soil test first', 'Setting out and trenches', 'Footings and foundation walls', 'Damp-proof course and slab']),
        say: "The stage. From bare ground, Karl." },
      { who: 'karl', cam: 'house', look: 'house', point: true,
        say: "A soil test first, so the engineer knows what the foundations sit on. Then the setting out, the house marked on the ground from the pegs and the drawings, and the trenches dug." },
      { who: 'luma', cam: 'cu', mood: 'serious',
        slide: seg('Black cotton soil', ['Dark clay found in many parts of Zimbabwe', 'Swells when wet, shrinks when dry', 'Moves foundations, cracks walls', 'The engineer designs for it']),
        say: "And the soil that cracks houses. Black cotton soil." },
      { who: 'karl', cam: 'cu', mood: 'serious',
        say: "Dark clay you'll find in many parts of the country. It swells in the rains and shrinks in the dry season, and it pushes foundations up and down with it. That's your crack by the window. If the test finds it, the engineer designs for it. Never guess." },
      { who: 'karl', cam: 'house', look: 'house', build: 1,
        say: "Then the footings, concrete at the bottom of the trenches, and the foundation walls on top. Here it's the columns going up among the boulders." },
      { who: 'luma', cam: 'react',
        say: "And termites. Everyone asks about termites." },
      { who: 'karl', cam: 'cu',
        say: "The ground under the slab is treated against termites before the concrete goes in, by a proper pest control service. Do it once, properly, before it's covered." },
      { who: 'karl', cam: 'house', look: 'house', build: 2,
        slide: seg('The damp-proof course', ['A membrane in the wall above ground', 'Stops water climbing into the walls', 'Inspected before it is covered']),
        say: "Then the damp-proof course, a membrane in the wall just above the ground, so water can't climb into your walls. And the floor slab. Call the inspector before anything is covered." },

      /* — Myth or Fact — */
      { who: 'luma', cam: 'two', mood: 'smile', music: 'hype',
        slide: { kicker: 'Myth or fact', title: 'Three quick ones', lines: ['Karl answers', 'You keep score in the comments'] },
        say: "Myth or Fact! Foundations edition." },
      { who: 'luma', cam: 'cu', slide: MYTH(1, '“More cement always makes stronger concrete”', 'Myth: the right mix and curing matter'),
        say: "More cement always makes stronger concrete." },
      { who: 'karl', cam: 'cu',
        say: "Myth. The right mix, the right amount of water, and keeping it damp while it cures. Not just more cement." },
      { who: 'luma', cam: 'cu', slide: MYTH(2, '“Most cracks start in the ground”', 'Fact: many start with movement below'),
        say: "Most cracks start in the ground." },
      { who: 'karl', cam: 'cu',
        say: "Fact, very often. The wall is just where you notice it." },
      { who: 'luma', cam: 'cu', slide: MYTH(3, '“You can skip the damp-proof course on dry land”', 'Myth: ground moisture is always there'),
        say: "On dry land, you can skip the damp-proof course." },
      { who: 'karl', cam: 'cu', mood: 'serious',
        say: "Myth. There's moisture in all ground, and the rains always come. Keep it." },

      /* — Your Questions — */
      { who: 'luma', cam: 'two', music: 'groove', slide: ASK('My stand is on a slope. Is that a problem?'),
        say: "Your questions. My stand is on a slope. Is that a problem?" },
      { who: 'karl', cam: 'house', look: 'house', point: true, build: 4,
        say: "It's an opportunity, if it's designed for. Stepped foundations, or a house that terraces down the hill. It costs more in the ground, and gives you views. Look at this one, standing among the boulders." },
      { who: 'luma', cam: 'cu', slide: ASK('How long should concrete cure?'),
        say: "And: how long should I wait before building on the slab?" },
      { who: 'karl', cam: 'cu',
        say: "Ask your engineer, it depends on the mix and the weather. What never changes is to keep it damp while it cures, especially in our heat. Concrete that dries too fast is weaker." },

      /* — The Costly Mistakes — */
      { who: 'luma', cam: 'screen', look: 'screen',
        slide: seg('Costly mistakes at stage 3', ['No soil test', 'Building on black cotton soil as if it were rock', 'Skipping termite treatment', 'Covering work before inspection']),
        say: "The costly mistakes at stage three." },
      { who: 'karl', cam: 'cu', mood: 'serious',
        say: "No soil test. Treating clay as if it were rock. Skipping the termite treatment. And pouring concrete over work nobody has inspected. You can't fix a foundation later without lifting the house." },

      /* — The House Behind Us — */
      { who: 'luma', cam: 'house', look: 'house', build: 7,
        say: "The Matobo Boulder House. Let's finish it." },
      { who: 'karl', cam: 'house', look: 'house', point: true, music: 'hype',
        say: "Built among the granite the way the Matopos have been lived in for thousands of years, with the boulders left where they are." },
      { who: 'karl', cam: 'roof', look: 'roof', open: 1,
        say: "And the roof light opens outward, like wings. A concept for now, like every new mechanism on this show, and the actuators come from the family proven on LB-1." },

      /* — Comment below — */
      { who: 'luma', cam: 'two', mood: 'smile', open: 0,
        slide: POLL('Your stand is on a slope. Do you…', 'Level it flat', 'Step the house down the hill'),
        say: "Comment below. Your stand is on a slope. Type 1 to level it flat, 2 to step the house down the hill." },
      { who: 'karl', cam: 'cu', mood: 'smile',
        say: "I'll take the view every time. That's a 2." },
      { who: 'luma', cam: 'wide', slide: next(14, 'Walls', 'Bricks, mortar, the ring beam and a cool house'),
        say: "Next time, stage four: walls. Which bricks, and how to build a house that stays cool without air conditioning. I'm Luma." },
      { who: 'karl', cam: 'wide', mood: 'smile',
        say: "I'm Karl. Test your soil. See you next episode." }
    ]
  }, {
    /* ================= S2 EPISODE 14 — Walls · Masvingo ================= */
    id: 's2e14-walls', no: 14, season: 2, music: 'groove',
    title: 'From Stand to Keys: Walls',
    subtitle: `Season 2 · Episode 14 · Masvingo · ${PART}, part 4 of 6`,
    concept: 'triple-rondavel-cluster', city: 'masvingo',
    lines: [
      { who: 'luma', cam: 'wide', build: 7, open: 0, mood: 'smile', look: 'camera', music: 'hype',
        slide: { kicker: `Season 2 · ${PART}`, title: 'A cool house with no aircon?', lines: ['Stage 4: walls', 'Bricks, mortar and the ring beam'] },
        say: "Can a house stay cool in an October heatwave with no air conditioning? Yes, and it starts with the walls. Welcome back to From Stand to Keys." },
      { who: 'karl', cam: 'cu',
        say: "Stage four, walls. The part everyone can see going up, and the part where a lot of money quietly goes to waste." },
      { who: 'luma', cam: 'screen', look: 'screen', slide: MAP(4),
        say: "Foundations are in and inspected. Now the walls. Behind us, the Triple Rondavel Cluster, three round rooms, in Masvingo, close to Great Zimbabwe itself." },

      /* — Heritage Corner — */
      { who: 'luma', cam: 'globe', look: 'globe', music: 'calm',
        slide: seg('Heritage Corner', ['Thick walls of earth and stone', 'Cool by day, warm by night', 'Round rooms around a shared yard']),
        say: "Heritage Corner. Step into a traditional hut at midday and it's cool inside. Why?" },
      { who: 'karl', cam: 'cu',
        say: "Thick walls of earth and stone. They soak up the day's heat slowly and give it back at night. Engineers call it thermal mass. Our grandmothers just called it a good hut." },
      { who: 'luma', cam: 'cu', mood: 'smile',
        say: "And a homestead was never one building." },
      { who: 'karl', cam: 'two',
        say: "Never. A kitchen hut, sleeping huts, all round a shared yard. That's the idea behind the Triple Rondavel Cluster." },

      /* — The Stage — */
      { who: 'luma', cam: 'house', look: 'house', music: 'groove', build: 1,
        slide: seg('The stage: walls', ['Choosing the brick', 'Mortar, courses and openings', 'Lintels over doors and windows', 'The ring beam on top']),
        say: "The stage. Let's build the walls." },
      { who: 'karl', cam: 'cu',
        slide: seg('Which brick?', ['Burnt clay bricks: good mass, check the quality', 'Cement bricks and blocks: even sizes', 'Whatever you choose: consistent quality']),
        say: "First, the brick. Burnt clay bricks give you good mass, but check the batch, a soft brick is a weak wall. Cement bricks and blocks are more even. Whatever you choose, it has to be good, consistent quality, all the way up." },
      { who: 'karl', cam: 'house', look: 'house', build: 3, point: true,
        say: "Then the walls go up, course by course, level and plumb, with the mortar mixed properly, not stretched with extra sand. On a round room, the setting out has to be perfect, or the circle wanders." },
      { who: 'luma', cam: 'react',
        say: "And above the windows?" },
      { who: 'karl', cam: 'cu',
        say: "Lintels, over every door and window, to carry the wall above the opening. And on top of the walls, a ring beam, a band of reinforced concrete that ties the whole building together. On a round house it's literally a ring." },
      { who: 'luma', cam: 'house', look: 'house', build: 4,
        slide: seg('Keeping cool', ['Thick or insulated walls', 'Openings on both sides: cross-breeze', 'Deep overhangs over the glass', 'Light colours outside']),
        say: "And how do the walls keep it cool?" },
      { who: 'karl', cam: 'cu',
        say: "Mass or insulation, windows on opposite sides so the breeze runs through, deep overhangs over the glass, and light colours outside. Four simple moves, and they cost far less than running an air conditioner for years." },

      /* — Myth or Fact — */
      { who: 'luma', cam: 'two', mood: 'smile', music: 'hype',
        slide: { kicker: 'Myth or fact', title: 'Three quick ones', lines: ['Karl answers', 'You keep score in the comments'] },
        say: "Myth or Fact! Walls edition. Ready?" },
      { who: 'luma', cam: 'cu', slide: MYTH(1, '“A ring beam is only for storeys”', 'Myth: it ties single-storey walls too'),
        say: "A ring beam is only needed for double-storey houses." },
      { who: 'karl', cam: 'cu',
        say: "Myth. Your engineer decides, and on most houses it ties the walls together and spreads the roof load. Don't skip it to save a few bags of cement." },
      { who: 'luma', cam: 'cu', slide: MYTH(2, '“Thick walls keep a house cooler”', 'Fact: thermal mass evens out the heat'),
        say: "Thick walls keep a house cooler." },
      { who: 'karl', cam: 'cu',
        say: "Fact. Ask any grandmother." },
      { who: 'luma', cam: 'cu', slide: MYTH(3, '“Plaster hides bad brickwork”', 'Myth: it hides it until it cracks'),
        say: "Plaster hides bad brickwork." },
      { who: 'karl', cam: 'cu', mood: 'serious',
        say: "Myth. It hides it for a while. Then it cracks, right along the bad joint." },

      /* — Your Questions — */
      { who: 'luma', cam: 'two', music: 'groove', slide: ASK('Can I make my own bricks?'),
        say: "Your questions. Can I make my own bricks on site?" },
      { who: 'karl', cam: 'cu',
        say: "People do, and it can work. But test them. A few bricks from every batch, checked for strength. A cheap brick that crumbles is the most expensive brick you'll ever buy." },
      { who: 'luma', cam: 'cu', slide: ASK('Round rooms: where does the furniture go?'),
        say: "And a fun one: in a round room, where does the furniture go?" },
      { who: 'karl', cam: 'house', look: 'house', point: true, mood: 'smile', build: 5,
        say: "In the middle, facing each other, the way people have always sat in a round hut, around the fire. Built-in curved shelves on the walls. Round rooms make you gather." },

      /* — The Costly Mistakes — */
      { who: 'luma', cam: 'screen', look: 'screen',
        slide: seg('Costly mistakes at stage 4', ['Weak, untested bricks', 'Mortar stretched with sand', 'No lintels, no ring beam', 'Windows that face the afternoon sun']),
        say: "The costly mistakes at stage four." },
      { who: 'karl', cam: 'cu', mood: 'serious',
        say: "Weak bricks nobody tested. Mortar stretched with sand. Missing lintels and ring beams. And big windows facing the western sun, which turns the lounge into an oven every afternoon." },

      /* — The House Behind Us — */
      { who: 'luma', cam: 'house', look: 'house', build: 7,
        say: "The Triple Rondavel Cluster. Three rooms, one family." },
      { who: 'karl', cam: 'house', look: 'house', point: true, music: 'hype',
        say: "Three round rooms around a shared space, the homestead layout, with walls thick enough to stay cool through a Masvingo October." },
      { who: 'karl', cam: 'roof', look: 'roof', open: 1,
        say: "And roof lights at the top, the concept this series is built around. The actuator family is proven on LB-1. This arrangement still has to be designed and tested." },

      /* — Comment below — */
      { who: 'luma', cam: 'two', mood: 'smile', open: 0,
        slide: POLL('Which brick would you build with?', 'Burnt clay bricks', 'Cement bricks or blocks'),
        say: "Comment below. Burnt clay bricks, type 1, or cement bricks and blocks, type 2? Tell us why." },
      { who: 'karl', cam: 'cu',
        say: "I want to read the arguments on this one. Go." },
      { who: 'luma', cam: 'wide', slide: next(15, 'Roof and light', 'Trusses, storms, lightning and the roof light'),
        say: "Next time, stage five: the roof, storms, lightning, and the roof light this whole show is about. I'm Luma." },
      { who: 'karl', cam: 'wide', mood: 'smile',
        say: "I'm Karl. Test your bricks. See you next episode." }
    ]
  }, {
    /* ================= S2 EPISODE 15 — Roof & Light · Mutare ================= */
    id: 's2e15-roof', no: 15, season: 2, music: 'groove',
    title: 'From Stand to Keys: Roof and Light',
    subtitle: `Season 2 · Episode 15 · Mutare · ${PART}, part 5 of 6`,
    concept: 'conical-tower-loft', city: 'mutare',
    lines: [
      { who: 'luma', cam: 'wide', build: 7, open: 0, mood: 'smile', look: 'camera', music: 'hype',
        slide: { kicker: `Season 2 · ${PART}`, title: 'The roof that opens', lines: ['Stage 5: roof and light', 'Storms, hail and lightning'] },
        say: "A roof that opens to the sky, in a country with summer storms and hail. Crazy, or brilliant? Stay to the end and decide. Welcome to From Stand to Keys." },
      { who: 'karl', cam: 'cu',
        say: "Stage five, the roof and the light. This is our home ground, it's what Lumen Builds does." },
      { who: 'luma', cam: 'screen', look: 'screen', slide: MAP(5),
        say: "Walls are up and the ring beam is on. Now the roof. Behind us, the Conical Tower Loft, in Mutare, where the rain comes in off the highlands." },

      /* — Heritage Corner — */
      { who: 'luma', cam: 'globe', look: 'globe', music: 'calm',
        slide: seg('Heritage Corner', ['Thatch: steep, thick, cool', 'Steep cone: rain runs straight off', 'Smoke and heat rise to the apex']),
        say: "Heritage Corner. The thatched cone. Why steep?" },
      { who: 'karl', cam: 'cu',
        say: "Steep so the rain runs straight off before it can soak in. Thick so it insulates. And the heat and the smoke rise to the top, away from the people." },
      { who: 'luma', cam: 'cu', mood: 'smile',
        say: "So the apex has always been the busiest part of the roof." },
      { who: 'karl', cam: 'two', mood: 'smile',
        say: "It has. We just put glass there. Same idea: let the hot air go up and let the light come down." },

      /* — The Stage — */
      { who: 'luma', cam: 'house', look: 'house', music: 'groove', build: 2,
        slide: seg('The stage: the roof', ['Trusses or steel frame, as designed', 'Treated timber against termites', 'Tied down to the ring beam', 'Covering, flashings and gutters']),
        say: "The stage. How does the roof go on?" },
      { who: 'karl', cam: 'house', look: 'house', build: 3, point: true,
        say: "The frame first, timber trusses or steel, exactly as the engineer designed it. Timber has to be treated against termites and borers. And the whole frame is tied down to the ring beam, because in a storm the wind tries to lift a roof, not push it." },
      { who: 'karl', cam: 'cu',
        say: "Then the covering, sheets, tiles or panels, with flashings wherever the roof meets a wall or an opening, and gutters to carry the water away. Most leaks aren't in the sheets, they're at the flashings." },
      { who: 'luma', cam: 'cu', mood: 'serious',
        slide: seg('Storms and lightning', ['Zimbabwe gets a lot of lightning', 'Ask about lightning protection', 'Hail: laminated glass stays in one piece']),
        say: "Lightning. Zimbabwe has a lot of it." },
      { who: 'karl', cam: 'cu', mood: 'serious',
        say: "We do, and a tall roof like this tower should be assessed for lightning protection by a qualified installer. Don't guess on that one." },
      { who: 'karl', cam: 'house', look: 'house', build: 6,
        slide: HONEST,
        say: "Now the roof light. The glass is 10.38 heat-strengthened laminated, the same as LB-1. If hail cracks it, the layers hold together. The actuators on LB-1 lift 555 newtons each and hold 1,544 newtons against the wind." },
      { who: 'karl', cam: 'roof', look: 'roof', open: 1, music: 'hype',
        say: "And the rain sensor closes it before the first drops. If the power goes, a battery closes it, and there's a manual override. That's how you open a roof in storm country." },

      /* — Myth or Fact — */
      { who: 'luma', cam: 'two', mood: 'smile', music: 'hype',
        slide: { kicker: 'Myth or fact', title: 'Three quick ones', lines: ['Karl answers', 'You keep score in the comments'] },
        say: "Myth or Fact! Roof edition." },
      { who: 'luma', cam: 'cu', slide: MYTH(1, '“A roof light always leaks”', 'Myth: a badly installed one leaks'),
        say: "A roof light always leaks." },
      { who: 'karl', cam: 'cu',
        say: "Myth. A badly installed one leaks. Kerb, seals, flashing and a water test before handover, every time." },
      { who: 'luma', cam: 'cu', slide: MYTH(2, '“Wind lifts roofs more than it pushes them”', 'Fact: tie-downs matter'),
        say: "Wind lifts roofs more than it pushes them over." },
      { who: 'karl', cam: 'cu',
        say: "Fact. That's why the tie-downs matter more than people think." },
      { who: 'luma', cam: 'cu', slide: MYTH(3, '“Daylight makes a room hotter”', 'Half true: shading and ventilation decide'),
        say: "Daylight from above always makes a room hotter." },
      { who: 'karl', cam: 'cu',
        say: "Half true. Glass without shade does. A roof light that opens lets the hot air out at the top. That's the whole point of ours." },

      /* — Your Questions — */
      { who: 'luma', cam: 'two', music: 'groove', slide: ASK('Can I add a roof light to my existing house?'),
        say: "Your questions. Can I add a roof light to the house I already have?" },
      { who: 'karl', cam: 'cu',
        say: "Often, yes, but the roof has to be checked first. Cutting an opening means trimming the structure around it. An engineer looks at your roof before anybody cuts anything. Send us photos of your roof and we'll talk." },
      { who: 'luma', cam: 'cu', slide: ASK('What about cleaning it?'),
        say: "And: how do you clean glass that's on the roof?" },
      { who: 'karl', cam: 'cu', mood: 'smile',
        say: "Rain does most of it. For the rest, safe access is part of the design, never a ladder balanced on the gutter." },

      /* — The Costly Mistakes — */
      { who: 'luma', cam: 'screen', look: 'screen',
        slide: seg('Costly mistakes at stage 5', ['Untreated timber', 'No tie-downs to the ring beam', 'Poor flashings', 'No plan for lightning, hail or power cuts']),
        say: "The costly mistakes at stage five." },
      { who: 'karl', cam: 'cu', mood: 'serious',
        say: "Untreated timber. No tie-downs. Cheap flashings. And no plan for lightning, hail or power cuts. The roof is the one part of the house that fights the weather every single day." },

      /* — The House Behind Us — */
      { who: 'luma', cam: 'house', look: 'house', build: 7,
        say: "The Conical Tower Loft. Let's close it in." },
      { who: 'karl', cam: 'house', look: 'house', point: true,
        say: "A tall cone that carries a loft inside, the rondavel stretched upward, so the hot air has further to rise." },
      { who: 'karl', cam: 'roof', look: 'roof', open: 1, music: 'hype',
        say: "And at the top, the light opens. Crazy or brilliant? You decide in the comments." },

      /* — Comment below — */
      { who: 'luma', cam: 'two', mood: 'smile', open: 0,
        slide: POLL('A roof that opens to the sky:', 'Brilliant, I want one', 'Crazy, keep my roof closed'),
        say: "Comment below. A roof that opens to the sky. Type 1, brilliant, I want one. Type 2, crazy, keep my roof closed." },
      { who: 'karl', cam: 'cu', mood: 'smile',
        say: "You know my vote. But tell us honestly, and tell us why." },
      { who: 'luma', cam: 'wide', slide: next(16, 'Power, water and the keys', 'Solar, boreholes, the final inspection and handover'),
        say: "Next time, the final stage: power, water, and the day you get the keys. I'm Luma." },
      { who: 'karl', cam: 'wide', mood: 'smile',
        say: "I'm Karl. Tie your roof down. See you next episode." }
    ]
  }, {
    /* ================= S2 EPISODE 16 — Power, Water & the Keys · Victoria Falls ================= */
    id: 's2e16-keys', no: 16, season: 2, music: 'groove',
    title: 'From Stand to Keys: Power, Water and the Keys',
    subtitle: `Season 2 · Episode 16 · Victoria Falls · ${PART}, part 6 of 6`,
    concept: 'zambezi-curve-pavilion', city: 'vicfalls',
    lines: [
      { who: 'luma', cam: 'wide', build: 7, open: 0, mood: 'smile', look: 'camera', music: 'hype',
        slide: { kicker: `Season 2 · ${PART}`, title: 'Keys day', lines: ['Stage 6: power, water and handover', 'The finale'] },
        say: "Tonight somebody gets the keys. The finale of From Stand to Keys. Stay to the end, because we'll give you the whole journey on one screen." },
      { who: 'karl', cam: 'cu', mood: 'smile',
        say: "Stage six. Power, water, the final checks and the handover. The house becomes a home." },
      { who: 'luma', cam: 'screen', look: 'screen', slide: MAP(6),
        say: "Stand, plans, foundations, walls, roof. Now we make it work. Behind us, the Zambezi Curve Pavilion, near the Falls, with solar leaves on its crest." },

      /* — Heritage Corner — */
      { who: 'luma', cam: 'globe', look: 'globe', music: 'calm',
        slide: seg('Heritage Corner', ['Water carried, stored and shared', 'The granary raised off the ground', 'Nothing wasted']),
        say: "Heritage Corner. Before boreholes and solar, how did a homestead manage water and stores?" },
      { who: 'karl', cam: 'cu',
        say: "Carefully. Water carried and stored in clay pots that kept it cool. The granary raised off the ground, away from damp and pests. Nothing wasted. A homestead was designed around what it had to store." },
      { who: 'luma', cam: 'cu', mood: 'smile',
        say: "And today we store electricity." },
      { who: 'karl', cam: 'two', mood: 'smile',
        say: "Same thinking. The battery is the new granary. Fill it when the sun is out, and live from it when the power goes." },

      /* — The Stage — */
      { who: 'luma', cam: 'house', look: 'house', music: 'groove', build: 4,
        slide: seg('The stage: power and water', ['Solar panels, inverter and batteries', 'Borehole or council water, and a tank', 'Septic system or sewer connection', 'Qualified, certified installers']),
        say: "The stage. Power first." },
      { who: 'karl', cam: 'house', look: 'house', build: 5, point: true,
        say: "Solar panels, an inverter and batteries, sized to what you actually run. List your appliances, and be honest about the kettle and the iron. Use a qualified installer, and keep the certificates." },
      { who: 'karl', cam: 'cu',
        say: "Water: council water if you have it, a borehole if you don't, and a tank either way, because supply isn't always steady. And the waste water: a sewer connection, or a septic system designed for your soil and placed away from the borehole." },
      { who: 'luma', cam: 'react', mood: 'serious',
        say: "Away from the borehole. That one matters." },
      { who: 'karl', cam: 'cu', mood: 'serious',
        say: "It matters for your family's health. Your council and your installer will tell you the distances. Follow them." },
      { who: 'luma', cam: 'house', look: 'house', build: 6,
        slide: seg('Before the keys', ['Final inspection by the council', 'Snag list: walk every room', 'Water-test the roof and roof light', 'Drawings, certificates and manuals']),
        say: "And then the final checks." },
      { who: 'karl', cam: 'cu',
        say: "The council's final inspection, so the house is legally complete. Then the snag list. Walk every room with the builder, open every window, run every tap, and write down everything that isn't right." },
      { who: 'karl', cam: 'roof', look: 'roof', build: 7, open: 1, music: 'hype',
        say: "At Lumen Builds, the roof light gets its water test before handover. The leaves open, the rain sensor is tested, the manual override is shown to the owner. Then, and only then, the keys." },

      /* — Myth or Fact — */
      { who: 'luma', cam: 'two', mood: 'smile', music: 'hype',
        slide: { kicker: 'Myth or fact', title: 'The last three', lines: ['Karl answers', 'You keep score in the comments'] },
        say: "The last Myth or Fact of the series! Make them count, Karl." },
      { who: 'luma', cam: 'cu', slide: MYTH(1, '“Solar means you never need the grid”', 'Depends on your system and your habits'),
        say: "Solar means you'll never need the grid again." },
      { who: 'karl', cam: 'cu',
        say: "It depends. On the size of the system and on your habits. Many homes run mostly on solar and keep the grid as a backup." },
      { who: 'luma', cam: 'cu', slide: MYTH(2, '“The snag list is where builders get paid”', 'Myth: it is where you protect your money'),
        say: "The snag list is just a formality." },
      { who: 'karl', cam: 'cu', mood: 'serious',
        say: "Myth. It's the last moment you have to get things fixed before you've signed off. Take your time." },
      { who: 'luma', cam: 'cu', slide: MYTH(3, '“Keep every drawing and certificate”', 'Fact: you will need them to sell, insure or extend'),
        say: "Keep every drawing and certificate." },
      { who: 'karl', cam: 'cu',
        say: "Fact. You'll need them to sell, insure or extend. Put them in a file, and keep a copy in the cloud." },

      /* — Your Questions — */
      { who: 'luma', cam: 'two', music: 'groove', slide: ASK('What happens to the roof light in a power cut?'),
        say: "Your questions. What happens to the roof light in a power cut?" },
      { who: 'karl', cam: 'roof', look: 'roof',
        say: "It runs on its own battery, so it can still close for rain. And if everything fails, there's a manual override. You're never stuck with an open roof in a storm." },
      { who: 'luma', cam: 'cu', slide: ASK('Where do I start if I want to build with you?'),
        say: "And the big one: I've watched all six episodes. Where do I start with Lumen Builds?" },
      { who: 'karl', cam: 'cu', mood: 'smile',
        say: "Send us a message on Instagram, @karlcon_lumen_builds_zw. Tell us where your stand is, what stage you're at, and which of these ten designs you love. We'll take it from there, honestly." },

      /* — The whole journey — */
      { who: 'luma', cam: 'screen', look: 'screen', music: 'calm',
        slide: seg('From stand to keys: the checklist', ['1 The stand: paperwork, pegs, rains, sun', '2 Plans: brief, drawings, engineer, approval', '3 Foundations: soil test, termites, DPC', '4 Walls: tested bricks, lintels, ring beam', '5 Roof: tie-downs, flashings, storms', '6 Keys: solar, water, inspection, snag list']),
        say: "As promised, the whole journey on one screen. Screenshot this, everyone." },
      { who: 'karl', cam: 'cu',
        say: "Stand, plans, foundations, walls, roof, keys. Do each one properly, in order, and you only build your house once." },

      /* — The House Behind Us — */
      { who: 'luma', cam: 'house', look: 'house',
        say: "And the last house of the season, the Zambezi Curve Pavilion." },
      { who: 'karl', cam: 'house', look: 'house', point: true, music: 'hype',
        say: "A white shell curving two ways over red arch ribs, open at the sides for the breeze off the river, with solar glass leaves at the crest. Power and light from the same roof. A concept, and one we'd love to build near the Falls." },

      /* — Comment below — */
      { who: 'luma', cam: 'two', mood: 'smile', open: 0,
        slide: POLL('Which stage scares you most?', 'The paperwork and approvals', 'The build itself'),
        say: "The last comment question of the series. Which stage scares you most? Type 1, the paperwork and approvals. Type 2, the build itself. We'll answer the most common worries in a future show." },
      { who: 'karl', cam: 'cu', mood: 'smile',
        say: "And tell us which house you want to see built first. Ten designs, one of them goes first. You choose." },
      { who: 'luma', cam: 'wide', open: 1, mood: 'smile',
        slide: { kicker: 'Season 2', title: 'From Stand to Keys', lines: ['Six stages, one house', 'Ten Heritage Series designs', 'Follow @karlcon_lumen_builds_zw'] },
        say: "That's From Stand to Keys, and that's season two. Thank you for building with us. I'm Luma." },
      { who: 'karl', cam: 'wide', mood: 'smile',
        say: "I'm Karl. Build it once, build it right. See you next season." }
    ]
  });
})();
