# Technical

## 1. 技术栈

- 构建：Vite 5，`base: './'`，产物可部署到任意子路径。
- 语言：Vanilla JavaScript ES Module。
- 渲染：Three.js WebGLRenderer、InstancedMesh、MeshPhysicalMaterial、Points、TorusGeometry、CircleGeometry、EffectComposer。
- 后处理：`RenderPass`、`UnrealBloomPass`、`ShaderPass(FXAAShader)`、`OutputPass`。
- 输入：Pointer Events、Keyboard Events、OrbitControls。
- 存储：`localStorage.crystal_swarm_best` 保存最高分。
- 音频：Web Audio API 实时合成。

## 2. 目录结构

- `index.html`：游戏根 DOM、HUD、开始/游戏/结算三态容器、UUID meta、Aigram 水印。
- `src/main.js`：Three.js 场景、实例群体模拟、目标光圈、计时计分、触控目标投射、后处理、i18n、音频和状态切换。
- `src/styles.css`：深色舞台、HUD、玻璃卡片、combo 徽章、提示、按钮和桌面 390px × 680px 容器。
- `public/img/aigram.svg`：右下角单色平台水印。
- `doc/requirements.md`：玩法和视觉需求。
- `doc/technical.md`：当前实现说明。
- `meta.json`：平台标题和封面图路径。

## 3. 核心模块

- 状态管理与主循环：`phase` 控制 start/playing/end 三态；`requestAnimationFrame(render)` 每帧计算 dt，执行 `animate(dt)`、`controls.update()` 和 `composer.render()`。
- 屏幕适配：`resize()` 根据 `stage.clientWidth/clientHeight` 更新 renderer、composer、FXAA resolution 和 camera aspect；CSS 在桌面端固定 390px × 680px，移动端全屏。
- 群体运动：`instances` 保存 2000 个对象的 position、velocity、scale、attraction、vlimit；每帧朝 target 加速、限速、更新矩阵和光点 attribute。
- 目标投射：`projectPointer()` 使用 `Raycaster` 和 z=0 `Plane` 把触摸坐标转换为 3D targetGoal；按住时 target lerp 更快，松手后变慢。
- 目标光圈：`targetGroups` 保存 3 个 Three.js Group，每组包含 additive torus ring 和 circle fill；`placeTarget()` 负责随机摆放并避免目标过近。
- 点亮规则：`animate(dt)` 在实例循环中统计每个光圈半径 28 内的 x/y 平面晶体数量；`updateTargets()` 根据 80 个晶体、1.2 秒保持时间更新进度，点亮后加分、增加 combo 并迁移目标。
- 计时与结算：`remaining` 从 45 秒递减；`endGame()` 写入最终分数、最高分、点亮数和最高 combo，并更新 `localStorage.crystal_swarm_best`。
- 材质与后处理：主 mesh 使用 `MeshPhysicalMaterial` 的透明、厚度、传输和自发光参数；额外 Points 提供 additive 光点；Bloom pass 强化边缘辉光。
- 手指光源：`lightCore` 是跟随 target 的 Three.js Group，包含中心 sprite、外层 halo sprite 和近距离白色 point light；`animate()` 根据 `pointerActive` 动态调整 sprite 尺寸、主光强度和距离。
- 色盘系统：`colorPairs` 保存 6 组双色；`updateColors()` 为 2000 个实例和光点重新插值颜色；双击或 C 键调用 `randomColors()`。
- 音频：`tone()` 封装 OscillatorNode 和 GainNode；开始、换色、点亮和结算各有短音效，音频解锁在用户手势后执行。
- 多语言：`messages` 提供 zh/en 文案；`detectLocale()` 优先读取 `localStorage.game_locale`，再根据浏览器语言判断。

## 4. 扩展点

- 改群体数量：修改 `src/main.js` 顶部 `COUNT`，同时留意移动端性能和 HUD 数字。
- 调点亮难度：修改 `TARGET_RADIUS`、`TARGET_THRESHOLD`、`TARGET_HOLD_SECONDS` 和 `placeTarget()` 的随机范围。
- 调分数：修改 `updateTargets()` 中的 `100 + combo * 25` 公式。
- 调材质效果：修改 `MeshPhysicalMaterial` 的 `transmission`、`thickness`、`opacity`、`emissiveIntensity` 和 Bloom pass 参数。
- 换运动手感：调整实例初始化的 `attraction`、`vlimit`，以及 `animate()` 中按住时的 2.8 倍吸引强度。
- 换色盘：修改 `colorPairs` 数组；每组为两个 CSS hex 色，运行时随机插值。
- 加平台接口：在 `endGame()` 接入 leaderboard/save；保留 `meta name="game-uuid"` 不变。
