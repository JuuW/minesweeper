const LEVELS = {
  easy:   { rows: 9,  cols: 9,  mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard:   { rows: 16, cols: 30, mines: 99 },
};

const boardEl = document.getElementById('board');
const mineCounterEl = document.getElementById('mine-counter');
const timerEl = document.getElementById('timer');
const resetBtn = document.getElementById('reset-btn');

let config = LEVELS.easy;
let grid = [];           // 每格: {mine, revealed, flagged, count}
let firstClick = true;
let gameOver = false;
let flagCount = 0;
let timer = 0;
let timerId = null;

function init() {
  clearInterval(timerId);
  timerId = null;
  timer = 0;
  flagCount = 0;
  firstClick = true;
  gameOver = false;
  resetBtn.textContent = '🙂';
  timerEl.textContent = '⏱ 0';
  updateMineCounter();
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

boardEl.addEventListener('click', (e) => {
  const el = e.target.closest('.cell');
  if (!el || gameOver) return;
  const r = +el.dataset.r, c = +el.dataset.c;
  if (grid[r][c].flagged) return;

  if (firstClick) {
    placeMines(r, c);
    firstClick = false;
    startTimer();
  }
  reveal(r, c);
  render();
  if (!gameOver) checkWin();
});

boardEl.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const el = e.target.closest('.cell');
  if (!el || gameOver || firstClick) return;
  const r = +el.dataset.r, c = +el.dataset.c;
  const cell = grid[r][c];
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  flagCount += cell.flagged ? 1 : -1;
  updateMineCounter();
  render();
});

resetBtn.addEventListener('click', init);

document.querySelectorAll('.level-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelector('.level-btn.active').classList.remove('active');
    btn.classList.add('active');
    config = LEVELS[btn.dataset.level];
    init();
  });
});

init();
