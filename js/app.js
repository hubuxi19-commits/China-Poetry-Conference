// ============================================================
//  主逻辑：视图切换 + 抽题打乱 + 逐题判定 + 计时 + 成绩提交 + 排行榜
// ============================================================

import { CONFIG } from "./config.js";
import { QUESTIONS } from "./questions.js";
import { getFingerprint, hasPlayed, getMyRecord, markPlayed } from "./storage.js";
import { api, IS_LOCAL_MODE } from "./api.js";

const $ = (id) => document.getElementById(id);
const LETTERS = ["A", "B", "C", "D"];

const state = {
  nickname: "",
  deck: [], // 本局抽出的题目（含打乱后的选项与正确下标）
  idx: 0,
  correct: 0,
  answers: [],
  startedAt: 0,
  durationMs: 0,
  timerId: null,
  locked: false,
  finished: false,
};

// ——————————— 工具 ———————————
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatMs(ms) {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function gradeText(score, total) {
  const r = score / total;
  if (r === 1) return "满分！诗仙本仙，名不虚传。";
  if (r >= 0.8) return "博闻强识，才华卓然。";
  if (r >= 0.6) return "颇有功底，再接再厉。";
  if (r >= 0.4) return "初窥门径，尚需多读。";
  return "来日方长，与诗同行。";
}

// ——————————— 视图切换 ———————————
const VIEWS = ["home", "quiz", "result", "leaderboard"];
function showView(name) {
  VIEWS.forEach((v) => $(`view-${v}`).classList.toggle("is-active", v === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ——————————— 抽题 ———————————
function buildDeck() {
  const picked = shuffle(QUESTIONS).slice(0, CONFIG.QUESTIONS_PER_ROUND);
  return picked.map((q) => {
    let order = q.options.map((_, i) => i);
    if (CONFIG.SHUFFLE_OPTIONS) order = shuffle(order);
    return {
      id: q.id,
      q: q.q,
      options: order.map((i) => q.options[i]),
      correctIndex: order.indexOf(q.answer),
    };
  });
}

// ——————————— 首页 ———————————
function renderHome() {
  const panel = $("entry-panel");

  if (hasPlayed()) {
    const rec = getMyRecord();
    panel.className = "card entry done-note";
    panel.innerHTML = `
      <div class="done-score">${rec.correctCount}<small> / ${rec.totalQuestions}</small></div>
      <p>你已作答过，用时 ${formatMs(rec.durationMs)}。</p>
      <p>${escapeHtml(rec.nickname)}，谢谢参与。</p>`;
    return;
  }

  panel.className = "card entry";
  panel.innerHTML = `
    <label for="nickname">取一个昵称，开始答题</label>
    <div class="nick-row">
      <input id="nickname" type="text" maxlength="20" placeholder="例如：爱读诗的小明"
             autocomplete="off" autocapitalize="off" />
      <button id="btn-start" class="btn">开始答题</button>
    </div>
    <p class="entry-err" id="entry-err"></p>`;

  $("btn-start").addEventListener("click", startQuiz);
  $("nickname").addEventListener("keydown", (e) => {
    if (e.key === "Enter") startQuiz();
  });
}

// ——————————— 开始答题 ———————————
function startQuiz() {
  const input = $("nickname");
  const err = $("entry-err");
  const name = (input.value || "").trim();

  if (!name) {
    err.textContent = "请先取一个昵称。";
    input.classList.add("shake");
    setTimeout(() => input.classList.remove("shake"), 420);
    input.focus();
    return;
  }

  Object.assign(state, {
    nickname: name,
    deck: buildDeck(),
    idx: 0,
    correct: 0,
    answers: [],
    locked: false,
    finished: false,
    durationMs: 0,
    startedAt: Date.now(),
  });

  $("q-total").textContent = state.deck.length;
  $("q-score").textContent = "0";
  $("progress-fill").style.width = "0%";

  startTimer();
  renderQuestion();
  showView("quiz");
}

function startTimer() {
  stopTimer();
  const tick = () => {
    const elapsed = Date.now() - state.startedAt;
    $("q-timer").textContent = formatMs(elapsed);
    if (CONFIG.TIME_LIMIT_SECONDS > 0 && elapsed >= CONFIG.TIME_LIMIT_SECONDS * 1000) {
      finishQuiz(true);
    }
  };
  tick();
  state.timerId = setInterval(tick, 250);
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

// ——————————— 渲染一道题 ———————————
function renderQuestion() {
  state.locked = false;
  const cur = state.deck[state.idx];

  $("q-index").textContent = state.idx + 1;
  $("question-text").textContent = cur.q;
  $("btn-next").classList.add("hidden");

  const box = $("options");
  box.innerHTML = "";
  cur.options.forEach((text, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "opt";
    btn.innerHTML =
      `<span class="opt-letter">${LETTERS[i]}</span>` +
      `<span class="opt-text"></span>` +
      `<span class="opt-mark"></span>`;
    btn.querySelector(".opt-text").textContent = text;
    btn.addEventListener("click", () => selectOption(i));
    box.appendChild(btn);
  });

  // 重放淡入动效
  const card = $("question-card");
  card.style.animation = "none";
  void card.offsetWidth;
  card.style.animation = "viewIn 0.35s cubic-bezier(0.22,0.61,0.36,1) both";
}

// ——————————— 判定一道题 ———————————
function selectOption(picked) {
  if (state.locked || state.finished) return;
  state.locked = true;

  const cur = state.deck[state.idx];
  const correctIdx = cur.correctIndex;
  const isCorrect = picked === correctIdx;

  [...$("options").children].forEach((el, i) => {
    el.disabled = true;
    const mark = el.querySelector(".opt-mark");
    if (i === correctIdx) {
      el.classList.add("is-correct");
      mark.textContent = "✓";
    } else if (i === picked) {
      el.classList.add("is-wrong");
      mark.textContent = "✕";
    } else {
      el.classList.add("is-dim");
    }
  });

  if (isCorrect) {
    state.correct += 1;
    $("q-score").textContent = state.correct;
  }

  state.answers.push({
    id: cur.id,
    q: cur.q,
    pickedText: cur.options[picked],
    correctText: cur.options[correctIdx],
    isCorrect,
  });

  $("progress-fill").style.width = `${((state.idx + 1) / state.deck.length) * 100}%`;

  const nextBtn = $("btn-next");
  nextBtn.textContent = state.idx === state.deck.length - 1 ? "查看成绩" : "下一题";
  nextBtn.classList.remove("hidden");
}

function goNext() {
  if (!state.locked || state.finished) return;
  state.idx += 1;
  if (state.idx >= state.deck.length) finishQuiz(false);
  else renderQuestion();
}

// ——————————— 结束 ———————————
async function finishQuiz(byTimeout) {
  if (state.finished) return;
  state.finished = true;
  stopTimer();

  const durationMs = Math.max(1, Date.now() - state.startedAt);
  const record = {
    nickname: state.nickname,
    correctCount: state.correct,
    totalQuestions: state.deck.length,
    durationMs,
    createdAt: new Date().toISOString(),
  };
  state.durationMs = durationMs;

  markPlayed(record); // 先落本地，防止刷新后可再答一次

  renderResult(record, byTimeout);
  renderHome(); // 首页同步为"已作答"
  showView("result");

  await submitScore(record);
}

function renderResult(record, byTimeout) {
  $("result-score").textContent = record.correctCount;
  $("result-total").textContent = record.totalQuestions;
  $("result-time").textContent = formatMs(record.durationMs);
  $("result-rank").textContent = "—";
  $("result-grade").textContent = gradeText(record.correctCount, record.totalQuestions);

  const st = $("submit-status");
  st.className = "submit-status";
  st.textContent = byTimeout ? "时间到，已自动交卷。" : "";

  renderReview();
}

function renderReview() {
  const box = $("review-list");
  box.innerHTML = "";
  state.answers.forEach((a, i) => {
    const item = document.createElement("div");
    item.className = `review-item ${a.isCorrect ? "ok" : "no"}`;
    const ans = a.isCorrect
      ? `正确答案：<b>${escapeHtml(a.correctText)}</b>`
      : `你的选择：<s>${escapeHtml(a.pickedText)}</s>　正确答案：<b>${escapeHtml(
          a.correctText
        )}</b>`;
    item.innerHTML =
      `<span class="review-no">${i + 1}</span>` +
      `<div class="review-body"><p class="review-q">${escapeHtml(a.q)}</p>` +
      `<p class="review-ans">${ans}</p></div>`;
    box.appendChild(item);
  });
}

async function submitScore(record) {
  const st = $("submit-status");
  st.className = "submit-status";
  st.textContent = "正在提交成绩…";

  try {
    const res = await api.submitScore({
      nickname: record.nickname,
      fingerprint: getFingerprint(),
      correctCount: record.correctCount,
      totalQuestions: record.totalQuestions,
      durationMs: record.durationMs,
    });

    if (res.duplicate) {
      st.className = "submit-status is-err";
      st.textContent = "这个浏览器已经提交过成绩，不再重复计入。";
    } else {
      st.className = "submit-status is-ok";
      st.textContent = IS_LOCAL_MODE ? "成绩已记录（本地模式）。" : "成绩已上传，感谢参与。";
    }
  } catch (e) {
    st.className = "submit-status is-err";
    st.textContent = "成绩上传失败，已保留在本机。";
    console.error(e);
  }

  try {
    const { rank } = await api.fetchMyRank(getFingerprint());
    $("result-rank").textContent = rank ? `第 ${rank} 名` : "—";
  } catch (e) {
    console.error(e);
  }
}

// ——————————— 排行榜 ———————————
function openLeaderboard() {
  showView("leaderboard");
  loadBoard();
}

async function loadBoard() {
  const body = $("board-body");
  const empty = $("board-empty");
  const loading = $("board-loading");

  body.innerHTML = "";
  empty.classList.add("hidden");
  empty.textContent = "还没有人作答，快来抢第一名。";
  loading.classList.remove("hidden");

  try {
    const list = await api.fetchLeaderboard(CONFIG.LEADERBOARD_LIMIT);
    loading.classList.add("hidden");

    if (!list.length) {
      empty.classList.remove("hidden");
      return;
    }

    const myFp = getFingerprint();
    list.forEach((e, i) => {
      const tr = document.createElement("tr");
      if (i < 3) tr.classList.add(`top-${i + 1}`);
      if (e.fingerprint && e.fingerprint === myFp) tr.classList.add("is-me");
      tr.innerHTML =
        `<td class="col-rank"><span class="rank-badge">${i + 1}</span></td>` +
        `<td class="col-name board-name">${escapeHtml(e.nickname)}</td>` +
        `<td class="col-score">${Number(e.correctCount)}</td>` +
        `<td class="col-time">${formatMs(e.durationMs)}</td>`;
      body.appendChild(tr);
    });
  } catch (e) {
    loading.classList.add("hidden");
    empty.textContent = "排行榜加载失败，请稍后再试。";
    empty.classList.remove("hidden");
    console.error(e);
  }
}

// ——————————— 初始化 ———————————
function init() {
  document.title = CONFIG.TITLE;
  $("home-title").textContent = CONFIG.TITLE;
  $("home-subtitle").textContent = CONFIG.SUBTITLE;
  $("home-motto").textContent = CONFIG.MOTTO;
  $("home-seal").textContent = CONFIG.TITLE[1] || CONFIG.TITLE[0] || "诗";
  $("site-footer").textContent = `${CONFIG.SUBTITLE} 出品 · ${CONFIG.TITLE}`;

  $("mode-hint").textContent = IS_LOCAL_MODE
    ? "本地模式：成绩仅保存在当前浏览器，接入服务器后即可全站共享（见 README）。"
    : "已连接服务器，成绩将进入全站排行榜。";

  $("btn-leaderboard").addEventListener("click", openLeaderboard);
  $("btn-view-board").addEventListener("click", openLeaderboard);
  $("btn-refresh").addEventListener("click", loadBoard);
  $("btn-next").addEventListener("click", goNext);
  $("btn-back-home").addEventListener("click", () => {
    showView("home");
    renderHome();
  });

  renderHome();
}

// 题库数量不足时给出明确提示，而不是静默出题异常
if (QUESTIONS.length < CONFIG.QUESTIONS_PER_ROUND) {
  console.error(
    `题库只有 ${QUESTIONS.length} 道，少于每局所需的 ${CONFIG.QUESTIONS_PER_ROUND} 道。`
  );
}

init();
