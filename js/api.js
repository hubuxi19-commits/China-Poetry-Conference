// ============================================================
//  后端适配层：对上层只暴露三个方法
//    submitScore({ nickname, fingerprint, correctCount, totalQuestions, durationMs })
//    fetchLeaderboard(limit)
//    fetchMyRank(fingerprint)
//  按 config 决定用 Supabase 还是本地存储，切换后端只改这一个文件。
// ============================================================

import { CONFIG, HAS_BACKEND } from "./config.js";

// 分数优先，同分比时间。注意 PostgREST 的排序语法是「字段.方向」，不是 SQL 的「字段 方向」。
const ORDER_PARAM = "correct_count.desc,duration_ms.asc";

// ——————————————————————————————————————————————
//  Supabase 实现（REST API，无需引入 SDK）
// ——————————————————————————————————————————————
function supabaseHeaders(extra = {}) {
  return {
    apikey: CONFIG.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function normalize(row) {
  return {
    nickname: row.nickname,
    correctCount: row.correct_count,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
    fingerprint: row.fingerprint,
  };
}

const SupabaseAdapter = {
  async submitScore(payload) {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/scores`, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({
        nickname: payload.nickname,
        fingerprint: payload.fingerprint,
        correct_count: payload.correctCount,
        total_questions: payload.totalQuestions,
        duration_ms: payload.durationMs,
      }),
    });

    // 409 = 指纹唯一约束冲突，说明这个浏览器已经答过
    if (res.status === 409) return { ok: false, duplicate: true };
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`提交成绩失败（${res.status}）：${detail}`);
    }
    return { ok: true, duplicate: false };
  },

  async fetchLeaderboard(limit) {
    const url =
      `${CONFIG.SUPABASE_URL}/rest/v1/scores` +
      `?select=*&order=${encodeURIComponent(ORDER_PARAM)}&limit=${limit}`;
    const res = await fetch(url, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(`读取排行榜失败（${res.status}）`);
    const rows = await res.json();
    return rows.map(normalize);
  },

  async fetchMyRank(fingerprint) {
    const url =
      `${CONFIG.SUPABASE_URL}/rest/v1/scores?select=*&fingerprint=eq.` +
      encodeURIComponent(fingerprint);
    const res = await fetch(url, { headers: supabaseHeaders() });
    if (!res.ok) return { rank: null, entry: null };
    const rows = await res.json();
    if (!rows.length) return { rank: null, entry: null };

    // 名次 = 排在本人前面的记录数 + 1（分数更高，或同分但更快）
    const me = normalize(rows[0]);
    const before =
      `${CONFIG.SUPABASE_URL}/rest/v1/scores?select=id&or=` +
      `(correct_count.gt.${me.correctCount},and(correct_count.eq.${me.correctCount},duration_ms.lt.${me.durationMs}))`;
    const beforeRes = await fetch(before, { headers: supabaseHeaders() });
    const others = beforeRes.ok ? await beforeRes.json() : [];
    return { rank: others.length + 1, entry: me };
  },
};

// ——————————————————————————————————————————————
//  本地实现（localStorage，无需后端，用于即时试玩与离线）
// ——————————————————————————————————————————————
const KEY_LOCAL_BOARD = "gsq_local_board";

function readBoard() {
  try {
    return JSON.parse(localStorage.getItem(KEY_LOCAL_BOARD) || "[]");
  } catch {
    return [];
  }
}
function writeBoard(list) {
  try {
    localStorage.setItem(KEY_LOCAL_BOARD, JSON.stringify(list));
  } catch {
    /* 隐私模式下静默失败 */
  }
}
function sortBoard(list) {
  return [...list].sort(
    (a, b) => b.correctCount - a.correctCount || a.durationMs - b.durationMs
  );
}

const LocalAdapter = {
  async submitScore(payload) {
    const list = readBoard();
    if (list.some((e) => e.fingerprint === payload.fingerprint)) {
      return { ok: false, duplicate: true };
    }
    list.push({
      nickname: payload.nickname,
      fingerprint: payload.fingerprint,
      correctCount: payload.correctCount,
      durationMs: payload.durationMs,
      createdAt: new Date().toISOString(),
    });
    writeBoard(list);
    return { ok: true, duplicate: false };
  },

  async fetchLeaderboard(limit) {
    return sortBoard(readBoard()).slice(0, limit);
  },

  async fetchMyRank(fingerprint) {
    const sorted = sortBoard(readBoard());
    const idx = sorted.findIndex((e) => e.fingerprint === fingerprint);
    if (idx === -1) return { rank: null, entry: null };
    return { rank: idx + 1, entry: sorted[idx] };
  },
};

export const api = HAS_BACKEND ? SupabaseAdapter : LocalAdapter;
export const IS_LOCAL_MODE = !HAS_BACKEND;
