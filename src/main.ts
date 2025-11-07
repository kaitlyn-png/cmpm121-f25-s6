import "./style.css";

type Entry = {
  id: string;
  text: string;
  timestamp: string; // ISO
};

const STORAGE_KEY = "foodDiaryEntries:v1";

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function saveEntries(entries: Entry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadEntries(): Entry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Entry[];
  } catch (e) {
    console.error("Failed to load entries", e);
    return [];
  }
}

function sameDay(aIso: string, bIso: string) {
  const a = new Date(aIso);
  const b = new Date(bIso);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// --- UI root
document.body.innerHTML = `
  <main class="app">
    <header class="header">
      <h1>Food Diary</h1>
      <p class="subtitle">Quickly jot what you ate — saved locally on this device.</p>
    </header>

    <section class="controls">
      <div class="date-nav">
        <button id="prevDay">◀</button>
        <input id="datePicker" type="date" />
        <button id="nextDay">▶</button>
        <button id="todayBtn">Today</button>
      </div>
      <div class="entry-form">
        <input id="foodInput" placeholder="What did you eat? (e.g., avocado toast)" />
        <button id="addBtn">Add</button>
      </div>
    </section>

    <section class="content">
      <aside class="day-list" id="dayList"></aside>
      <section class="main-view">
        <h2 id="dayTitle">Today</h2>
        <ul id="entries"></ul>
        <hr />
        <h3>Week summary</h3>
        <div id="weekSummary"></div>
      </section>
    </section>
  </main>
`;

// --- App state
let entries = loadEntries();
let selectedDate = new Date();

// DOM refs
const foodInput = document.getElementById("foodInput") as HTMLInputElement;
const addBtn = document.getElementById("addBtn") as HTMLButtonElement;
const entriesEl = document.getElementById("entries") as HTMLUListElement;
const dayTitle = document.getElementById("dayTitle") as HTMLHeadingElement;
const datePicker = document.getElementById("datePicker") as HTMLInputElement;
const prevDay = document.getElementById("prevDay") as HTMLButtonElement;
const nextDay = document.getElementById("nextDay") as HTMLButtonElement;
const todayBtn = document.getElementById("todayBtn") as HTMLButtonElement;
const weekSummary = document.getElementById("weekSummary") as HTMLDivElement;

function render() {
  // set date picker
  datePicker.value = selectedDate.toISOString().slice(0, 10);

  // day title
  dayTitle.textContent = selectedDate.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // entries for day
  const dayEntries = entries
    .filter((e) => sameDay(e.timestamp, selectedDate.toISOString()))
    .sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

  entriesEl.innerHTML = "";
  if (dayEntries.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No entries for this day.";
    entriesEl.appendChild(li);
  } else {
    for (const e of dayEntries) {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="entry-text">${escapeHtml(e.text)}</div>
        <div class="entry-meta">
          <time>${
        new Date(e.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      }</time>
          <button class="del" data-id="${e.id}">Delete</button>
        </div>
      `;
      entriesEl.appendChild(li);
    }
  }

  // week summary (last 7 days including selected)
  renderWeekSummary();
}

function renderWeekSummary() {
  const days: { date: Date; entries: Entry[] }[] = [];
  const base = new Date(selectedDate);
  base.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const dIso = d.toISOString();
    const dayEntries = entries.filter((e) => sameDay(e.timestamp, dIso));
    days.push({ date: d, entries: dayEntries });
  }

  weekSummary.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "week-grid";

  for (const d of days) {
    const card = document.createElement("div");
    card.className = "day-card";
    const dayLabel = d.date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    card.innerHTML = `
      <div class="day-card-header">
        <strong>${dayLabel}</strong>
        <span class="count">${d.entries.length}</span>
      </div>
    `;
    if (d.entries.length > 0) {
      const ul = document.createElement("ul");
      ul.className = "mini-list";
      for (const e of d.entries.slice(0, 5)) {
        const li = document.createElement("li");
        li.textContent = `${
          new Date(e.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        } — ${e.text}`;
        ul.appendChild(li);
      }
      if (d.entries.length > 5) {
        const more = document.createElement("div");
        more.className = "more";
        more.textContent = `+${d.entries.length - 5} more`;
        card.appendChild(ul);
        card.appendChild(more);
      } else {
        card.appendChild(ul);
      }
    } else {
      const p = document.createElement("div");
      p.className = "no-items";
      p.textContent = "—";
      card.appendChild(p);
    }
    // clicking a card changes selected date
    card.addEventListener("click", () => {
      selectedDate = new Date(d.date);
      render();
    });
    grid.appendChild(card);
  }

  weekSummary.appendChild(grid);
}

function addEntry(text: string) {
  const e: Entry = {
    id: uid(),
    text: text.trim(),
    timestamp: new Date().toISOString(),
  };
  entries.push(e);
  saveEntries(entries);
  // switch to entry's day
  selectedDate = new Date(e.timestamp);
  render();
}

function deleteEntry(id: string) {
  entries = entries.filter((e) => e.id !== id);
  saveEntries(entries);
  render();
}

// helpers
function escapeHtml(s: string) {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return s.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

// wire events
addBtn.addEventListener("click", () => {
  const v = foodInput.value.trim();
  if (!v) return;
  addEntry(v);
  foodInput.value = "";
  foodInput.focus();
});

foodInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    (e as KeyboardEvent).preventDefault();
    addBtn.click();
  }
});

entriesEl.addEventListener("click", (ev) => {
  const target = ev.target as HTMLElement;
  if (target.classList.contains("del")) {
    const id = target.getAttribute("data-id");
    if (id) deleteEntry(id);
  }
});

prevDay.addEventListener("click", () => {
  selectedDate.setDate(selectedDate.getDate() - 1);
  render();
});
nextDay.addEventListener("click", () => {
  selectedDate.setDate(selectedDate.getDate() + 1);
  render();
});

todayBtn.addEventListener("click", () => {
  selectedDate = new Date();
  render();
});

datePicker.addEventListener("change", () => {
  const v = datePicker.value;
  if (!v) return;
  selectedDate = new Date(v + "T00:00:00");
  render();
});

// initial render
selectedDate = new Date();
render();
