const LEVELS = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard:   { rows: 16, cols: 30, mines: 99 },
};

const boardEl = document.getElementById('board');
const mineCounterEl = document.getElementById('mine-counter');
const timerEl = document.getElementById('timer');
const resetBtn = document.getElementById('reset-btn');
const modeBtn = document.getElementById('mode-btn');
const overlayEl = document.getElementById('overlay');
const dialogEl = document.getElementById('dialog');
const dialogIconEl = document.getElementById('dialog-icon');
const dialogTitleEl = document.getElementById('dialog-title');
const dialogBtn = document.getElementById('dialog-btn');
const fxCanvas = document.getElementById('fx-canvas');
const fxCtx = fxCanvas.getContext('2d');

let config = LEVELS.easy;
let grid = [];           // 每格: {mine, revealed, flagged, count}
let firstClick = true;
let gameOver = false;
let flagCount = 0;
let timer = 0;
let timerId = null;
let flagMode = false;    // false=翻开模式, true=插旗模式

function init() {
  clearInterval(timerId);
  timerId = null;
  timer = 0;
  flagCount = 0;
  firstClick = true;
  gameOver = false;
  resetBtn.textContent = '🙂';
  timerEl.textContent = '⏱ 0';
  flagMode = false;
  if (modeBtn) {
    modeBtn.classList.remove('flag-mode');
    modeBtn.querySelector('.mode-icon').textContent = '⛏';
    modeBtn.querySelector('.mode-text').textContent = '翻开';
  }
  updateMineCounter();
  overlayEl.classList.remove('show');
  stopFx();
  buildGrid();
  render();
}

function buildGrid() {
  grid = [];
  for (let r = 0; r < config.rows; r++) {
    const row = [];
    for (let c = 0; c < config.cols; c++) {
      row.push({ mine: false, revealed: false, flagged: false, count: 0 });
    }
    grid.push(row);
  }
}

// 首次点击后布雷,保证第一下不踩雷(含其周围 8 格)
function placeMines(safeR, safeC) {
  const forbidden = new Set();
  forEachNeighbor(safeR, safeC, (r, c) => forbidden.add(r + ',' + c));
  forbidden.add(safeR + ',' + safeC);

  let placed = 0;
  while (placed < config.mines) {
    const r = Math.floor(Math.random() * config.rows);
    const c = Math.floor(Math.random() * config.cols);
    if (grid[r][c].mine || forbidden.has(r + ',' + c)) continue;
    grid[r][c].mine = true;
    placed++;
  }

  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      if (grid[r][c].mine) continue;
      let n = 0;
      forEachNeighbor(r, c, (nr, nc) => { if (grid[nr][nc].mine) n++; });
      grid[r][c].count = n;
    }
  }
}

function forEachNeighbor(r, c, fn) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols) fn(nr, nc);
    }
  }
}

function reveal(r, c) {
  const cell = grid[r][c];
  if (cell.revealed || cell.flagged) return;
  cell.revealed = true;

  if (cell.mine) {
    gameOver = true;
    endGame(false);
    return;
  }
  // 空格(无相邻雷)自动展开
  if (cell.count === 0) {
    forEachNeighbor(r, c, (nr, nc) => reveal(nr, nc));
  }
}

function startTimer() {
  if (timerId) return;
  timerId = setInterval(() => {
    timer++;
    timerEl.textContent = '⏱ ' + timer;
  }, 1000);
}

function updateMineCounter() {
  mineCounterEl.textContent = '💣 ' + (config.mines - flagCount);
}

function checkWin() {
  let revealedSafe = 0;
  const totalSafe = config.rows * config.cols - config.mines;
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      if (grid[r][c].revealed && !grid[r][c].mine) revealedSafe++;
    }
  }
  if (revealedSafe === totalSafe) endGame(true);
}

function endGame(won) {
  gameOver = true;
  clearInterval(timerId);
  timerId = null;
  resetBtn.textContent = won ? '😎' : '😵';
  // 揭开所有雷
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      if (grid[r][c].mine) grid[r][c].revealed = true;
    }
  }
  render();
  showResult(won);
}

