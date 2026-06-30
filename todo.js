// ============================================================
// 투두리스트 기능
// 지금은 localStorage에 저장. 나중에 Supabase 연동 시
// loadCategories/saveCategories, loadTodos/saveTodos 함수만
// Supabase 호출로 교체하면 됨.
// ============================================================

const CATEGORY_COLORS = [
  "#8a8f98", // 그레이
  "#e3a6c1", // 핑크
  "#9bd1b0", // 그린
  "#8fb3e0", // 블루
  "#c9a6e3", // 퍼플
  "#e3c08a", // 옐로/베이지
  "#e08a8a", // 레드
];

let categories = [];
let todos = [];
let calYear, calMonth; // 0-indexed month
let selectedDate; // "YYYY-MM-DD"
let editingCategoryId = null; // null이면 새로 추가 중
let pickedColor = CATEGORY_COLORS[0];

// ----- 저장/불러오기 (Supabase) -----
async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) { console.error("카테고리 불러오기 실패:", error.message); categories = []; return; }
  categories = data.map(row => ({ id: row.id, name: row.name, color: row.color }));
}

async function loadTodos() {
  const { data, error } = await supabaseClient
    .from("todos")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) { console.error("할일 불러오기 실패:", error.message); todos = []; return; }
  todos = data.map(row => ({
    id: row.id,
    categoryId: row.category_id,
    date: row.date,
    text: row.text,
    done: row.done,
  }));
}

async function addCategoryToDB(name, color) {
  const { data, error } = await supabaseClient
    .from("categories")
    .insert({ name, color })
    .select()
    .single();
  if (error) { console.error("카테고리 추가 실패:", error.message); return null; }
  return data;
}

async function updateCategoryInDB(id, name, color) {
  const { error } = await supabaseClient
    .from("categories")
    .update({ name, color })
    .eq("id", id);
  if (error) console.error("카테고리 수정 실패:", error.message);
}

async function deleteCategoryFromDB(id) {
  const { error } = await supabaseClient.from("categories").delete().eq("id", id);
  if (error) console.error("카테고리 삭제 실패:", error.message);
}

async function addTodoToDB(categoryId, date, text) {
  const { data, error } = await supabaseClient
    .from("todos")
    .insert({ category_id: categoryId, date, text, done: false })
    .select()
    .single();
  if (error) { console.error("할일 추가 실패:", error.message); return null; }
  return data;
}

async function updateTodoDoneInDB(id, done) {
  const { error } = await supabaseClient.from("todos").update({ done }).eq("id", id);
  if (error) console.error("할일 수정 실패:", error.message);
}

async function deleteTodoFromDB(id) {
  const { error } = await supabaseClient.from("todos").delete().eq("id", id);
  if (error) console.error("할일 삭제 실패:", error.message);
}

// ----- 날짜 유틸 -----
function pad2(n) { return String(n).padStart(2, "0"); }
function toDateStr(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }
function todayStr() {
  const t = new Date();
  return toDateStr(t.getFullYear(), t.getMonth(), t.getDate());
}

// ----- 초기화 -----
let todoListenersBound = false;

async function initTodoApp() {
  const today = new Date();
  calYear = today.getFullYear();
  calMonth = today.getMonth();
  selectedDate = todayStr();

  renderColorPicker();
  renderCategoryList(); // 로딩 중 빈 화면 깜빡임 방지용 1차 렌더

  await loadCategories();
  await loadTodos();

  renderCalendar();
  renderCategoryList();

  if (todoListenersBound) return; // 중복 등록 방지
  todoListenersBound = true;

  document.getElementById("cal-prev").addEventListener("click", () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  document.getElementById("cal-next").addEventListener("click", () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });

  document.getElementById("add-category-btn").addEventListener("click", () => openCategoryModal(null));
  document.getElementById("category-cancel-btn").addEventListener("click", closeCategoryModal);
  document.getElementById("category-save-btn").addEventListener("click", saveCategoryFromModal);
  document.getElementById("category-delete-btn").addEventListener("click", deleteCategoryFromModal);
}

