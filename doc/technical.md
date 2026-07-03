# Technical

## 1. 技术栈

《Crystal Swarm》当前版本用于复刻 TroisJS Physics Demo 1 的技术效果。项目使用 Vite 5 构建，核心代码为原生 JavaScript，3D 渲染使用 Three.js 0.180，物理使用 `cannon-es`。

渲染方式为全屏 WebGL：500 个球体使用 `THREE.InstancedMesh` 批量绘制，Cannon Sphere body 负责重力、碰撞和反弹，6 条静态挡板使用 Three Box + Cannon Box 对齐。相机控制使用 Three.js `OrbitControls`，手机端通过单指拖动旋转视角。

## 2. 目录结构

- `index.html`：页面根结构，包含开始页、游戏层、HUD、结算页和右下角 Aigram 水印。
- `src/main.js`：游戏主入口，负责 i18n、Three.js 场景、Cannon 世界、实例球体、手机输入、音频、主循环和 HUD。
- `src/styles.css`：浅色物理 demo 风格布局、HUD、卡片、按钮、提示和响应式样式。
- `public/poster.png`：游戏封面图，`meta.json` 的 `cover_url` 指向 `/poster.png`。
- `public/img/aigram.svg`：右下角平台水印，构建时复制到 `dist/img/aigram.svg`。
- `doc/requirements.md`：玩法与视觉需求文档。
- `doc/technical.md`：当前技术文档。
- `meta.json`：平台展示元信息。

## 3. 核心模块

状态管理集中在 `src/main.js`，`phase` 只区分 `start`、`playing`、`end`；当前技术验证版本主要使用开始态和物理演示态。`paletteIndex`、`dropBursts` 和 HUD 显示当前调色盘与喷球次数。

Three.js 场景包括浅色背景、PerspectiveCamera、OrbitControls、环境光、两盏 SpotLight、接收阴影的 15 × 15 平面、6 条倾斜挡板，以及 500 个 instanced sphere。Renderer 开启 shadowMap，像素比限制为 `Math.min(devicePixelRatio, 2)`。

Cannon 世界重力为 `(0, -9.82, 0)`，固定步长 1/60s，最多补 3 步。每个球体对应一个 Cannon Sphere body，质量为 `scale * 0.01`，线性阻尼 0.08，角阻尼 0.15。每帧 `world.step()` 后通过 `syncMeshes()` 把 body 的 position/quaternion 写回 InstancedMesh matrix。

挡板模块由 `addRamp()` 生成：Three BoxGeometry 尺寸为 3 × 0.05 × 0.2，Cannon Box halfExtents 为 1.5 × 0.025 × 0.1。6 条挡板的 x/y/rotation 和原 TroisJS Demo1 保持一致。

输入模块使用 pointer 事件：单指拖动由 OrbitControls 处理旋转；pointerup 时如果移动距离小于 10px 且按压时间小于 420ms，则调用 `spray(18)` 重置一批球体到上方；长按超过 420ms 后每 120ms 调用 `spray(10)` 连续喷球。键盘 Space 喷球，键盘 C 切换调色盘。

音频使用 Web Audio API 即时合成。`tone()` 创建 oscillator 和 gain，开始、喷球、长按 tick、换色、按钮点击分别映射到不同波形、频率和时长。音频上下文在首次用户手势后恢复，满足浏览器自动播放限制。

多语言为轻量自定义表，`detectLocale()` 优先读取 `localStorage.game_locale`，否则根据 `navigator.language` 判断 `zh` 或 `en`。`data-i18n` 元素在启动时统一替换文本。

## 4. 扩展点

改物理效果主要调整 `src/main.js` 顶部的 `COUNT`、`world.gravity`、Cannon contact material、Sphere body damping、`resetBody()` 的重置高度和速度。

改原版 demo 结构主要调整 `addRamp()` 中的挡板数量、尺寸、位置、旋转角度和材质。

改手机操作主要调整 `onPointerDown()`、`onPointerUp()` 中的点击距离阈值 10px、长按阈值 420ms、连续喷球间隔 120ms，以及 `spray()` 的球体数量。

换视觉风格主要改 `src/styles.css`、Three 灯光、`paletteSets`、`MeshToonMaterial`/`MeshPhongMaterial` 和 renderer 背景色。当前版本刻意接近 TroisJS Physics Demo 1 的白底、彩球、阴影、挡板风格。

加正式玩法时，可以在 `spray()`、`syncMeshes()` 或 Cannon collision event 上接入计分、目标、失败条件和排行榜；当前版本先不做规则，只验证原版物理技术栈效果。
