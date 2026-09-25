/* KARLCON Studio — hosts and episode scripts.
   House rule from concepts-data.js: engineering numbers only appear where they come from the
   LB-1 engineering file. Everything else is described, not quantified, until it is designed.

   HOSTS — `model` is any TalkingHead-compatible GLB (Avaturn T2, AvatarSDK MetaPerson, MPFB).
   The two realistic sample avatars below come from the open-source TalkingHead project and are
   licensed for NON-COMMERCIAL use only. They are stand-ins for rehearsal. Before a public or
   sponsored broadcast, swap in avatars you own (e.g. make your own from photos at avaturn.me and
   follow its commercial terms) or use /models/hosts/mpfb.glb, which is CC0.

   LINE CUES (all optional)
     cam:     'wide' | 'two' | 'cu' (speaker close-up) | 'house' | 'roof' | 'globe' | 'screen' | 'desk'
     look:    where BOTH hosts look — 'house' | 'globe' | 'screen' | 'camera'
     point:   true → the speaker gestures at the building
     build:   0–7 → animate the building to that construction stage
              0 footings · 1 columns · 2 floor · 3 walls+roof · 4 glazing · 5 interior · 6 roof light · 7 complete
     open:    0–1 → roof light leaves (1 = fully open, with the daylight shaft)
     slide:   { kicker, title, lines[] } → the story screen and the on-air topic bar
     ticker:  [strings] → the scrolling materials ticker
     mood:    'smile' | 'serious'
*/
window.KC_HOSTS = {
  luma: {
    name: 'Luma', role: 'Host · KARLCON Systems Intelligence', seat: 0,
    model: '/models/hosts/avaturn.glb', fallback: '/models/hosts/mpfb.glb',
    voice: { gender: 'female', prefer: ['Ava', 'Aria', 'Jenny', 'Sonia', 'Libby', 'Samantha', 'Google UK English Female', 'Zira', 'Female'] },
    pitch: 1.04, rate: 1.0, mouthGain: 0.7
  },
  karl: {
    name: 'Karl', role: 'Engineer · KARLCON Lumen Builds', seat: 1,
    model: '/models/hosts/avatarsdk.glb', fallback: '/models/hosts/mpfb.glb',
    voice: { gender: 'male', prefer: ['Andrew', 'Guy', 'Ryan', 'Thomas', 'Daniel', 'Google UK English Male', 'David', 'Male'] },
    pitch: 0.96, rate: 0.98, mouthGain: 0.9
  }
};

const MATERIALS_CUBE = [
  'Concrete pad footings, reinforced', 'Hold-down bolts + non-shrink grout', 'Steel columns — galvanised, signal-red finish',
  'Steel floor and roof beams', 'Insulated walls, white render', 'Full-height glazing in dark aluminium frames',
  'Roof light: 10.38 heat-strengthened laminated glass', 'Aluminium kerb + EPDM seals', '2 actuators · 555 N lift · 1,544 N wind hold each',
  'Rain sensor + controller', 'Battery backup + manual override', 'Waterproof membrane + flashings'
];

