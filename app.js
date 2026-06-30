// ===== 비밀번호 설정 (나중에 여기 숫자만 바꾸면 됨) =====
const APP_PIN = "0000";

let enteredPin = "";

const lockScreen = document.getElementById("lock-screen");
const appEl = document.getElementById("app");
const dots = document.querySelectorAll(".dot");
const lockError = document.getElementById("lock-error");

function updateDots() {
  dots.forEach((dot, i) => {
    dot.classList.toggle("filled", i < enteredPin.length);
  });
}

async function tryUnlock() {
  if (enteredPin === APP_PIN) {
    lockError.textContent = "로그인 중...";
    const ok = await ensureSupabaseLogin();
    if (!ok) {
      lockError.textContent = "서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.";
      enteredPin = "";
      updateDots();
      return;
    }
    lockScreen.classList.add("hidden");
    appEl.classList.remove("hidden");
    if (typeof initTodoApp === "function") initTodoApp();
  } else {
    lockError.textContent = "비밀번호가 일치하지 않습니다.";
    lockScreen.classList.add("shake");
    setTimeout(() => {
      enteredPin = "";
      updateDots();
      lockScreen.classList.remove("shake");
    }, 300);
  }
}

document.querySelectorAll(".key[data-num]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (enteredPin.length >= 4) return;
    enteredPin += btn.dataset.num;
    lockError.textContent = "";
    updateDots();
    if (enteredPin.length === 4) {
      setTimeout(tryUnlock, 120);
    }
  });
});

document.getElementById("key-del").addEventListener("click", () => {
  enteredPin = enteredPin.slice(0, -1);
  lockError.textContent = "";
  updateDots();
});

// ===== 슬라이드 메뉴(드로어) =====
const menuBtn = document.getElementById("menu-btn");
const drawer = document.getElementById("drawer");
const drawerOverlay = document.getElementById("drawer-overlay");
const drawerClose = document.getElementById("drawer-close");

function openDrawer() {
  drawer.classList.add("open");
  drawerOverlay.classList.remove("hidden");
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawerOverlay.classList.add("hidden");
}

menuBtn.addEventListener("click", openDrawer);
drawerClose.addEventListener("click", closeDrawer);
drawerOverlay.addEventListener("click", closeDrawer);

// ===== 모드 전환 (투두 / 일기 / 메모) =====
const modeTitle = document.getElementById("mode-title");
const modeNames = {
  todo: "투두리스트",
  diary: "일기",
  memo: "메모장",
};

document.querySelectorAll(".drawer-item").forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.dataset.mode;

    // 메뉴 active 표시 갱신
    document.querySelectorAll(".drawer-item").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // 화면 전환
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.getElementById(`view-${mode}`).classList.add("active");

    // 타이틀 변경
    modeTitle.textContent = modeNames[mode];

    // 메모 작성 중이었다면 다른 모드로 넘어가기 전에 저장
    if (typeof saveCurrentMemoIfNeeded === "function") {
      const memoEditor = document.getElementById("memo-editor-screen");
      if (memoEditor && !memoEditor.classList.contains("hidden")) {
        saveCurrentMemoIfNeeded();
      }
    }

    if (mode === "diary" && typeof initDiaryApp === "function") initDiaryApp();
    if (mode === "memo" && typeof initMemoApp === "function") initMemoApp();

    closeDrawer();
  });
});