// ----- 미니 캘린더 렌더링 -----
function renderCalendar() {
  const label = document.getElementById("cal-month-label");
  label.textContent = `${calYear}년 ${calMonth + 1}월`;

  const grid = document.getElementById("mini-cal-grid");
  grid.innerHTML = "";

  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=일
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = todayStr();

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-cell empty";
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(calYear, calMonth, d);
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    if (dateStr === today) cell.classList.add("today");
    if (dateStr === selectedDate) cell.classList.add("selected");

    const num = document.createElement("span");
    num.textContent = d;
    cell.appendChild(num);

    // 그 날짜에 할일이 있는 카테고리들의 색상 점 표시
    const dayCategoryIds = [...new Set(
      todos.filter(t => t.date === dateStr).map(t => t.categoryId)
    )];
    if (dayCategoryIds.length > 0) {
      const dotsWrap = document.createElement("div");
      dotsWrap.className = "cal-dots";
      dayCategoryIds.forEach(catId => {
        const cat = categories.find(c => c.id === catId);
        if (!cat) return;
        const dot = document.createElement("span");
        dot.className = "cal-dot";
        dot.style.background = cat.color;
        dotsWrap.appendChild(dot);
      });
      cell.appendChild(dotsWrap);
    }

    cell.addEventListener("click", () => {
      selectedDate = dateStr;
      renderCalendar();
      renderSelectedDateLabel();
      renderCategoryList();
    });

    grid.appendChild(cell);
  }

  renderSelectedDateLabel();
}

function renderSelectedDateLabel() {
  const [y, m, d] = selectedDate.split("-").map(Number);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  document.getElementById("selected-date-label").textContent =
    `${y}년 ${m}월 ${d}일 (${weekday})`;
}

// ----- 카테고리 + 할일 목록 렌더링 -----
function renderCategoryList() {
  const wrap = document.getElementById("category-list");
  wrap.innerHTML = "";

  if (categories.length === 0) {
    const p = document.createElement("p");
    p.className = "placeholder";
    p.textContent = "카테고리를 추가하고 할 일을 적어보세요.";
    wrap.appendChild(p);
    return;
  }

  categories.forEach(cat => {
    const block = document.createElement("div");
    block.className = "category-block";

    // 헤더
    const head = document.createElement("div");
    head.className = "category-head";

    const dot = document.createElement("span");
    dot.className = "category-color-dot";
    dot.style.background = cat.color;
    head.appendChild(dot);

    const name = document.createElement("span");
    name.className = "category-name";
    name.textContent = cat.name;
    head.appendChild(name);

    const editBtn = document.createElement("button");
    editBtn.className = "category-edit-btn";
    editBtn.textContent = "수정";
    editBtn.addEventListener("click", () => openCategoryModal(cat.id));
    head.appendChild(editBtn);

    block.appendChild(head);

    // 해당 카테고리 + 선택된 날짜의 할일들
    const catTodos = todos.filter(t => t.categoryId === cat.id && t.date === selectedDate);
    catTodos.forEach(todo => {
      block.appendChild(renderTodoRow(todo));
    });

    // 할일 추가 입력
    const addRow = document.createElement("div");
    addRow.className = "todo-add-row";

    const input = document.createElement("input");
    input.className = "todo-add-input";
    input.type = "text";
    input.placeholder = "할 일 추가";

    const addBtn = document.createElement("button");
    addBtn.className = "todo-add-btn";
    addBtn.textContent = "추가";

    const submit = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.disabled = true;
      const row = await addTodoToDB(cat.id, selectedDate, text);
      input.disabled = false;
      if (!row) return;
      todos.push({
        id: row.id,
        categoryId: row.category_id,
        date: row.date,
        text: row.text,
        done: row.done,
      });
      input.value = "";
      renderCategoryList();
      renderCalendar();
    };

    addBtn.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });

    addRow.appendChild(input);
    addRow.appendChild(addBtn);
    block.appendChild(addRow);

    wrap.appendChild(block);
  });
}

