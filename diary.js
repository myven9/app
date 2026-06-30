// ============================================================
// 일기 기능
// 투두와 마찬가지로 지금은 localStorage 사용.
// 나중에 Supabase 연동 시 loadDiaryEntries / upsertDiaryEntry /
// deleteDiaryEntry 함수만 교체하면 됨.
// ============================================================

const DIARY_EMOJI_OPTIONS = [
  "😊","😢","😡","😴","😍","😭","😆","😐","😰","🥳",
  "🍿","☕","🎵","📚","🏃","🍔","💼","🌧️","☀️","💤",
];

let diaryEntries = []; // [{id, date, emojis:[...], rating, text}]
let diaryCalYear, diaryCalMonth;
let diarySelectedDate;
let diarySelectedEmojis = [];
let diarySelectedRating = 0;

// ----- 저장/불러오기 (Supabase) -----
async function loadDiaryEntries() {
  const { data, error } = await supabaseClient
    .from("diary_entries")
    .select("*")
    .order("date", { ascending: true });
  if (error) { console.error("일기 불러오기 실패:", error.message); diaryEntries = []; return; }
  diaryEntries = data.map(row => ({
    id: row.id,
    date: row.date,
    emojis: row.emojis || [],
    rating: Number(row.rating) || 0,
    text: row.text || "",
  }));
}

// 있으면 수정, 없으면 새로 추가 (date에 unique 제약이 있어서 upsert 사용)
async function upsertDiaryEntryToDB(date, emojis, rating, text) {
  const { data, error } = await supabaseClient
    .from("diary_entries")
    .upsert({ date, emojis, rating, text }, { onConflict: "date" })
    .select()
    .single();
  if (error) { console.error("일기 저장 실패:", error.message); return null; }
  return data;
}

async function deleteDiaryEntryFromDB(date) {
  const { error } = await supabaseClient.from("diary_entries").delete().eq("date", date);
  if (error) console.error("일기 삭제 실패:", error.message);
}

function getEntryByDate(dateStr) {
  return diaryEntries.find(e => e.date === dateStr) || null;
}

// ----- 초기화 -----
let diaryInited = false;

async function initDiaryApp() {
  await loadDiaryEntries();

  const today = new Date();
  diaryCalYear = today.getFullYear();
  diaryCalMonth = today.getMonth();
  diarySelectedDate = todayStr();

  renderDiaryEmojiPicker();
  renderDiaryCalendar();
  loadEntryIntoEditor(diarySelectedDate);
  renderDiaryGraph();

  if (diaryInited) return;
  diaryInited = true;

  document.getElementById("diary-cal-prev").addEventListener("click", () => {
    diaryCalMonth--;
    if (diaryCalMonth < 0) { diaryCalMonth = 11; diaryCalYear--; }
    renderDiaryCalendar();
    renderDiaryGraph();
  });
  document.getElementById("diary-cal-next").addEventListener("click", () => {
    diaryCalMonth++;
    if (diaryCalMonth > 11) { diaryCalMonth = 0; diaryCalYear++; }
    renderDiaryCalendar();
    renderDiaryGraph();
  });

  document.getElementById("diary-save-btn").addEventListener("click", saveDiaryEntry);
  document.getElementById("diary-delete-btn").addEventListener("click", deleteDiaryEntry);
}

// ----- 캘린더 -----
function renderDiaryCalendar() {
  document.getElementById("diary-cal-month-label").textContent =
    `${diaryCalYear}년 ${diaryCalMonth + 1}월`;

  const grid = document.getElementById("diary-cal-grid");
  grid.innerHTML = "";

  const firstDay = new Date(diaryCalYear, diaryCalMonth, 1).getDay();
  const daysInMonth = new Date(diaryCalYear, diaryCalMonth + 1, 0).getDate();
  const today = todayStr();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-cell empty";
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(diaryCalYear, diaryCalMonth, d);
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    if (dateStr === today) cell.classList.add("today");
    if (dateStr === diarySelectedDate) cell.classList.add("selected");

    const num = document.createElement("span");
    num.textContent = d;
    cell.appendChild(num);

    const entry = getEntryByDate(dateStr);
    if (entry && entry.emojis && entry.emojis.length > 0) {
      const emojiWrap = document.createElement("span");
      emojiWrap.className = "diary-cal-emoji";
      emojiWrap.textContent = entry.emojis.slice(0, 2).join("");
      cell.appendChild(emojiWrap);
    }

    cell.addEventListener("click", () => {
      diarySelectedDate = dateStr;
      renderDiaryCalendar();
      loadEntryIntoEditor(dateStr);
    });

    grid.appendChild(cell);
  }
}

