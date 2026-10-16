// ============================================================
//  全站配置：改标题、署名、题量、后端地址，都在这个文件里。
// ============================================================

export const CONFIG = {
  // —— 标题与署名 ——
  TITLE: "趣味诗词竞赛",
  SUBTITLE: "国学社 · 古文化协会",
  // 首页挂着的一句诗
  MOTTO: "海内存知己，天涯若比邻。",

  // —— 玩法 ——
  QUESTIONS_PER_ROUND: 10, // 每局抽多少道题
  TIME_LIMIT_SECONDS: 0, // 整局时限（秒），0 表示不限时
  SHUFFLE_OPTIONS: true, // 是否打乱每题选项顺序（题库答案严重偏向 B，强烈建议保持 true）

  // —— 后端（Supabase）——
  // 留空则自动使用「本地模式」：成绩存在浏览器本地，功能完整但不跨设备共享。
  // 填写方法见 README.md。这个 key 是设计上公开的，由数据库权限策略保护，放仓库里不算泄露。
  // 两种叫法都行：旧版 anon key（eyJ 开头）或新版 publishable key（sb_publishable_ 开头）。
  SUPABASE_URL: "https://ucwwxayqtgjhyrcseqch.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_Lpw2j6wPUiUHJelipbRbYw_8ESKXge_",

  // 排行榜最多展示多少条
  LEADERBOARD_LIMIT: 100,
};

// 是否已接入真实后端
export const HAS_BACKEND = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
