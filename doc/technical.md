# Technical

## 1. 技术栈

- 构建：Vite 5，`base: './'`，产物可部署到任意子路径。
- 语言：Vanilla JavaScript ES Module。
- 渲染：Three.js WebGLRenderer、InstancedMesh、MeshPhysicalMaterial、Points、EffectComposer。
- 后处理：`RenderPass`、`UnrealBloomPass`、`ShaderPass(FXAAShader)`、`OutputPass`。
- 输入：Pointer Events、Keyboard Events、OrbitControls。
- 音频：Web Audio API 实时合成。

## 2. 目录结构

- `index.html`：游戏根 DOM、HUD、开始/体验/结算三态容器、UUID meta、Aigram 水印。
- `src/main.js`：Three.js 场景、实例群体模拟、触控目标投射、后处理、i18n、音频和状态切换。
- `src/styles.css`：深色舞台、HUD、玻璃卡片、提示、按钮和桌面 390px × 680px 容器。
- `public/img/aigram.svg`：右下角平台水印。
- `doc/requirements.md`：玩法和视觉需求。
- `doc/technical.md`：当前实现说明。
- `meta.json`：平台标题和封面图路径。

## 3. 核心模块

- 状态管理与主循环：`phase` 控制 start/playing/end 三态；`requestAnimationFrame(render)` 每帧执行 `animate()`、`controls.update()` 和 `composer.render()`。
- 屏幕适配：`resize()` 根据 `stage.clientWidth/clientHeight` 更新 renderer、composer、FXAA resolution 和 camera aspect；CSS 在桌面端固定 390px × 680px，移动端全屏。
- 群体运动：`instances` 保存 2000 个对象的 position、velocity、scale、attraction、vlimit；每帧朝 target 加速、限速、更新矩阵和光点 attribute。
- 目标投射：`projectPointer()` 使用 `Raycaster` 和 z=0 `Plane` 把触摸坐标转换为 3D targetGoal；按住时 target lerp 更快，松手后变慢。
- 材质与后处理：主 mesh 使用 `MeshPhysicalMaterial` 的透明、厚度、传输和自发光参数；额外 Points 提供 additive 光点；Bloom pass 强化边缘辉光。
- 手指光源：`lightCore` 是一个跟随 target 的 Three.js Group，包含中心 sprite、外层 halo sprite 和近距离白色 point light；`animate()` 根据 `pointerActive` 动态调整 sprite 尺寸、主光强度和距离。
- 色盘系统：`colorPairs` 保存 6 组双色；`updateColors()` 为 2000 个实例和光点重新插值颜色；双击或 C 键调用 `randomColors()`。
- 音频：`tone()` 封装 OscillatorNode 和 GainNode；开始与换色各有短音效，音频解锁在用户手势后执行。
- 多语言：`messages` 提供 zh/en 文案；`detectLocale()` 优先读取 `localStorage.game_locale`，再根据浏览器语言判断。

## 4. 扩展点

- 改群体数量：修改 `src/main.js` 顶部 `COUNT`，同时留意移动端性能和 HUD 数字。
- 调材质效果：修改 `MeshPhysicalMaterial` 的 `transmission`、`thickness`、`opacity`、`emissiveIntensity` 和 Bloom pass 参数。
- 换运动手感：调整实例初始化的 `attraction`、`vlimit`，以及 `animate()` 中按住时的 2.8 倍吸引强度。
- 换色盘：修改 `colorPairs` 数组；每组为两个 CSS hex 色，运行时随机插值。
- 加玩法目标：可在 `animate()` 中增加目标区域命中检测，或在 pointer 交互里累计分数；不要把高频实例状态放进 React/DOM state。
- 加平台接口：在当前 `startGame()`、`randomColors()` 或未来结算逻辑中接入 runtime；保留 `meta name="game-uuid"` 不变。
