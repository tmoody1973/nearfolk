// Nearfolk Journal
//
// Displays the neighborhood's accumulated story history.
// Each entry is one day's Director beat caption.
// The journal IS the game's long-term artifact.

export function createJournalUI() {
  const overlay = document.createElement('div');
  overlay.id = 'journal-overlay';
  overlay.className = 'hidden';
  overlay.innerHTML = `
    <style>
      #journal-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(107, 78, 58, 0.6);
        z-index: 30;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #journal-overlay.hidden { display: none; }
      #journal-panel {
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        border: 8px solid transparent;
        border-image: url('/ui/panel_brown_corners_a.png') 12 fill stretch;
        image-rendering: pixelated;
        padding: 24px;
        overflow-y: auto;
      }
      #journal-title {
        font-family: 'Lora', serif;
        font-size: 1.4rem;
        font-weight: 700;
        color: #6b4e3a;
        text-align: center;
        margin-bottom: 16px;
      }
      .journal-entry {
        padding: 8px 0;
        border-bottom: 1px solid rgba(139, 107, 74, 0.15);
        color: #6b4e3a;
      }
      .journal-entry:last-child { border-bottom: none; }
      .journal-day {
        font-family: 'Nunito', sans-serif;
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.4;
        margin-bottom: 2px;
      }
      .journal-caption {
        font-family: 'Lora', serif;
        font-size: 0.9rem;
        font-style: italic;
        line-height: 1.5;
      }
      .journal-score {
        font-family: 'Nunito', sans-serif;
        font-size: 0.7rem;
        opacity: 0.4;
        margin-top: 2px;
      }
      .journal-empty {
        text-align: center;
        opacity: 0.4;
        font-style: italic;
        padding: 32px 0;
      }
      #journal-close {
        display: block;
        margin: 16px auto 0;
        border: 4px solid transparent;
        border-image: url('/ui/button_brown.png') 8 fill stretch;
        image-rendering: pixelated;
        background: none;
        padding: 6px 20px;
        font-family: 'Nunito', sans-serif;
        font-size: 0.85rem;
        font-weight: 600;
        color: #6b4e3a;
        cursor: pointer;
      }
    </style>
    <div id="journal-panel">
      <div id="journal-title">Neighborhood Journal</div>
      <div id="journal-entries"></div>
      <button id="journal-close">Close</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('journal-close').addEventListener('click', () => {
    overlay.classList.add('hidden');
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });

  return overlay;
}

export function updateJournalUI(journal) {
  const entriesEl = document.getElementById('journal-entries');
  if (!entriesEl) return;

  if (!journal || journal.length === 0) {
    entriesEl.innerHTML = '<div class="journal-empty">No stories yet. Place some cottages and press Settle.</div>';
    return;
  }

  entriesEl.innerHTML = journal.map(entry => `
    <div class="journal-entry">
      <div class="journal-day">Day ${entry.day} · ${entry.beatName}</div>
      <div class="journal-caption">${entry.caption}</div>
      <div class="journal-score">Score: ${entry.score}</div>
    </div>
  `).join('');

  // Scroll to bottom (latest entry)
  entriesEl.scrollTop = entriesEl.scrollHeight;
}

export function showJournal() {
  const overlay = document.getElementById('journal-overlay');
  if (overlay) overlay.classList.remove('hidden');
}