function showResult(won) {
  if (won) {
    launchConfetti();
    dialogEl.className = 'dialog win';
    dialogIconEl.textContent = '🎉';
    dialogTitleEl.textContent = '你赢了';
  } else {
    launchExplosion();
    dialogEl.className = 'dialog lose';
    dialogIconEl.textContent = '💥';
    dialogTitleEl.textContent = '你输了';
  }
  // 稍延迟弹出,让特效先亮相
  setTimeout(() => overlayEl.classList.add('show'), won ? 450 : 650);
}

function render() {
  boardEl.style.gridTemplateColumns = `repeat(${config.cols}, 32px)`;
  boardEl.innerHTML = '';
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      const cell = grid[r][c];
      const el = document.createElement('button');
      el.className = 'cell';
      el.dataset.r = r;
      el.dataset.c = c;

      if (cell.revealed) {
        el.classList.add('revealed');
        if (cell.mine) {
          el.classList.add('mine');
          el.textContent = '💣';
        } else if (cell.count > 0) {
          el.classList.add('n' + cell.count);
          el.textContent = cell.count;
        }
      } else if (cell.flagged) {
        el.classList.add('flag');
        el.textContent = '🚩';
      }
      boardEl.appendChild(el);
    }
  }
}

function doReveal(r, c) {
  if (gameOver) return;
  if (grid[r][c].flagged) return;

  if (firstClick) {
    placeMines(r, c);
    firstClick = false;
    startTimer();
  }
  reveal(r, c);
  render();
  if (!gameOver) checkWin();
}

function doFlag(r, c) {
  if (gameOver || firstClick) return;
  const cell = grid[r][c];
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  flagCount += cell.flagged ? 1 : -1;
  updateMineCounter();
  render();
}

// 和弦:双击已翻开的数字,若周围旗数==数字,翻开其余未插旗邻格
function doChord(r, c) {
  if (gameOver || firstClick) return;
  const cell = grid[r][c];
  if (!cell.revealed || cell.count === 0) return;

  let flags = 0;
  forEachNeighbor(r, c, (nr, nc) => { if (grid[nr][nc].flagged) flags++; });
  if (flags !== cell.count) return;

  forEachNeighbor(r, c, (nr, nc) => {
    const n = grid[nr][nc];
    if (!n.flagged && !n.revealed) reveal(nr, nc);  // 踩到真雷时 reveal 内部会 endGame
  });
  render();
  if (!gameOver) checkWin();
}

// —— 指针交互:单击按模式操作,长按(>400ms)快速插旗 ——
const LONG_PRESS_MS = 400;
const DOUBLE_TAP_MS = 300;
let pressTimer = null;
let longPressed = false;
let lastTapTime = 0;
let lastTapKey = '';

boardEl.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.cell');
  if (!el || gameOver) return;
  const r = +el.dataset.r, c = +el.dataset.c;
  longPressed = false;
  pressTimer = setTimeout(() => {
    longPressed = true;
    doFlag(r, c);
  }, LONG_PRESS_MS);
});

function cancelPress() {
  clearTimeout(pressTimer);
  pressTimer = null;
}

boardEl.addEventListener('pointerup', (e) => {
  cancelPress();
  if (longPressed) return;          // 长按已处理,松手不再触发
  const el = e.target.closest('.cell');
  if (!el || gameOver) return;
  const r = +el.dataset.r, c = +el.dataset.c;
  const key = r + ',' + c;
  const now = Date.now();

  // 双击已翻开的数字 -> 和弦
  const cell = grid[r][c];
  if (cell.revealed && cell.count > 0 &&
      key === lastTapKey && now - lastTapTime < DOUBLE_TAP_MS) {
    lastTapTime = 0;
    lastTapKey = '';
    doChord(r, c);
    return;
  }
  lastTapTime = now;
  lastTapKey = key;

  if (flagMode) doFlag(r, c);
  else doReveal(r, c);
});

