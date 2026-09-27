/* KARLCON Studio — choosing the next song.
   Shared by the live studio (studio.html `sound`) and the offline render mix (rendermix.js), so a
   recording plays the music the way the stream does.
   Each song in models/audio/playlist.json can say how much energy it has (1 calm … 3 hype), where the
   music really starts and ends (`in` / `out`, seconds: skips a video intro or a long fade), and how deep
   to dip it under a voice (`duck`, dB).
   The picker plays every song once per round, never the same song twice in a row, and changes energy
   from one song to the next (calm → groove → hype → groove …) rather than stacking two hype tracks.
   The show can ask for a mood (`calm`, `groove`, `hype`): a heritage story leans calm, a build reveal
   leans hype. The mood nudges the choice; it never breaks the round. */

export const MOODS = { calm: 1, groove: 2, hype: 3 };

/** the part of a song that plays, in seconds of the file */
export const span = (track, duration) => {
  const a = Math.max(0, +track.in || 0), b = Math.min(duration, +track.out || duration);
  return b - a > 20 ? [a, b] : [0, duration];
};

export function createPicker(tracks, rand = Math.random) {
  let round = [], last = null;
  const energy = (t) => Math.max(1, Math.min(3, +t.energy || 2));
  return {
    /** the next song; `mood` is 'calm' | 'groove' | 'hype' or empty */
    next(mood) {
      if (!tracks.length) return null;
      if (!round.length) round = [...tracks];
      const want = MOODS[mood] || 0;
      let best = null, bestScore = Infinity;
      for (const t of round) {
        let s = rand() * 0.6;                                          // a little chance, so each show sounds different
        if (t === last && round.length > 1) s += 100;                  // never the same song twice in a row
        if (last) {
          const d = Math.abs(energy(t) - energy(last));
          s += d === 0 ? 1.2 : d === 2 ? 0.8 : 0;                      // step the energy, don't repeat it or jump calm↔hype
          if (energy(t) === 3 && energy(last) === 3) s += 2;           // never two hype tracks back to back
        }
        if (want) s += Math.abs(energy(t) - want) * 0.9;               // lean towards what the show is doing
        if (s < bestScore) { bestScore = s; best = t; }
      }
      round.splice(round.indexOf(best), 1);
      return (last = best);
    }
  };
}