window.KC_EPISODES = [{
  id: 'ep1-glass-cube',
  title: 'The Elevated Glass Cube',
  subtitle: 'Episode 1 · Harare · How a lifted box earns its roof light',
  concept: 'cantilever-pavilion',
  city: 'harare',
  lines: [
    { who: 'luma', cam: 'wide', build: 7, open: 0, mood: 'smile',
      slide: { kicker: 'Episode 1 · Harare', title: 'The Elevated Glass Cube', lines: ['A glazed living box lifted on four red columns', 'A bi-parting roof light right over the lounge'] },
      say: "Good evening, and welcome to KARLCON Systems Intelligence. I'm Luma, and tonight we're in Harare, looking at a house that floats." },
    { who: 'karl', cam: 'cu', mood: 'smile',
      say: "Evening everyone. Karl here, from Lumen Builds. And yes, it floats. Well, almost. It's a glass box standing on four red steel columns." },
    { who: 'luma', cam: 'two',
      say: "So Karl, the question everybody asks in the comments. Why lift the house at all?" },
    { who: 'karl', cam: 'house', look: 'house', point: true,
      say: "Three reasons. You get a view over the wall and the jacaranda trees. You get shade and a dry parking space underneath. And the living room sits above the dust and the storm water in the rainy season." },
    { who: 'luma', cam: 'cu',
      say: "Okay, but a glass box in the Zimbabwean sun. Isn't that a greenhouse?" },
    { who: 'karl', cam: 'cu', mood: 'serious',
      say: "It would be, if you did it lazily. The glass has to be chosen for heat, not just for looks. That's why our planner shows how much heat each glass lets in before we size anything." },
    { who: 'luma', cam: 'roof', look: 'house', open: 0,
      slide: { kicker: 'Roof light', title: 'Bi-parting hinged roof light', lines: ['Two glass leaves lift apart from the centre', 'Paired actuators, one per leaf', 'Benchmark aperture 1.5 × 2.0 m'] },
      say: "And the star of the show is up on the roof. Karl, show them." },
    { who: 'karl', cam: 'roof', look: 'house', open: 1,
      say: "Watch the roof. Two glass leaves lift apart from the centre, on paired actuators, and the lounge opens straight to the sky." },
    { who: 'luma', cam: 'cu', mood: 'smile',
      say: "That's the Iron Man moment right there. What's actually lifting that glass?" },
    { who: 'karl', cam: 'cu',
      slide: { kicker: 'From the LB-1 engineering file', title: 'The numbers behind the reveal', lines: ['Benchmark aperture: 1.5 × 2.0 m', 'Lift force: 555 newtons per actuator', 'Wind hold: 1,544 newtons per actuator', 'Glass: 10.38 heat-strengthened laminated'] },
      say: "On our benchmark opening of one and a half by two metres, each actuator lifts with 555 newtons. But the bigger number is the hold. In a storm, each one holds 1,544 newtons so the wind can't rip the leaf open." },
    { who: 'luma', cam: 'two',
      say: "And the glass itself?" },
    { who: 'karl', cam: 'cu',
      say: "Ten point three eight heat-strengthened laminated. If it ever cracks, the layer in the middle holds it together. Nobody wants glass falling on the sofa." },
    { who: 'luma', cam: 'globe', look: 'globe',
      slide: { kicker: 'Grounded in Zimbabwe', title: 'Designing for our climate', lines: ['Summer storms: rain sensor closes the roof', 'Strong sun: glass chosen for heat', 'Power cuts: battery backup + manual override', 'Termites + clay soils: steel, concrete, a soil check'] },
      say: "Let's ground this in Zimbabwe. Afternoon thunderstorms, load-shedding, termites. What changes?" },
    { who: 'karl', cam: 'cu', mood: 'serious',
      say: "Everything. A rain sensor closes the roof before the first drops reach the couch. The controller runs on battery backup, with a manual override, so a power cut never leaves your roof open. And at ground level it's steel and concrete, not timber, because termites don't eat either." },
    { who: 'luma', cam: 'two',
      say: "And the ground itself? Some parts of Harare have that heavy clay." },
    { who: 'karl', cam: 'cu',
      say: "Exactly. Before we pour anything, we test the soil. On clay that swells in the rains, the engineer sets how deep the footings go. We don't guess that." },
    { who: 'luma', cam: 'house', look: 'house', build: 0,
      slide: { kicker: 'Build sequence', title: 'How it goes up, step by step', lines: ['Survey and soil test', 'Pad footings with hold-down bolts', 'Columns erected and grouted', 'Floor deck, walls and roof frame'] },
      say: "Right, let's build it. Karl, take us from bare ground." },
    { who: 'karl', cam: 'house', look: 'house', build: 1, point: true,
      say: "Step one, survey and soil test. Step two, four concrete pad footings with hold-down bolts cast in. Step three, the red steel columns go up and get grouted to the bolts." },
    { who: 'karl', cam: 'house', look: 'house', build: 3,
      say: "Then the floor deck is lifted into place, and the walls and roof frame go on top. Now it's a box in the air." },
    { who: 'karl', cam: 'house', look: 'house', build: 5,
      slide: { kicker: 'Build sequence', title: 'Closing it in', lines: ['Full-height glazing in aluminium frames', 'Interior fit-out', 'Roof light kerb, leaves and actuators', 'Water test before handover'] },
      say: "Full-height glazing goes into dark aluminium frames. Aluminium is our home ground, we fabricate it ourselves." },
    { who: 'karl', cam: 'roof', look: 'house', build: 7, open: 0,
      say: "Last, the roof light. Kerb, seals, leaves, actuators, and then we water-test it on the rig before it goes anywhere near a client." },
    { who: 'luma', cam: 'screen', look: 'screen',
      slide: { kicker: 'Materials list', title: 'What goes into the Glass Cube', lines: ['Concrete footings, bolts, grout', 'Galvanised steel columns and beams', 'Insulated walls, white render', 'Aluminium-framed glazing', 'Laminated roof light, seals, actuators', 'Rain sensor, battery backup'] },
      ticker: MATERIALS_CUBE,
      say: "For everyone taking notes, here's the full materials list on screen now." },
    { who: 'luma', cam: 'two',
      say: "Last question. How does a concept like this become a 3D model you can walk around?" },
    { who: 'karl', cam: 'cu',
      say: "We start with the render. The building is cut out and turned into a 3D model, then we add the real mechanism with the real numbers. Wind uplift, glass stress and deflection get checked, and it stays labelled concept until it's built and water-tested." },
    { who: 'luma', cam: 'wide', open: 1, mood: 'smile',
      slide: { kicker: 'Next episode', title: 'Where should the Atlas fly next?', lines: ['Bulawayo · Mutare · Masvingo · Victoria Falls', 'Drop your city in the comments', 'Follow @karlcon_lumen_builds_zw'] },
      say: "That's the Glass Cube. Next episode we fly the Atlas to another city and find a house that deserves a roof light. Drop your city in the comments. I'm Luma." },
    { who: 'karl', cam: 'wide', mood: 'smile',
      say: "And I'm Karl. Thanks for watching. Go and follow the build." }
  ]
}];