function renderTodoRow(todo) {
  const row = document.createElement("div");
  row.className = "todo-row";

  const check = document.createElement("button");
  check.className = "todo-check" + (todo.done ? " checked" : "");
  check.style.background = todo.done ? "var(--accent)" : "transparent";
  check.textContent = todo.done ? "✓" : "";
  check.addEventListener("click", async () => {
    todo.done = !todo.done;
    renderCategoryList(); // 먼저 화면 반영(반응 빠르게)
    await updateTodoDoneInDB(todo.id, todo.done);
  });
  row.appendChild(check);

  const text = document.createElement("span");
  text.className = "todo-text" + (todo.done ? " done" : "");
  text.textContent = todo.text;
  row.appendChild(text);

  const delBtn = document.createElement("button");
  delBtn.className = "todo-del-btn";
  delBtn.textContent = "×";
  delBtn.addEventListener("click", async () => {
    todos = todos.filter(t => t.id !== todo.id);
    renderCategoryList();
    renderCalendar();
    await deleteTodoFromDB(todo.id);
  });
  row.appendChild(delBtn);

  return row;
}

// ----- 카테고리 추가/수정 모달 -----
function renderColorPicker() {
  const wrap = document.getElementById("color-picker");
  wrap.innerHTML = "";
  CATEGORY_COLORS.forEach(color => {
    const sw = document.createElement("span");
    sw.className = "color-swatch" + (color === pickedColor ? " selected" : "");
    sw.style.background = color;
    sw.addEventListener("click", () => {
      pickedColor = color;
      renderColorPicker();
    });
    wrap.appendChild(sw);
  });
}

function openCategoryModal(categoryId) {
  editingCategoryId = categoryId;
  const modal = document.getElementById("category-modal");
  const title = document.getElementById("category-modal-title");
  const nameInput = document.getElementById("category-name-input");
  const deleteBtn = document.getElementById("category-delete-btn");

  if (categoryId) {
    const cat = categories.find(c => c.id === categoryId);
    title.textContent = "카테고리 수정";
    nameInput.value = cat.name;
    pickedColor = cat.color;
    deleteBtn.classList.remove("hidden");
  } else {
    title.textContent = "카테고리 추가";
    nameInput.value = "";
    pickedColor = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length];
    deleteBtn.classList.add("hidden");
  }

  renderColorPicker();
  modal.classList.remove("hidden");
  nameInput.focus();
}

function closeCategoryModal() {
  document.getElementById("category-modal").classList.add("hidden");
  editingCategoryId = null;
}

async function saveCategoryFromModal() {
  const name = document.getElementById("category-name-input").value.trim();
  if (!name) return;

  if (editingCategoryId) {
    const cat = categories.find(c => c.id === editingCategoryId);
    cat.name = name;
    cat.color = pickedColor;
    closeCategoryModal();
    renderCategoryList();
    renderCalendar();
    await updateCategoryInDB(editingCategoryId, name, pickedColor);
  } else {
    closeCategoryModal();
    const row = await addCategoryToDB(name, pickedColor);
    if (!row) return;
    categories.push({ id: row.id, name: row.name, color: row.color });
    renderCategoryList();
    renderCalendar();
  }
}

async function deleteCategoryFromModal() {
  if (!editingCategoryId) return;
  const idToDelete = editingCategoryId;
  categories = categories.filter(c => c.id !== idToDelete);
  todos = todos.filter(t => t.categoryId !== idToDelete);
  closeCategoryModal();
  renderCategoryList();
  renderCalendar();
  await deleteCategoryFromDB(idToDelete); // todos는 DB의 on delete cascade 설정으로 같이 정리됨
}

// 참고: 이제 초기화는 app.js에서 PIN 통과 + Supabase 로그인 성공 후 initTodoApp()을 호출하는 방식으로 바뀜
