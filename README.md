# 趣味诗词竞赛

> 国学社 · 古文化协会 联合出品

一个用来「了解中国古诗词」的答题小游戏。从 50 道题库中随机抽 10 道，答完一道立即判定，最后按得分排名，同分比用时。

- 纯静态网页，**无需服务器、无需构建**，一条命令就能本地运行，一个链接就能分享
- 手机优先设计，可直接在微信内打开
- 无后端也能玩（成绩存本地），接上后端即变成全站共享排行榜
- 一个人只能作答一次

---

## 一、本地运行

本项目使用 ES Modules，**不能直接双击 `index.html` 打开**（浏览器会因 `file://` 协议拒绝加载模块）。请用任意静态服务器启动：

```bash
# 方式一：Python（本机装了 Python 即可）
python -m http.server 8080
# 然后浏览器访问 http://localhost:8080

# 方式二：VS Code 安装 "Live Server" 插件，右键 index.html → Open with Live Server
```

---

## 二、部署到 GitHub Pages（推荐）

1. 把本项目推到一个 GitHub 仓库（公开仓库免费）。
2. 仓库 → **Settings → Pages**。
3. **Source** 选 `Deploy from a branch`，**Branch** 选 `main` 和 `/ (root)`，保存。
4. 等一两分钟，访问 `https://<你的用户名>.github.io/<仓库名>/` 即可。

分享这个链接给同学就能直接玩了。手机浏览器可「添加到主屏幕」，体验接近 App。

---

## 三、接入后端（可选，用于全站共享排行榜）

不配置后端时，游戏使用**本地模式**：成绩只存在访问者自己浏览器的 localStorage 里，功能完整，方便先跑通流程。要让所有人看到同一份排行榜，接一个免费的 [Supabase](https://supabase.com) 即可，**不需要写、不需要运维任何服务器**：

1. 注册 Supabase，新建一个项目（免费额度足够社团活动使用）。
2. 左侧 **SQL Editor** → 新建查询 → 粘贴 [`sql/schema.sql`](sql/schema.sql) 全部内容 → **Run**。
3. 左侧 **Project Settings → API**，复制两个值：
   - `Project URL`
   - `anon` `public` key
4. 打开 [`js/config.js`](js/config.js)，填入：

   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",
   ```

5. 重新部署（推送到 GitHub）即可。首页底部会从「本地模式」变为「已连接服务器」。

> **关于 anon key 会不会泄露：**
> `anon` key 是 Supabase 设计上就公开的密钥，专门用于浏览器端。它的权限由数据库的**行级安全策略（RLS）**决定 —— 本项目只开放了「读取全部 + 插入一条」，没有开放修改和删除。所以把 anon key 放进公开仓库是安全的，`service_role` key 才需要保密（本项目用不到）。

---

## 四、常见修改

| 想改什么 | 改哪里 |
| --- | --- |
| 标题、副标题、首页诗句 | [`js/config.js`](js/config.js) 的 `TITLE` / `SUBTITLE` / `MOTTO` |
| 每局抽几道题 | `js/config.js` 的 `QUESTIONS_PER_ROUND` |
| 整局限时（秒，0 = 不限时） | `js/config.js` 的 `TIME_LIMIT_SECONDS` |
| 题库内容（50 道） | [`js/questions.js`](js/questions.js) |
| 配色、字体、样式 | [`css/style.css`](css/style.css) 顶部的 `:root` 变量 |

**改题目的注意事项**（`js/questions.js`）：

```js
{
  id: 1,
  q: "题干……",
  options: ["选项一", "选项二", "选项三", "选项四"],
  answer: 1,   // 0=A  1=B  2=C  3=D
}
```

`answer` 用的是**下标**：`0` 代表 A，`1` 代表 B，依此类推。如果你调整了 `options` 的顺序，记得同步改 `answer`。

> 题库原始答案里有 28 道正确答案都是 B、且没有一道是 D，所以程序默认会**打乱每道题的选项顺序**（`config.js` 里的 `SHUFFLE_OPTIONS`），判定基于打乱后的位置，不影响正确性。**建议保持开启**，否则等于送分。

---

## 五、玩法规则

- 从 50 道题库中随机抽取 10 道，每题四个选项顺序随机。
- 答完一道立即判定并显示正确答案，然后进入下一题。
- 记录**答对题数**与**总用时**。
- 排行榜排序：**得分高者靠前；得分相同，用时短者靠前**。
- 一个人只能提交一次成绩。

---

## 六、已知限制

这些是「匿名昵称 + 本地指纹」这个最简方案的固有取舍，对社团活动规模而言可以接受，但需要知情：

1. **防刷能力有限**：指纹是首次访问时生成、存在浏览器本地的一个随机 ID。清空浏览器数据、换浏览器或换设备，即可再答一次。
2. **成绩由浏览器上报**：技术上有人可以伪造请求直接提交满分。数据库的唯一约束能防止同一个人重复提交，但拦不住刻意造假的人。

如果需要更强的公正性，可以进一步：
- 把「出题 + 判分」搬到后端（Supabase 的 Edge Function 或 Postgres 函数），浏览器只提交作答记录，由服务端算分；
- 增加管理员审核 / 实名报名制。

欢迎在 Issue 里讨论。

---

## 七、贡献

两个社团的同学都欢迎参与：

- 想**加题 / 改题**：编辑 `js/questions.js` 后提 Pull Request，注意同步核对 `answer`。
- 想**改文案或样式**：`js/config.js` 与 `css/style.css`，改完本地起服务看一眼即可。
- 发现 Bug 或有建议：提 Issue。

提交前请本地 `python -m http.server` 跑一遍，确认能完整答完 10 道题、成绩与排行榜正常。

---

## 目录结构

```
index.html        入口页（含首页 / 答题 / 成绩 / 排行榜四个视图）
css/style.css     水墨古风样式
js/config.js      配置：标题、署名、题量、限时、后端地址
js/questions.js   题库（50 道）
js/storage.js     本地指纹与"已作答"标记
js/api.js         后端适配层（Supabase / 本地两种实现）
js/app.js         主逻辑：抽题、判定、计时、提交、排行榜
sql/schema.sql    Supabase 建表脚本
```
