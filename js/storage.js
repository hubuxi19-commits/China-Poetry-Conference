// ============================================================
//  本地存储：浏览器指纹 + "已作答"标记
//  指纹用于实现"每个账号只能答一次"，配合数据库的唯一约束双保险。
// ============================================================

const KEY_FP = "gsq_fingerprint";
const KEY_DONE = "gsq_record";

// localStorage 在隐私模式下可能不可用，退化为内存存储，保证不崩。
const mem = {};
function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return mem[key] ?? null;
  }
}
function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    mem[key] = value;
  }
}

// 简易哈希（djb2），把浏览器特征压成一个短字符串
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// 首次访问时生成一个稳定的随机 ID，之后一直不变。
function getStableId() {
  let id = safeGet(KEY_FP);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    safeSet(KEY_FP, id);
  }
  return id;
}

/**
 * 浏览器指纹 = 首次访问时生成、之后一直保存的稳定随机 ID。
 *
 * 刻意不掺入 UA / 屏幕尺寸 / 时区等环境特征：它们既不能真正防刷
 * （用户清缓存时这些特征和随机 ID 会一起消失），又会在浏览器升级、
 * 手机横竖屏切换时改变，导致同一个人被判成两个人、绕过"只能答一次"。
 * 清缓存/换浏览器仍可重置——这是该方案的固有代价，详见 README。
 */
export function getFingerprint() {
  return "fp_" + hash(getStableId());
}

/** 本浏览器是否已经作答过 */
export function hasPlayed() {
  return Boolean(safeGet(KEY_DONE));
}

/** 读取本浏览器已提交的成绩记录，未作答返回 null */
export function getMyRecord() {
  const raw = safeGet(KEY_DONE);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** 标记为已作答，并记住本次成绩 */
export function markPlayed(record) {
  safeSet(KEY_DONE, JSON.stringify(record));
}

// ——— 待补交队列 ———
// 上传失败的成绩存这里，等网络恢复（重新打开页面 / 联网事件）自动重试。
// 海外后端在部分国内网络下会连不上，用户不该因此丢成绩。
const KEY_PENDING = "gsq_pending";

export function getPending() {
  const raw = safeGet(KEY_PENDING);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setPending(record) {
  safeSet(KEY_PENDING, JSON.stringify(record));
}

export function clearPending() {
  try {
    localStorage.removeItem(KEY_PENDING);
  } catch {
    delete mem[KEY_PENDING];
  }
}

/** 清除本地作答标记（仅用于测试，界面不提供入口） */
export function clearPlayed() {
  try {
    localStorage.removeItem(KEY_DONE);
  } catch {
    delete mem[KEY_DONE];
  }
}