// ----- 에디터 -----
function loadEntryIntoEditor(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  document.getElementById("diary-selected-date-label").textContent = `${y}년 ${m}월 ${d}일 (${weekday})`;

  const entry = getEntryByDate(dateStr);
  diarySelectedEmojis = entry ? [...entry.emojis] : [];
  diarySelectedRating = entry ? entry.rating : 0;
  document.getElementById("diary-text").value = entry ? entry.text : "";
  document.getElementById("diary-delete-btn").classList.toggle("hidden", !entry);

  renderDiaryEmojiPicker();
  renderStarRating();
}

function renderDiaryEmojiPicker() {
  const wrap = document.getElementById("diary-emoji-picker");
  wrap.innerHTML = "";
  DIARY_EMOJI_OPTIONS.forEach(emoji => {
    const btn = document.createElement("button");
    btn.className = "emoji-option" + (diarySelectedEmojis.includes(emoji) ? " selected" : "");
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      if (diarySelectedEmojis.includes(emoji)) {
        diarySelectedEmojis = diarySelectedEmojis.filter(e => e !== emoji);
      } else {
        diarySelectedEmojis.push(emoji);
      }
      renderDiaryEmojiPicker();
    });
    wrap.appendChild(btn);
  });
}

function renderStarRating() {
  const wrap = document.getElementById("diary-star-rating");
  wrap.innerHTML = "";

  for (let i = 0; i < 5; i++) {
    const slot = document.createElement("span");
    slot.className = "star-slot";

    const bg = document.createElement("span");
    bg.className = "star-bg";
    bg.textContent = "★";

    const fill = document.createElement("span");
    fill.className = "star-fill";
    fill.textContent = "★";

    const starValue = diarySelectedRating - i; // 이 별이 채워진 비율 (0~1)
    const pct = Math.max(0, Math.min(1, starValue)) * 100;
    fill.style.width = pct + "%";

    slot.appendChild(bg);
    slot.appendChild(fill);

    slot.addEventListener("click", (e) => {
      const rect = slot.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const isLeftHalf = clickX < rect.width / 2;
      diarySelectedRating = i + (isLeftHalf ? 0.5 : 1);
      renderStarRating();
    });

    wrap.appendChild(slot);
  }
}

// ----- 저장/삭제 -----
async function saveDiaryEntry() {
  const text = document.getElementById("diary-text").value.trim();

  const row = await upsertDiaryEntryToDB(diarySelectedDate, diarySelectedEmojis, diarySelectedRating, text);
  if (!row) return;

  const entryData = {
    id: row.id,
    date: row.date,
    emojis: row.emojis || [],
    rating: Number(row.rating) || 0,
    text: row.text || "",
  };

  const existing = getEntryByDate(diarySelectedDate);
  if (existing) {
    Object.assign(existing, entryData);
  } else {
    diaryEntries.push(entryData);
  }

  renderDiaryCalendar();
  loadEntryIntoEditor(diarySelectedDate);
  renderDiaryGraph();
}

async function deleteDiaryEntry() {
  diaryEntries = diaryEntries.filter(e => e.date !== diarySelectedDate);
  renderDiaryCalendar();
  loadEntryIntoEditor(diarySelectedDate);
  renderDiaryGraph();
  await deleteDiaryEntryFromDB(diarySelectedDate);
}

// ----- 월간 기분 그래프 (간단한 SVG 꺾은선) -----
function renderDiaryGraph() {
  const container = document.getElementById("diary-graph");
  const daysInMonth = new Date(diaryCalYear, diaryCalMonth + 1, 0).getDate();

  const points = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(diaryCalYear, diaryCalMonth, d);
    const entry = getEntryByDate(dateStr);
    if (entry) points.push({ day: d, rating: entry.rating });
  }

  if (points.length === 0) {
    container.innerHTML = '<p class="placeholder">이번 달 기록이 아직 없어요.</p>';
    return;
  }

  const width = 600;
  const height = 160;
  const padX = 20;
  const padY = 16;
  const xStep = (width - padX * 2) / (daysInMonth - 1 || 1);
  const yFor = (rating) => height - padY - (rating / 5) * (height - padY * 2);

  const lineCoords = points.map(p => `${padX + (p.day - 1) * xStep},${yFor(p.rating)}`).join(" ");

  const dots = points.map(p =>
    `<circle cx="${padX + (p.day - 1) * xStep}" cy="${yFor(p.rating)}" r="3.5" fill="var(--accent)" />`
  ).join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto;">
      <polyline points="${lineCoords}" fill="none" stroke="var(--accent)" stroke-width="2" />
      ${dots}
    </svg>
  `;
}
