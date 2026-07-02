# Technical

## 1. 技术栈

《Crystal Swarm》使用 Vite 5 构建，核心代码为原生 JavaScript，3D 渲染使用 Three.js 0.180。项目通过 `npm run build` 输出 `dist/`，`vite.config.js` 设置 `base: './'`，可以部署到任意子路径。

渲染方式为全屏 WebGL：900 个水晶使用 `THREE.InstancedMesh` 批量绘制，光晕使用自定义 `ShaderMaterial` 点精灵，目标环和引力核心使用 Three.js 几何体生成。UI、HUD、开始页和结算页使用普通 DOM + CSS 覆盖在 canvas 上。

## 2. 目录结构

- `index.html`：页面根结构，包含开始页、游戏层、HUD、结算页和右下角 Aigram 水印。
- `src/main.js`：游戏主入口，负责 i18n、Three.js 场景、游戏状态、输入、音频、主循环和结算。
- `src/styles.css`：全屏布局、HUD、卡片、按钮、提示、combo 动效和响应式样式。
- `public/poster.svg`：游戏封面图。
- `public/img/aigram.svg`：右下角平台水印，构建时复制到 `dist/img/aigram.svg`。
- `doc/requirements.md`：玩法与视觉需求文档。
- `doc/technical.md`：当前技术文档。
- `meta.json`：平台展示元信息，标题为 `Crystal Swarm`，封面为 `/poster.svg`。

## 3. 核心模块

状态管理集中在 `src/main.js`，通过 `phase` 表示开始、游戏中、结束三态；`score`、`best`、`roundStart`、`litCount` 和 `maxCombo` 管理分数、最高分、倒计时、已点亮能量环和连击。最高分写入 `localStorage` 的 `crystal_swarm_best`。

主循环由 `requestAnimationFrame(render)` 驱动。每帧执行 `updateGame()` 更新倒计时，`updateSwarm()` 更新 900 个水晶的位置、速度和实例矩阵，`updateRings()` 统计目标环半径 0.62 内的水晶数量并计算充能。只有分数、倒计时、combo、屏幕状态等低频 UI 值写 DOM，高频物理量保留在 Three.js 对象和数组中。

屏幕适配在 `resize()` 中处理，renderer 使用舞台元素的 clientWidth/clientHeight，像素比限制为 `Math.min(devicePixelRatio, 2)`。相机 FOV 为 45，z 位置为 5.4，竖屏和桌面窗口都以同一 3D 世界坐标渲染。

输入模块使用 `pointerdown`、`pointermove`、`pointerup` 和 Space 键。指针通过 `Raycaster` 投影到 z=0 的平面，得到 `targetGravityPoint`；按住时 `attraction` 接近 1，松开后逐帧衰减。`pointermove` 只更新向量，不创建音频节点或新对象。

碰撞与得分不是刚体物理，而是半径统计：每个目标环统计范围内水晶数量，数量达到 58 并持续累计到 1.05 秒后点亮。密度得分每 250ms 计算一次，避免每帧改 DOM。

音频使用 Web Audio API 即时合成。`tone()` 创建 oscillator 和 gain，开始、按下、充能完成、全完成、失败、按钮点击分别映射到不同波形、频率和时长。音频上下文在首次用户手势后恢复，满足浏览器自动播放限制。

多语言为轻量自定义表，`detectLocale()` 优先读取 `localStorage.game_locale`，否则根据 `navigator.language` 判断 `zh` 或 `en`。`data-i18n` 元素在启动时统一替换文本。

## 4. 扩展点

改玩法主要调整 `src/main.js` 顶部的 `ROUND_MS`、`COUNT`、`TARGETS`，以及 `updateRings()` 中的半径 0.62、数量阈值 58、充能时长 1.05 秒和得分规则。

换视觉素材主要改 `src/main.js` 中的几何体、材质、灯光、`palette` 和 shader 参数；如果需要贴图资源，放入 `src/` 后用 import 引入，或放入 `public/` 后使用相对路径引用。

调 UI 数值主要改 `src/styles.css`，包括 `.cs-hud`、`.cs-card`、`.cs-hint`、`.cs-combo` 和响应式媒体查询。按钮文案和可见文本改 `messages.zh` / `messages.en`，不要在 HTML 中硬编码新文本。

加后端或平台能力时，可以在 `startGame()`、`endGame()`、`addScore()` 附近接入统计、排行榜或存档。当前版本没有远程 API；如需平台持久化，应先引入项目 runtime，并保持本地状态镜像作为读写源，避免直接用一次性加载的云端数据做 read-modify-write。
