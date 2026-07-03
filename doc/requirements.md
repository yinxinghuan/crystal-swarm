# Requirements

## 1. Overview

《Crystal Swarm》是一款参考 TroisJS Sub Surface Scattering Material demo 的 3D 感官玩具：2000 个发光十二面体在空间中被手指引力牵引，玩家通过拖动光源观察半透明材质、群体运动和 bloom 光晕。

## 2. Visual Design

- 画面为竖屏全屏 3D 舞台，设计基准 390px × 680px，桌面端容器固定为 390px × 680px，圆角 24px。
- 背景为深色材质实验室：主色 `#05030f`，底部渐变到 `#101837`，中心叠加 `rgba(255,96,160,0.18)` 径向光。
- 主体为 2000 个 `DodecahedronGeometry(5, 0)` 实例，随机分布在 x/y/z 均为 -100 到 100 的 200 world units 立方空间。
- 每个实例缩放为 0.2 到 1.0，材质使用 `MeshPhysicalMaterial`，`roughness=0.18`、`metalness=0.02`、`transmission=0.34`、`thickness=7`、`opacity=0.86`、`emissiveIntensity=0.5`。
- 颜色使用实例顶点色，默认从 `#dd3e1b` 到 `#0b509c` 随机插值；可循环切换 6 组双色调色盘。
- 同步渲染 2000 个 additive `Points` 光点，点大小 1.6，透明度 0.42，用来增强晶体边缘辉光。
- 后处理使用 `EffectComposer`：`RenderPass`、`UnrealBloomPass(strength=0.72, radius=0.55, threshold=0.12)`、`FXAAPass` 和 `OutputPass`。
- 相机为 45° 透视相机，初始位置 `(0,0,200)`，近远裁剪面 0.1 到 1000，OrbitControls 启用阻尼 0.05，距离限制 95 到 290。
- 光源为跟随手指目标的 `PointLight(#ffc0c0, intensity=4.2, distance=520)`，并叠加 `AmbientLight(#1d2748, intensity=0.65)`。
- HUD 顶部显示晶体数量 2000 和当前色盘序号，字号分别为 12px 与 30px；底部提示字号 11px、字距 0.18em，不遮挡中央群体。
- 素材清单：`public/img/aigram.svg` 作为右下角 52px 水印；其余视觉由 Three.js 几何、材质、灯光和后处理生成。

## 3. Game Mechanics

- 初始创建 2000 个实例，每个实例包含 position、velocity、scale、attraction、vlimit 五个数值。
- position 初始值为 `THREE.MathUtils.randFloatSpread(200)`，velocity 初始值为 `randFloatSpread(2)`。
- attraction 为 `0.0025 + random(0, 0.01)`，vlimit 为 `0.3 + random(0, 0.2)`。
- 每帧将屏幕触摸点通过 raycaster 投射到 z=0 平面，得到目标点 targetGoal；实际 target 使用 `lerp` 追随，按住时 lerp 系数 0.16，松开时 0.035。
- 每帧每个实例计算 `target - position` 的归一化方向，乘以 attraction；按住时吸引强度乘以 2.8。
- velocity 使用 `clampScalar(-vlimit, vlimit)` 限速，position 每帧加 velocity。
- 每个实例朝 `position + velocity` 方向 lookAt，使十二面体有随运动翻转的方向感。
- 光点位置与实例位置逐帧同步；实例矩阵与光点 position attribute 每帧标记 `needsUpdate`。
- 双击或按 C 切换色盘；切换色盘时为 2000 个实例重新随机插值颜色，并同步更新光点颜色。
- 当前版本不做关卡、碰撞、计时胜负，目标是验证原版 SubSurface/Bloom 技术效果和移动端触控手感。

## 4. Controls

- 开始按钮：使用 `pointerdown` 进入场景并解锁 Web Audio。
- 单指按住：开启引力，隐藏提示文字，停止自动旋转。
- 单指拖动：更新目标点，让 2000 个晶体被手指牵引。
- 松手：停止强引力，目标点缓慢回落为普通吸引。
- 快速双击：间隔小于 280ms 时切换色盘。
- 拖动空白区域仍由 OrbitControls 接管相机旋转；键盘 Space 开始/按住吸引，键盘 C 切换色盘。
- 所有游戏动作使用 pointer 事件，不同时绑定 mouse 与 touch。

## 5. Win / Lose Conditions

- 当前版本没有胜利或失败条件，只保留开始页、体验中、返回开始页三个状态。
- 开始页展示一句操作说明和开始按钮；体验中显示 HUD 与底部提示；结束卡仅作为返回/再来一次入口保留。
- 结算卡显示固定晶体数量 2000、最高记录、本次色盘序号和“材质试验”标签，不作为分数目标。
- 历史最高使用 `localStorage` 键 `crystal_swarm_best` 读取，当前版本不主动累计分数。

## 6. Sound Effects

- 开始：sine 波 330Hz 到 660Hz，持续 0.18s，音量 0.045。
- 换色：三枚 sine 波 392Hz、523Hz、784Hz，各 0.09s，间隔 0.04s，音量 0.026。
- 音效使用 Web Audio 实时合成，不加载外部音频文件。
- 浏览器限制音频时静默失败，视觉体验不受影响。