boardEl.addEventListener('pointerleave', cancelPress);
boardEl.addEventListener('pointercancel', cancelPress);
// 禁用长按弹出的系统菜单
boardEl.addEventListener('contextmenu', (e) => e.preventDefault());

modeBtn.addEventListener('click', () => {
  flagMode = !flagMode;
  modeBtn.classList.toggle('flag-mode', flagMode);
  modeBtn.querySelector('.mode-icon').textContent = flagMode ? '🚩' : '⛏';
  modeBtn.querySelector('.mode-text').textContent = flagMode ? '插旗' : '翻开';
});

resetBtn.addEventListener('click', init);

dialogBtn.addEventListener('click', init);

document.querySelectorAll('.level-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelector('.level-btn.active').classList.remove('active');
    btn.classList.add('active');
    config = LEVELS[btn.dataset.level];
    init();
  });
});

// —————————————— 粒子特效 ——————————————
let particles = [];
let fxRafId = null;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  fxCanvas.width = window.innerWidth * dpr;
  fxCanvas.height = window.innerHeight * dpr;
  fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function stopFx() {
  if (fxRafId) cancelAnimationFrame(fxRafId);
  fxRafId = null;
  particles = [];
  fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

function runFx() {
  if (fxRafId) cancelAnimationFrame(fxRafId);
  const step = () => {
    fxCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = false;
    for (const p of particles) {
      if (p.life <= 0) continue;
      alive = true;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.99;
      p.rot += p.vr;
      p.life -= 1;
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      fxCtx.save();
      fxCtx.globalAlpha = alpha;
      fxCtx.translate(p.x, p.y);
      fxCtx.rotate(p.rot);
      fxCtx.fillStyle = p.color;
      if (p.shape === 'rect') {
        fxCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
      } else {
        fxCtx.beginPath();
        fxCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        fxCtx.fill();
      }
      fxCtx.restore();
    }
    if (alive) fxRafId = requestAnimationFrame(step);
    else stopFx();
  };
  step();
}

// 胜利:顶部两侧喷射彩色纸片(万花筒彩带)
function launchConfetti() {
  stopFx();
  const colors = ['#ef233c', '#ffd166', '#4895ef', '#52b788', '#c77dff', '#2ec4b6', '#ff686b'];
  const W = window.innerWidth, H = window.innerHeight;
  const bursts = [
    { x: 0, y: H * 0.25, angle: -Math.PI / 4 },
    { x: W, y: H * 0.25, angle: -3 * Math.PI / 4 },
    { x: W / 2, y: 0, angle: Math.PI / 2 },
  ];
  for (const b of bursts) {
    for (let i = 0; i < 90; i++) {
      const spread = (Math.random() - 0.5) * 1.1;
      const speed = 7 + Math.random() * 9;
      const maxLife = 90 + Math.random() * 60;
      particles.push({
        x: b.x, y: b.y,
        vx: Math.cos(b.angle + spread) * speed,
        vy: Math.sin(b.angle + spread) * speed,
        gravity: 0.15,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.4,
        size: 7 + Math.random() * 7,
        color: colors[(Math.random() * colors.length) | 0],
        shape: Math.random() < 0.7 ? 'rect' : 'circle',
        life: maxLife, maxLife,
      });
    }
  }
  runFx();
}

// 失败:屏幕中心地雷爆炸(火花四射)
function launchExplosion() {
  stopFx();
  const colors = ['#ff6b00', '#ffd166', '#ef233c', '#ffffff', '#ff9e00'];
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  for (let i = 0; i < 160; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 14;
    const maxLife = 50 + Math.random() * 45;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0.12,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.5,
      size: 5 + Math.random() * 9,
      color: colors[(Math.random() * colors.length) | 0],
      shape: Math.random() < 0.5 ? 'rect' : 'circle',
      life: maxLife, maxLife,
    });
  }
  runFx();
}

init();
