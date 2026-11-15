const LEVELS = {
  easy:   { rows: 9,  cols: 9,  mines: 10, name: '初级' },
  medium: { rows: 16, cols: 16, mines: 40, name: '中级' },
  hard:   { rows: 16, cols: 30, mines: 99, name: '高级' },
};

const boardEl = document.getElementById('board');
const mineCounterEl = document.getElementById('mine-counter');
const timerEl = document.getElementById('timer');
const resetBtn = document.getElementById('reset-btn');
const newGameBtn = document.getElementById('new-game-btn');
const helpBtn = document.getElementById('help-btn');
const helpOverlay = document.getElementById('help-overlay');
const helpCloseBtn = document.getElementById('help-close-btn');
const revealBtn = document.getElementById('reveal-btn');
const flagBtn = document.getElementById('flag-btn');
const hintBtn = document.getElementById('hint-btn');
const hintMsgEl = document.getElementById('hint-msg');
const overlayEl = document.getElementById('overlay');
const dialogEl = document.getElementById('dialog');
const dialogIconEl = document.getElementById('dialog-icon');
const dialogTitleEl = document.getElementById('dialog-title');
const dialogBtn = document.getElementById('dialog-btn');
const fxCanvas = document.getElementById('fx-canvas');
const fxCtx = fxCanvas.getContext('2d');
const recordsBody = document.getElementById('records-body');
const clearRecordsBtn = document.getElementById('clear-records-btn');

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
  setMode(false);
  hintMsgEl.textContent = '';
  hintMsgEl.className = 'hint-msg';
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
  addRecord(won);
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
  // 任何重绘都清掉上一次的提示文案(角标随 DOM 重建自动消失)
  if (hintMsgEl) {
    hintMsgEl.textContent = '';
    hintMsgEl.className = 'hint-msg';
  }
  boardEl.style.gridTemplateColumns = `repeat(${config.cols}, 32px)`;
  boardEl.innerHTML = '';
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      const cell = grid[r][c];
      const el = document.createElement('button');
      el.className = 'cell';
      el.dataset.r = r;
      el.dataset.c = c;

      const content = document.createElement('span');
      content.className = 'cell-content';

      if (cell.revealed) {
        el.classList.add('revealed');
        if (cell.mine) {
          el.classList.add('mine');
          content.textContent = '💣';
        } else if (cell.count > 0) {
          el.classList.add('n' + cell.count);
          content.textContent = cell.count;
        }
      } else if (cell.flagged) {
        el.classList.add('flag');
        content.textContent = '🚩';
      }
      el.appendChild(content);
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

function setMode(flag) {
  flagMode = flag;
  revealBtn.classList.toggle('active', !flag);
  flagBtn.classList.toggle('active', flag);
}

revealBtn.addEventListener('click', () => setMode(false));
flagBtn.addEventListener('click', () => setMode(true));

// —————————————— 提示:逻辑推理求解器 ——————————————

// 收集某已翻开数字格的约束:未知(未翻开未插旗)邻格 + 剩余雷数
function cellConstraint(r, c) {
  const cell = grid[r][c];
  if (!cell.revealed || cell.count === 0) return null;
  const unknown = [];
  let flags = 0;
  forEachNeighbor(r, c, (nr, nc) => {
    const n = grid[nr][nc];
    if (n.flagged) flags++;
    else if (!n.revealed) unknown.push(nr + ',' + nc);
  });
  if (unknown.length === 0) return null;
  return { cells: unknown, mines: cell.count - flags, r, c };
}

function allConstraints() {
  const list = [];
  for (let r = 0; r < config.rows; r++) {
    for (let c = 0; c < config.cols; c++) {
      const con = cellConstraint(r, c);
      if (con) list.push(con);
    }
  }
  return list;
}

function rc(key) {
  const [r, c] = key.split(',').map(Number);
  return { r, c };
}

// 返回一条提示:
//   labeled: [{r,c,no}] 所有需要打角标的格子(含参照数字格和目标格)
//   targets: [{r,c,no}] 被判定为安全/雷的目标格(额外脉冲高亮)
//   type: 'safe'|'mine', reason: 文案(用 1号/2号 指代)
function findHint() {
  const cons = allConstraints();

  // 按首次出现顺序给格子编号,从 1 开始
  function makeLabeler() {
    const map = new Map();      // "r,c" -> no
    const list = [];            // [{r,c,no}]
    return {
      label(r, c) {
        const key = r + ',' + c;
        if (!map.has(key)) {
          const no = list.length + 1;
          map.set(key, no);
          list.push({ r, c, no });
        }
        return map.get(key) + '号';
      },
      get labeled() { return list; },
      nosOf(keys) {
        return keys.map((k) => {
          const { r, c } = rc(k);
          this.label(r, c);
          return map.get(k);
        }).join('、') + '号';
      },
      targetsOf(keys) {
        return keys.map((k) => {
          const { r, c } = rc(k);
          this.label(r, c);
          return { r, c, no: map.get(k) };
        });
      },
    };
  }

  // 规则1/2:单约束直接判定
  for (const con of cons) {
    if (con.mines === 0) {
      const L = makeLabeler();
      const ref = L.label(con.r, con.c);
      const nos = L.nosOf(con.cells);
      return {
        type: 'safe', targets: L.targetsOf(con.cells), labeled: L.labeled,
        reason: `${ref}格子的雷已全部插旗,所以旁边的 ${nos} 格子都安全。`,
      };
    }
    if (con.mines === con.cells.length) {
      const L = makeLabeler();
      const ref = L.label(con.r, con.c);
      const nos = L.nosOf(con.cells);
      return {
        type: 'mine', targets: L.targetsOf(con.cells), labeled: L.labeled,
        reason: `${ref}格子周围只剩 ${con.cells.length} 个未知格,还差 ${con.mines} 个雷,所以 ${nos} 全是雷。`,
      };
    }
  }

  // 规则3:子集相减(你举的"1 挨着 1"的例子)
  for (const a of cons) {
    for (const b of cons) {
      if (a === b) continue;
      const setA = new Set(a.cells);
      if (a.cells.length >= b.cells.length) continue;
      if (!a.cells.every((k) => b.cells.includes(k))) continue;

      const diff = b.cells.filter((k) => !setA.has(k));
      const diffMines = b.mines - a.mines;

      if (diffMines === 0) {
        const L = makeLabeler();
        const refA = L.label(a.r, a.c);
        const refB = L.label(b.r, b.c);
        const nos = L.nosOf(diff);
        return {
          type: 'safe', targets: L.targetsOf(diff), labeled: L.labeled,
          reason: `${refA}的雷都藏在它和${refB}共享的格子里,所以${refB}多出来的 ${nos} 不含雷,安全。`,
        };
      }
      if (diffMines === diff.length) {
        const L = makeLabeler();
        const refA = L.label(a.r, a.c);
        const refB = L.label(b.r, b.c);
        const nos = L.nosOf(diff);
        return {
          type: 'mine', targets: L.targetsOf(diff), labeled: L.labeled,
          reason: `${refB}比${refA}多出的 ${nos} 正好多 ${diffMines} 个雷,所以它们全是雷。`,
        };
      }
    }
  }

  return null;
}

