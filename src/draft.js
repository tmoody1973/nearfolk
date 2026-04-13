// Nearfolk piece draft system
//
// Instead of a full palette, draw 2 pieces at a time.
// Pick 1 to place, the other goes back.
// Creates spatial dilemmas: "cottage or path?"
//
// Pure data, no Three.js.

export function createDraft(budget) {
  // Get all available piece types with remaining count > 0
  const available = Object.entries(budget)
    .filter(([type, count]) => count > 0)
    .map(([type]) => type);

  return {
    budget: { ...budget },
    available,
    currentChoices: [],
    isActive: false,
  };
}

export function drawChoices(draft) {
  const available = Object.entries(draft.budget)
    .filter(([type, count]) => count > 0)
    .map(([type]) => type);

  if (available.length === 0) {
    return { ...draft, currentChoices: [], isActive: false };
  }

  if (available.length === 1) {
    return { ...draft, currentChoices: [available[0]], isActive: true };
  }

  // Pick 2 random different types
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const choices = shuffled.slice(0, 2);

  return { ...draft, currentChoices: choices, isActive: true };
}

export function pickChoice(draft, chosenType) {
  // Decrease budget for chosen type
  const newBudget = {
    ...draft.budget,
    [chosenType]: Math.max(0, (draft.budget[chosenType] || 0) - 1),
  };

  return {
    ...draft,
    budget: newBudget,
    currentChoices: [],
    isActive: false,
  };
}

export function isDraftEmpty(draft) {
  return Object.values(draft.budget).every(c => c <= 0);
}
