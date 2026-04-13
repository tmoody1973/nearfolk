// Nearfolk Day Director
//
// Runs once when the player presses Settle. Picks ONE primary beat
// (and optionally one secondary) based on neighborhood state.
// Injects behavior overrides into resident routines.
//
// Architecture (from spec §8):
//   1. Filter beats by canFire() hard gate
//   2. Score each by evaluateFit() (0-100)
//   3. Pick highest-scoring beat
//   4. Return beat + caption from templates
//
// Pure function. No side effects. No Three.js.

// ─── Story caption templates ───
const WARM_THINGS = ['coffee', 'a pie', 'the newspaper', 'a folding chair', 'flowers from the garden', 'soup', 'fresh bread', 'lemonade'];
const GARDEN_THINGS = ['tomatoes', 'herbs', 'sunflowers', 'the same row of beans', 'marigolds'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pronoun() {
  return Math.random() > 0.5 ? 'She' : 'He';
}

// ─── Beat definitions ───
const BEATS = [
  {
    id: 'CHECK_IN',
    name: 'The Check-In',
    canFire(state) {
      return (
        state.cottages.length >= 3 &&
        state.residents.some(r => r.encounterCount === 0) &&
        state.residents.some(r =>
          ['HOST', 'STORYTELLER', 'GARDENER'].includes(r.traitKey)
        )
      );
    },
    evaluateFit(state) {
      const lonely = state.residents.filter(r => r.encounterCount === 0);
      const hasHelper = state.residents.some(r =>
        ['HOST', 'STORYTELLER'].includes(r.traitKey)
      );
      const novelty = Math.min(25, (state.daysSinceBeat?.CHECK_IN ?? 99) * 5);
      const resonance = lonely.length > 0 ? (lonely.some(r => r.traitKey === 'NEW_IN_TOWN') ? 40 : 30) : 0;
      const castFit = hasHelper ? 25 : 12;
      return novelty + resonance + castFit;
    },
    generateCaption(state) {
      const lonely = state.residents.find(r => r.encounterCount === 0);
      const helper = state.residents.find(r =>
        ['HOST', 'STORYTELLER', 'GARDENER'].includes(r.traitKey)
      );
      if (!lonely || !helper) return 'Someone checked in on a neighbor today.';
      return pick([
        `${helper.name} noticed ${lonely.name} hadn't been out all week. ${pronoun()} brought ${pick(WARM_THINGS)}.`,
        `${helper.name} saw ${lonely.name}'s porch light stay dim. ${pronoun()} walked over with ${pick(WARM_THINGS)}.`,
        `It had been a quiet week for ${lonely.name}. ${helper.name} knew when to knock.`,
        `${helper.name} left ${pick(WARM_THINGS)} on ${lonely.name}'s porch. No note needed.`,
      ]);
    },
  },
  {
    id: 'ACCIDENTAL_MEETING',
    name: 'The Accidental Meeting',
    canFire(state) {
      return state.cottages.length >= 2;
    },
    evaluateFit(state) {
      const novelty = Math.min(25, (state.daysSinceBeat?.ACCIDENTAL_MEETING ?? 99) * 5);
      const resonance = state.cottages.length >= 4 ? 30 : 15;
      return novelty + resonance + 10;
    },
    generateCaption(state) {
      const a = state.residents[0];
      const b = state.residents.length > 1 ? state.residents[1] : a;
      return pick([
        `A stray cat led ${a.name} and ${b.name} to the same corner of the commons. They stayed and talked.`,
        `${a.name} and ${b.name} reached for the same bench at the same time. They laughed about it.`,
        `${a.name} was heading home when ${b.name} called out. They hadn't met before today.`,
      ]);
    },
  },
  {
    id: 'POTLUCK',
    name: 'The Potluck',
    canFire(state) {
      return state.cottages.length >= 4 && state.pathCount >= 4;
    },
    evaluateFit(state) {
      const novelty = Math.min(25, (state.daysSinceBeat?.POTLUCK ?? 99) * 5);
      const resonance = Math.min(40, state.pathCount * 3);
      return novelty + resonance + 10;
    },
    generateCaption(state) {
      return pick([
        'Somebody brought a folding table. By sunset, everyone was there.',
        'It started with one dish. By dusk, the commons smelled like home.',
        `${pick(state.residents.map(r => r.name))} set up the table. The rest just showed up.`,
      ]);
    },
  },
  {
    id: 'MORNING_WAVE',
    name: 'Morning Wave',
    canFire(state) {
      return state.residents.some(r => r.traitKey === 'EARLY_BIRD') && state.mailboxCount >= 1;
    },
    evaluateFit(state) {
      const novelty = Math.min(25, (state.daysSinceBeat?.MORNING_WAVE ?? 99) * 5);
      return novelty + 25 + 10;
    },
    generateCaption(state) {
      const bird = state.residents.find(r => r.traitKey === 'EARLY_BIRD');
      const other = state.residents.find(r => r.id !== bird?.id);
      const name = bird?.name || 'Someone';
      return pick([
        `${name} was at the mailbox before sunrise. ${other?.name || 'A neighbor'} waved from the porch.`,
        `Morning light on the commons. ${name} and ${other?.name || 'a neighbor'} crossed paths at the mailbox.`,
      ]);
    },
  },
  {
    id: 'GARDEN_CLUB',
    name: 'Garden Club',
    canFire(state) {
      return state.gardenCount >= 1 && state.residents.some(r =>
        ['GARDENER', 'GREEN_THUMB'].includes(r.traitKey)
      );
    },
    evaluateFit(state) {
      const novelty = Math.min(25, (state.daysSinceBeat?.GARDEN_CLUB ?? 99) * 5);
      const gardeners = state.residents.filter(r =>
        ['GARDENER', 'GREEN_THUMB'].includes(r.traitKey)
      ).length;
      return novelty + Math.min(40, gardeners * 20) + 10;
    },
    generateCaption(state) {
      const gardener = state.residents.find(r => r.traitKey === 'GARDENER');
      const name = gardener?.name || 'Someone';
      return pick([
        `${name} and a neighbor spent the afternoon in the garden. They argued about ${pick(GARDEN_THINGS)}.`,
        `The shared garden had two people in it today. Neither planned it.`,
        `${name} was weeding when a neighbor showed up with a trowel. They didn't say much. They didn't need to.`,
      ]);
    },
  },
  {
    id: 'STORYTELLERS_PORCH',
    name: "The Storyteller's Porch",
    canFire(state) {
      return state.residents.some(r => r.traitKey === 'STORYTELLER') && state.cottages.length >= 3;
    },
    evaluateFit(state) {
      const novelty = Math.min(25, (state.daysSinceBeat?.STORYTELLERS_PORCH ?? 99) * 5);
      return novelty + 35 + 15;
    },
    generateCaption(state) {
      const teller = state.residents.find(r => r.traitKey === 'STORYTELLER');
      const name = teller?.name || 'The storyteller';
      return pick([
        `At sunset, ${name}'s porch had three chairs and two listeners. The story went long.`,
        `${name} started talking. Two neighbors sat down. Nobody checked the time.`,
      ]);
    },
  },
  {
    id: 'LONG_WALK',
    name: 'The Long Walk',
    canFire(state) {
      return state.residents.some(r => r.traitKey === 'WANDERER') && state.pathCount >= 6;
    },
    evaluateFit(state) {
      const novelty = Math.min(25, (state.daysSinceBeat?.LONG_WALK ?? 99) * 5);
      return novelty + Math.min(40, state.pathCount * 3) + 10;
    },
    generateCaption(state) {
      const wanderer = state.residents.find(r => r.traitKey === 'WANDERER');
      const name = wanderer?.name || 'Someone';
      return pick([
        `${name} walked the whole loop today. Three people said hello. One joined for a stretch.`,
        `${name} took the long way home. The benches were full. The paths were warm.`,
      ]);
    },
  },
  {
    id: 'NEW_NEIGHBOR',
    name: 'New Neighbor',
    canFire(state) {
      return state.residents.some(r => r.traitKey === 'NEW_IN_TOWN');
    },
    evaluateFit(state) {
      const novelty = Math.min(25, (state.daysSinceBeat?.NEW_NEIGHBOR ?? 99) * 5);
      return novelty + 35 + 15;
    },
    generateCaption(state) {
      const newbie = state.residents.find(r => r.traitKey === 'NEW_IN_TOWN');
      const name = newbie?.name || 'The new arrival';
      return pick([
        `${name} moved in today. Three porches waved. One brought ${pick(WARM_THINGS)}.`,
        `${name} stood on the porch, unsure where anything was. A neighbor pointed to the garden.`,
        `The newest door on the commons opened. ${name} looked out. Someone waved first.`,
      ]);
    },
  },
  {
    id: 'INTROVERTS_CORNER',
    name: "The Introvert's Corner",
    canFire(state) {
      return state.residents.some(r => r.traitKey === 'INTROVERT');
    },
    evaluateFit(state) {
      const novelty = Math.min(25, (state.daysSinceBeat?.INTROVERTS_CORNER ?? 99) * 5);
      return novelty + 30 + 10;
    },
    generateCaption(state) {
      const intro = state.residents.find(r => r.traitKey === 'INTROVERT');
      const name = intro?.name || 'Someone';
      return pick([
        `${name} read on the porch all afternoon. One neighbor passed. They nodded. That was enough.`,
        `${name}'s cottage faced the quietest corner. That was the point.`,
      ]);
    },
  },
  {
    id: 'DUSK_FIRE',
    name: 'Dusk Fire',
    canFire(state) {
      return state.firepitCount >= 1 && state.cottages.length >= 3;
    },
    evaluateFit(state) {
      const novelty = Math.min(25, (state.daysSinceBeat?.DUSK_FIRE ?? 99) * 5);
      const owls = state.residents.filter(r => r.traitKey === 'NIGHT_OWL').length;
      return novelty + 25 + owls * 10;
    },
    generateCaption(state) {
      return pick([
        'The fire pit crackled. One by one, the porches emptied and the circle filled.',
        'Someone lit the fire pit. Nobody remembers who. Everyone remembers the conversation.',
        'Dusk. The fire pit. Four chairs. No agenda.',
      ]);
    },
  },
  {
    id: 'QUIET_DAY',
    name: 'The Quiet Day',
    canFire() { return true; }, // Always eligible (NULL_BEAT)
    evaluateFit(state) {
      // Low score so it only wins when nothing else fits well
      const novelty = Math.min(15, (state.daysSinceBeat?.QUIET_DAY ?? 99) * 3);
      return novelty + 5;
    },
    generateCaption() {
      return pick([
        'Nothing happened today. It was perfect.',
        'A quiet day. The kind you forget about and then miss.',
        'No drama. No events. Just a neighborhood being a neighborhood.',
        'The commons was empty most of the day. That was fine.',
      ]);
    },
  },
  {
    id: 'UNEXPECTED_KINDNESS',
    name: 'The Unexpected Kindness',
    canFire(state) {
      return state.cottages.length >= 4 && state.residents.some(r => r.traitKey === 'NEW_IN_TOWN');
    },
    evaluateFit(state) {
      const novelty = Math.min(25, (state.daysSinceBeat?.UNEXPECTED_KINDNESS ?? 99) * 8);
      return novelty + 40 + 15; // High value, rare
    },
    generateCaption(state) {
      const newbie = state.residents.find(r => r.traitKey === 'NEW_IN_TOWN');
      const helper = state.residents.find(r => r.id !== newbie?.id);
      const name = newbie?.name || 'Someone';
      const helperName = helper?.name || 'A neighbor';
      return pick([
        `${helperName} left something on ${name}'s porch. No note. No reason. Just because.`,
        `${name} came home to ${pick(WARM_THINGS)} on the step. Nobody took credit.`,
        `Two people who'd never spoken met at the garden gate. By evening, they were friends.`,
      ]);
    },
  },
];

// ─── Director entry point ───
// Pure function. Takes neighborhood state + memory, returns beat + caption + choreography.
import {
  daysSinceBeat as memDaysSince,
  getLowestContentment, getContentment,
  lastBeatSubject, getFriendPairs,
} from './memory.js';

export function runDirector(pieces, residents, memory = null) {
  const cottages = pieces.filter(p => p.type === 'COTTAGE');

  // Build daysSinceBeat lookup from memory
  const daysSinceBeatMap = {};
  if (memory) {
    for (const beat of BEATS) {
      daysSinceBeatMap[beat.id] = memDaysSince(memory, beat.id);
    }
  }

  // Find lowest-contentment resident for arc-aware beats
  const lowestContentment = memory
    ? getLowestContentment(memory, residents.map(r => r.id))
    : { id: null, contentment: 50 };

  // Arc detection: last Check-In subject becomes eligible helper
  const lastCheckInSubject = memory ? lastBeatSubject(memory, 'CHECK_IN') : null;

  // Friend pairs for relationship beats
  const friendPairs = memory ? getFriendPairs(memory) : [];

  const state = {
    cottages,
    residents,
    pathCount: pieces.filter(p => p.type === 'PATH').length,
    gardenCount: pieces.filter(p => p.type === 'GARDEN').length,
    firepitCount: pieces.filter(p => p.type === 'FIREPIT').length,
    mailboxCount: pieces.filter(p => p.type === 'MAILBOX').length,
    benchCount: pieces.filter(p => p.type === 'BENCH').length,
    treeCount: pieces.filter(p => p.type === 'TREE').length,
    daysSinceBeat: daysSinceBeatMap,
    lowestContentment,
    lastCheckInSubject,
    friendPairs,
    memory,
  };

  // Filter by hard gate
  const candidates = BEATS.filter(b => b.canFire(state));
  if (candidates.length === 0) {
    const quiet = BEATS.find(b => b.id === 'QUIET_DAY');
    return {
      beat: quiet,
      caption: quiet.generateCaption(state),
      subjectId: null,
      helperId: null,
    };
  }

  // Score and rank
  const scored = candidates.map(b => ({
    beat: b,
    score: b.evaluateFit(state),
  }));
  scored.sort((a, b) => b.score - a.score);

  const primary = scored[0].beat;

  // Determine subject and helper for choreography
  let subjectId = null;
  let helperId = null;

  if (primary.id === 'CHECK_IN') {
    const lonely = residents.find(r =>
      memory ? getContentment(memory, r.id) < 30 : r.encounterCount === 0
    );
    const helper = residents.find(r =>
      r.id !== lonely?.id &&
      ['HOST', 'STORYTELLER', 'GARDENER'].includes(r.traitKey)
    );
    // Arc: last subject becomes helper if available
    if (lastCheckInSubject) {
      const arcHelper = residents.find(r => r.id === lastCheckInSubject);
      if (arcHelper && arcHelper.id !== lonely?.id) {
        helperId = arcHelper.id;
      }
    }
    subjectId = lonely?.id || null;
    helperId = helperId || helper?.id || null;
  } else if (primary.id === 'GARDEN_CLUB') {
    const gardeners = residents.filter(r =>
      ['GARDENER', 'GREEN_THUMB'].includes(r.traitKey)
    );
    subjectId = gardeners[0]?.id || null;
    helperId = gardeners[1]?.id || null;
  } else if (primary.id === 'STORYTELLERS_PORCH') {
    const teller = residents.find(r => r.traitKey === 'STORYTELLER');
    subjectId = teller?.id || null;
  } else if (primary.id === 'NEW_NEIGHBOR') {
    const newbie = residents.find(r => r.traitKey === 'NEW_IN_TOWN');
    subjectId = newbie?.id || null;
  }

  return {
    beat: primary,
    caption: primary.generateCaption(state),
    subjectId,
    helperId,
  };
}
