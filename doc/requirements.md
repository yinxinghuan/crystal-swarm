# Requirements

## 1. Overview

《Crystal Swarm》是一款 45 秒 3D 引光收束小游戏：玩家拖动手指光源牵引 2000 个发光十二面体，把足够多的晶体聚入目标光圈并连续点亮得分。

## 2. Visual Design

- 画面为竖屏全屏 3D 舞台，设计基准 390px × 680px，桌面端容器固定为 390px × 680px，圆角 24px。
- 背景为深色材质实验室：主色 `#05030f`，底部渐变到 `#101837`，中心叠加 `rgba(255,96,160,0.18)` 径向光。
- 主体为 2000 个 `DodecahedronGeometry(5, 0)` 实例，随机分布在 x/y/z 均约 -115 到 115 的 230 world units 立方空间。
- 每个实例缩放为 0.2 到 1.0，材质使用半透明 `MeshPhysicalMaterial`，`roughness=0.28`、`metalness=0.02`、`transmission=0.12`、`thickness=5`、`opacity=0.92`、`emissiveIntensity=0.22`。
- 颜色使用实例顶点色，默认从 `#dd3e1b` 到 `#0b509c` 随机插值；可循环切换 6 组双色调色盘。
- 同步渲染 2000 个 additive `Points` 光点，点大小 2.1，透明度 0.66，用来增强晶体边缘辉光。
- 后处理使用 `EffectComposer`：`RenderPass`、`UnrealBloomPass(strength=1.05, radius=0.68, threshold=0.08)`、`FXAAPass` 和 `OutputPass`。
- 相机为 45° 透视相机，初始位置 `(0,0,220)`，近远裁剪面 0.1 到 1000，OrbitControls 启用阻尼 0.05，距离限制 110 到 310。
- 光源为跟随手指目标的 `PointLight(#ffc0c0)` 和近距离白色 `PointLight(#ffffff)`；松手时主光强约 8.2、距离约 540，按住时主光强约 12.5、距离约 620，近距离白光强度约 3.4。
- 手指/光标目标点有轻量可见光核：中心 additive sprite 约 11 world units，外层 halo sprite 约 36 world units，按住时整体放大到 1.05 倍，并以 0.006/ms 的正弦节奏轻微脉动。
- 场上同时显示 3 个目标光圈，每个光圈半径 28 world units，线宽约 1.2 world units，使用 `#7cf6ff`、`#ff74d4`、`#fff4a8` 三色 additive 发光，进度越高光圈越亮。
- HUD 顶部左侧显示剩余秒数，右侧显示得分，字号分别为 12px 标签和 30px 数字；底部提示使用“Gather rings · Double tap color / 收束光圈 · 双击换色”，字号 11px、字距 0.18em，不遮挡中央群体。
- 右下角使用 `public/img/aigram.svg` 新版 AlterU 单色竖向 mark，宽 28px，透明度 0.72；其余视觉由 Three.js 几何、材质、灯光和后处理生成。

## 3. Game Mechanics

- 每局时长 45 秒；开始后倒计时每帧减少，归零后进入结算。
- 初始创建 2000 个实例，每个实例包含 position、velocity、scale、attraction、vlimit 五个数值。
- position 初始值为 `THREE.MathUtils.randFloatSpread(230)`，velocity 初始值为 `randFloatSpread(2)`。
- attraction 为 `0.0025 + random(0, 0.01)`，vlimit 为 `0.3 + random(0, 0.2)`。
- 每帧将屏幕触摸点通过 raycaster 投射到 z=0 平面，得到目标点 targetGoal；实际 target 使用 `lerp` 追随，按住时 lerp 系数 0.16，松开时 0.035。
- 每帧每个实例计算 `target - position` 的归一化方向，乘以 attraction；按住时吸引强度乘以 2.8。
- velocity 使用 `clampScalar(-vlimit, vlimit)` 限速，position 每帧加 velocity。
- 每帧统计每个目标光圈内的晶体数量，判定使用 x/y 平面距离，半径为 28 world units。
- 单个光圈内晶体数量达到 80 个时开始积累点亮进度，连续保持 1.2 秒即点亮；低于 80 个时进度按 0.55 倍速度回退到 0。
- 点亮一个光圈获得 `100 + combo * 25` 分，combo 增加 1，已点亮数量增加 1；该光圈立即迁移到新的随机位置。
- 随机目标位置 x/y 为 -78 到 78 world units，z=0；新位置与另外两个目标的 x/y 距离必须大于 42 world units，最多尝试 12 次。
- 双击或按 C 切换色盘；切换色盘时为 2000 个实例重新随机插值颜色，并同步更新光点颜色。
- 最高分使用 `localStorage` 键 `crystal_swarm_best` 保存。

## 4. Controls

- 开始按钮：使用 `pointerdown` 进入 45 秒游戏并解锁 Web Audio。
- 单指按住：开启引力，隐藏提示文字，停止自动旋转。
- 单指拖动：更新目标点，让 2000 个晶体被手指牵引。
- 松手：停止强引力，目标点缓慢回落为普通吸引。
- 快速双击：间隔小于 280ms 时切换色盘。
- 拖动空白区域仍由 OrbitControls 接管相机旋转；键盘 Space 开始/按住吸引，键盘 C 切换色盘。
- 所有游戏动作使用 pointer 事件，不同时绑定 mouse 与 touch。

## 5. Win / Lose Conditions

- 没有失败条件；45 秒结束后进入结算。
- 结算卡显示最终分数、历史最高、点亮光圈总数、最高 combo 和“Light complete / 引光完成”标签。
- 再来一次按钮重置分数、combo、倒计时、目标光圈进度和晶体状态；返回首页回到开始页。
- 如果本局分数超过历史最高，则立即更新 `localStorage.crystal_swarm_best`。

## 6. Sound Effects

- 开始：sine 波 330Hz 到 660Hz，持续 0.18s，音量 0.045。
- 换色：三枚 sine 波 392Hz、523Hz、784Hz，各 0.09s，间隔 0.04s，音量 0.026。
- 点亮光圈：triangle 波 520Hz 到 880Hz，持续 0.16s，音量 0.05；combo 大于 2 时叠加 sine 波 1174Hz，持续 0.08s，音量 0.025。
- 结算：sine 波 220Hz 到 440Hz，持续 0.20s，音量 0.04。
- 音效使用 Web Audio 实时合成，不加载外部音频文件；浏览器限制音频时静默失败，视觉体验不受影响。