// 清除所有提示角标和高亮
function clearHints() {
  document.querySelectorAll('.cell.hint-safe, .cell.hint-mine, .cell.hinted')
    .forEach((el) => {
      el.classList.remove('hint-safe', 'hint-mine', 'hinted');
      const badge = el.querySelector('.cell-no');
      if (badge) badge.remove();
    });
}

function cellEl(r, c) {
  return boardEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

function addBadge(el, no) {
  if (!el || el.querySelector('.cell-no')) return;
  const badge = document.createElement('span');
  badge.className = 'cell-no';
  badge.textContent = no;
  el.appendChild(badge);
}

function showHint() {
  if (gameOver) return;
  clearHints();

  if (firstClick) {
    hintMsgEl.className = 'hint-msg';
    hintMsgEl.textContent = '先翻开第一个格子吧,这样才有线索可以分析。';
    return;
  }

  const hint = findHint();
  if (!hint) {
    hintMsgEl.className = 'hint-msg warn';
    hintMsgEl.textContent = '暂时推不出 100% 确定的格子,需要你自己判断或赌一把。';
    return;
  }

  // 给本条提示涉及的所有格子打角标(从 1 开始)
  for (const { r, c, no } of hint.labeled) {
    const el = cellEl(r, c);
    addBadge(el, no);
    if (el) el.classList.add('hinted');
  }
  // 目标格额外加安全/雷脉冲高亮
  const cls = hint.type === 'safe' ? 'hint-safe' : 'hint-mine';
  for (const { r, c } of hint.targets) {
    const el = cellEl(r, c);
    if (el) el.classList.add(cls);
  }

  const tag = hint.type === 'safe' ? '🟢 安全' : '🔴 有雷';
  hintMsgEl.className = 'hint-msg';
  hintMsgEl.textContent = `${tag}:${hint.reason}`;
}

hintBtn.addEventListener('click', showHint);

resetBtn.addEventListener('click', init);

newGameBtn.addEventListener('click', init);

// 玩法说明弹窗
helpBtn.addEventListener('click', () => helpOverlay.classList.add('show'));
helpCloseBtn.addEventListener('click', () => helpOverlay.classList.remove('show'));
helpOverlay.addEventListener('click', (e) => {
  if (e.target === helpOverlay) helpOverlay.classList.remove('show');
});

// 「确定」:关闭结算弹窗和特效,但保留棋盘以便复盘(不重开)
dialogBtn.addEventListener('click', () => {
  overlayEl.classList.remove('show');
  stopFx();
});

document.querySelectorAll('.level-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelector('.level-btn.active').classList.remove('active');
    btn.classList.add('active');
    config = LEVELS[btn.dataset.level];
    init();
  });
});

// —————————————— 游戏记录(localStorage 持久化)——————————————
const RECORDS_KEY = 'minesweeper-records';

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords(list) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(list));
  } catch { /* 隐私模式等写入失败,忽略 */ }
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}分${s}秒` : `${s}秒`;
}

function addRecord(won) {
  const list = loadRecords();
  list.push({ level: config.name, won, time: timer });
  saveRecords(list);
  renderRecords();
}

function renderRecords() {
  const list = loadRecords();
  if (list.length === 0) {
    recordsBody.innerHTML = '<tr class="records-empty"><td colspan="4">还没有记录</td></tr>';
    return;
  }
  // 最新的排在最上面
  recordsBody.innerHTML = list.map((r, i) => {
    const no = i + 1;
    const cls = r.won ? 'win' : 'lose';
    const txt = r.won ? '成功' : '失败';
    return `<tr><td>${no}</td><td>${r.level}</td><td class="${cls}">${txt}</td><td>${fmtTime(r.time)}</td></tr>`;
  }).reverse().join('');
}

clearRecordsBtn.addEventListener('click', () => {
  saveRecords([]);
  renderRecords();
});

renderRecords();

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
