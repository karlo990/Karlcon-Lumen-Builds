/* KARLCON Studio — motion test sequence (not part of any season).
   Load with /studio?season=3&test=motion (add &trace to record every host's pose each frame into
   window.kcTrace). It walks both hosts through the moves that matter for realism, in order:
     1 Karl walks to the roof light · 2 stops and reaches for the vent · 3 turns away and walks back
     4 Luma walks to the tint wall · 5 turns to the samples · 6 tint wall → story screen
     7 both standing and presenting · 8 camera-facing and profile close-ups
   Used by tools/motion-check to measure foot sliding, pops at transitions and turn timing. */
window.KC_TEST_MOTION = {
  id: 'test-motion', no: 0, season: 3, room: 'concept', music: 'calm',
  title: 'Motion test', subtitle: 'Motion test · The Concept Room',
  concept: 'ridge-skylight', city: 'harare',
  lines: [
    { who: 'karl', cam: 'wide', build: 7, open: 0, go: 'model',
      say: 'One. I walk over to the roof light, slowing down as I get there, and I look at the vent before I stop walking.' },
    { who: 'karl', cam: 'house', look: 'house', touch: true, go: 'model',
      say: 'Two. Now I shift my weight, reach up for the vent, pull it down, and let my arms come back to rest after that.' },
    { who: 'karl', cam: 'wide', go: 'home',
      say: 'Three. I turn away from the roof light, my head first, then my shoulders and hips, and I walk back to my mark.' },
    { who: 'luma', cam: 'wide', go: 'tints',
      say: 'Four. I walk round the platform to the tint wall, slowing down as I reach it, and then I settle.' },
    { who: 'luma', cam: 'tints', look: 'tints',
      say: 'Five. I turn to the samples, look at them, and now and then glance back at you while I present them.' },
    { who: 'luma', cam: 'wide', go: 'screen',
      say: 'Six. From the tint wall I walk over to the story screen and turn to present it to you.' },
    { who: 'luma', cam: 'two', go: 'home',
      say: 'Seven. Back on my mark. We both stand and present, with small natural movements, never frozen.' },
    { who: 'karl', cam: 'two',
      say: 'Seven, continued. Breathing, a small weight shift, the hands settling, the eyes moving between you and her.' },
    { who: 'karl', cam: 'cu',
      say: 'Eight. A close-up, facing the camera.' },
    { who: 'luma', cam: 'profiles', look: 'profiles',
      say: 'Eight, continued. And a profile, looking across the room at the board.' }
  ]
};
