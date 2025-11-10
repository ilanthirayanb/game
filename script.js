const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const state = {
  nick: localStorage.getItem('arcadia_nick') || '',
  scores: JSON.parse(localStorage.getItem('arcadia_scores') || '{}')
};
const saveScores = () => localStorage.setItem('arcadia_scores', JSON.stringify(state.scores));

// Header controls
const nickInput = $('#displayName');
nickInput.value = state.nick;
nickInput.addEventListener('change', () => {
  state.nick = nickInput.value.trim() || 'Player';
  localStorage.setItem('arcadia_nick', state.nick);
  renderLeaderboard();
});
$('#shareSite').onclick = async () => {
  try {
    await navigator.share({ title: 'Arcadia — Free Web Games', text: 'Play Snake, Tic‑Tac‑Toe, Memory Match', url: location.href });
  } catch (e) { try { await navigator.clipboard.writeText(location.href); alert('Link copied!'); } catch{} }
};
$('#playNow').onclick = () => openGame('snake');

// Tabs (manage ARIA selected state)
$$('.tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
  tab.classList.add('active'); tab.setAttribute('aria-selected','true');
  ['games','leaderboard','about'].forEach(id => {
    const panel = $('#panel-' + id);
    if(!panel) return;
    panel.classList.toggle('hidden', id !== tab.dataset.tab);
  });
  if (tab.dataset.tab === 'leaderboard') renderLeaderboard();
}));

// Open modals / help from cards
$$('[data-open]').forEach(el => el.addEventListener('click', () => openGame(el.dataset.open)));
$$('[data-how]').forEach(el => el.addEventListener('click', () => showHelp(el.dataset.how)));

// Modal logic with cleanup helpers
const modal = $('#modal');
const gameArea = $('#gameArea');
const btnClose = $('#btnClose');
const btnRestart = $('#btnRestart');
const btnHelp = $('#btnHelp');
let activeGame = null;
let modalCleanup = [];
let lastActiveElement = null;

function openModal(title){
  lastActiveElement = document.activeElement;
  $('#modalTitle').textContent = title;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  // focus the close button for quick keyboard access
  btnClose?.focus();
}
function closeModal(){
  // run any cleanup functions (remove listeners, timers)
  modalCleanup.forEach(fn=>{ try{ fn(); }catch(e){} });
  modalCleanup = [];
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');
  gameArea.innerHTML = '';
  activeGame = null;
  // return focus
  try{ if(lastActiveElement && lastActiveElement.focus) lastActiveElement.focus(); } catch(e){}
}
btnClose.onclick = closeModal;

function showHelp(kind){
  const map = {snake:'#tpl-how-snake', ttt:'#tpl-how-ttt', memory:'#tpl-how-memory'};
  const tpl = $(map[kind]);
  if(tpl){
    // show native dialog fallback
    const text = tpl.content.textContent.trim();
    alert(text);
  }
}
btnHelp.onclick = () => { if(activeGame) showHelp(activeGame); };

// Restart button: delegate to current game's restart control if present
btnRestart.onclick = () => {
  if(activeGame === 'snake') $('#snReset')?.click();
  else if(activeGame === 'ttt') $('#tttReset')?.click();
  else if(activeGame === 'memory') $('#memReset')?.click();
};

// Games launcher
function openGame(kind){
  activeGame = kind;
  if(kind==='snake') initSnake();
  if(kind==='ttt') initTTT();
  if(kind==='memory') initMemory();
}

// ---- Leaderboard ----
function pushScore(game, value){
  const nick = (state.nick || 'Player').slice(0,18);
  state.scores[game] ||= [];
  state.scores[game].push({nick, value, at: new Date().toISOString()});
  // Keep top 10
  if(game==='snake') state.scores[game].sort((a,b)=>b.value-a.value);
  if(game==='memory') state.scores[game].sort((a,b)=>a.value-b.value);
  if(game==='ttt') state.scores[game].sort((a,b)=>b.value-a.value);
  state.scores[game] = state.scores[game].slice(0,10);
  saveScores();
  renderLeaderboard();
}

function renderLeaderboard(){
  const wrap = $('#lbWrap');
  const games = [
    {key:'snake', label:'Snake — Highest score (bigger is better)'},
    {key:'memory', label:'Memory Match — Fewest moves (smaller is better)'},
    {key:'ttt', label:'Tic‑Tac‑Toe — Wins (more is better)'}
  ];
  wrap.innerHTML = games.map(g => {
    const rows = (state.scores[g.key]||[]).map((r,i)=>`<tr><td>${i+1}</td><td>${r.nick}</td><td>${r.value}</td><td>${new Date(r.at).toLocaleString()}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No scores yet</td></tr>';
    return `<div class="card" style="margin:12px 0"><div class="content"><h3 style="margin:0 0 10px">${g.label}</h3><div style="overflow:auto"><table><thead><tr><th>#</th><th>Nickname</th><th>Score</th><th>When</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`;
  }).join('');
}

// ---- Tic Tac Toe ----
function initTTT(){
  openModal('Tic‑Tac‑Toe');
  gameArea.innerHTML = `<div style="display:grid; gap:14px; place-items:center">
    <div class="ttt" role="grid" aria-label="Tic Tac Toe grid"></div>
    <div id="tttStatus" class="muted">Player ❌ to move</div>
    <div style="display:flex; gap:8px"><button class="btn" id="tttReset" type="button">Restart</button><button class="btn btn-outline" id="tttHome" type="button">Home</button></div>
  </div>`;
  const grid = gameArea.querySelector('.ttt');
  const status = $('#tttStatus');
  let board = Array(9).fill('');
  let turn = 'X';
  let over = false;

  function render(){
    grid.innerHTML = '';
    board.forEach((v,i)=>{
      const b = document.createElement('button');
      b.setAttribute('aria-label', `Cell ${i+1}`);
      b.textContent = v;
      b.onclick = ()=> move(i);
      grid.appendChild(b);
    });
  }
  function winner(b){
    const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(const [a,c,d] of lines){
      if(b[a] && b[a]===b[c] && b[a]===b[d]) return [a,c,d];
    }
    return null;
  }
  function move(i){
    if(over || board[i]) return;
    board[i] = turn;
    render();
    const win = winner(board);
    if(win){
      over = true; status.textContent = `Player ${turn==='X'?'❌':'⭘'} wins!`;
      win.forEach(idx=> grid.children[idx].classList.add('win'));
      pushScore('ttt', 1);
      return;
    }
    if(board.every(Boolean)){ over = true; status.textContent = 'Draw!'; return; }
    turn = turn==='X' ? 'O' : 'X';
    status.textContent = `Player ${turn==='X'?'❌':'⭘'} to move`;
  }
  render();
  gameArea.querySelector('#tttReset').onclick = ()=>{ board=Array(9).fill(''); turn='X'; over=false; status.textContent='Player ❌ to move'; render(); };
  gameArea.querySelector('#tttHome').onclick = closeModal;

  // keyboard handler for this modal game
  const tttKeyHandler = (e) => {
    const k = e.key.toLowerCase();
    if(k === 'r') gameArea.querySelector('#tttReset')?.click();
    if(k === 'h') closeModal();
  };
  document.addEventListener('keydown', tttKeyHandler);
  modalCleanup.push(()=> document.removeEventListener('keydown', tttKeyHandler));
}

// ---- Memory Match ----
function initMemory(){
  openModal('Memory Match');
  const icons = ['🍎','🍌','🍉','🍇','🍒','🥝','🍍','🥑'];
  const deck = [...icons, ...icons].sort(()=>Math.random()-0.5);
  let flipped = [];
  let matched = new Set();
  let moves = 0;
  gameArea.innerHTML = `<div style="display:grid; gap:14px; place-items:center">
    <div class="memory" role="grid"></div>
    <div id="memStatus" class="muted">Moves: 0</div>
    <div style="display:flex; gap:8px"><button class="btn" id="memReset" type="button">Restart</button><button class="btn btn-outline" id="memHome" type="button">Home</button></div>
  </div>`;
  const grid = gameArea.querySelector('.memory');
  const status = $('#memStatus');

  deck.forEach((ico, idx)=>{
    const cell = document.createElement('div');
    cell.className='card-mem';
    cell.innerHTML = `<div class="face back" aria-hidden="true">❓</div><div class="face front" aria-label="${ico}">${ico}</div>`;
    cell.tabIndex = 0;
    const clickHandler = ()=> flip(idx, cell);
    const keyHandler = (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); flip(idx, cell);} };
    cell.addEventListener('click', clickHandler);
    cell.addEventListener('keydown', keyHandler);
    // cleanup for this cell when modal closes
    modalCleanup.push(()=>{ cell.removeEventListener('click', clickHandler); cell.removeEventListener('keydown', keyHandler); });
    grid.appendChild(cell);
  });

  function flip(i, el){
    if(matched.has(i) || flipped.find(f=>f.i===i) || flipped.length===2) return;
    el.classList.add('flipped');
    flipped.push({i, el, ico: deck[i]});
    if(flipped.length===2){
      moves++; status.textContent = `Moves: ${moves}`;
      const [a,b] = flipped;
      if(a.ico===b.ico){
        matched.add(a.i); matched.add(b.i);
        setTimeout(()=>{ a.el.classList.add('matched'); b.el.classList.add('matched'); flipped=[]; checkDone(); }, 200);
      } else {
        setTimeout(()=>{ a.el.classList.remove('flipped'); b.el.classList.remove('flipped'); flipped=[]; }, 650);
      }
    }
  }
  function checkDone(){
    if(matched.size===deck.length){
      alert(`You cleared the board in ${moves} moves!`);
      pushScore('memory', moves);
    }
  }
  gameArea.querySelector('#memReset').onclick = initMemory;
  gameArea.querySelector('#memHome').onclick = closeModal;
}

// ---- Snake ----
function initSnake(){
  openModal('Snake');
  gameArea.innerHTML = `<div style="display:grid; gap:12px; place-items:center">
    <div class="snake-wrap"><canvas id="snake" width="420" height="420" aria-label="Snake game area"></canvas></div>
    <div style="display:flex; gap:12px; align-items:center">
      <div id="snScore" class="pill">Score: 0</div>
      <div id="snStatus" class="muted">Arrow keys to move</div>
    </div>
    <div style="display:flex; gap:8px"><button class="btn" id="snReset" type="button">Restart</button><button class="btn btn-outline" id="snHome" type="button">Home</button></div>
  </div>`;
  const cvs = $('#snake');
  const ctx = cvs.getContext('2d');
  const size = 20; // grid cell
  const tiles = cvs.width / size;

  let dir = {x:1,y:0};
  let snake = [{x:10,y:10}];
  let apple = spawnApple();
  let score = 0;
  let speed = 120; // ms
  let timer = null;
  let alive = true;

  function spawnApple(){
    let p;
    do { p = {x: Math.floor(Math.random()*tiles), y: Math.floor(Math.random()*tiles)}; }
    while(snake.some(s=>s.x===p.x && s.y===p.y));
    return p;
  }
  function drawCell(x,y){ ctx.fillRect(x*size, y*size, size-1, size-1); }
  function step(){
    if(!alive) return;
    const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
    // collisions
    if(head.x<0 || head.y<0 || head.x>=tiles || head.y>=tiles || snake.some(s=>s.x===head.x && s.y===head.y)){
      alive = false; $('#snStatus').textContent = 'Game over!'; pushScore('snake', score); return;
    }
    snake.unshift(head);
    if(head.x===apple.x && head.y===apple.y){
      score++; $('#snScore').textContent = `Score: ${score}`; apple = spawnApple(); if(speed>60) speed -= 2; clearInterval(timer); timer = setInterval(step, speed);
    } else {
      snake.pop();
    }
    // draw
    ctx.clearRect(0,0,cvs.width,cvs.height);
    ctx.fillStyle = '#7c6cff'; snake.forEach(p=>drawCell(p.x,p.y));
    ctx.fillStyle = '#45d19e'; drawCell(apple.x, apple.y);
  }
  function reset(){
    dir={x:1,y:0}; snake=[{x:10,y:10}]; apple=spawnApple(); score=0; speed=120; alive=true; $('#snScore').textContent='Score: 0'; $('#snStatus').textContent='Arrow keys to move'; ctx.clearRect(0,0,cvs.width,cvs.height); clearInterval(timer); timer=setInterval(step, speed);
  }

  // keyboard controls (attach + cleanup)
  const snakeKeyHandler = (e)=>{
    const k=e.key;
    if(k==='ArrowUp' && dir.y!==1) dir={x:0,y:-1};
    if(k==='ArrowDown' && dir.y!==-1) dir={x:0,y:1};
    if(k==='ArrowLeft' && dir.x!==1) dir={x:-1,y:0};
    if(k==='ArrowRight' && dir.x!==-1) dir={x:1,y:0};
    if(k==='?' || k==='/'){ showHelp('snake'); }
  };
  document.addEventListener('keydown', snakeKeyHandler);
  modalCleanup.push(()=> document.removeEventListener('keydown', snakeKeyHandler));

  // simple touch controls (attach + cleanup)
  let touchStart=null;
  const touchStartHandler = e=>{touchStart = e.touches[0];};
  const touchMoveHandler = e=>{ if(!touchStart) return; const dx=e.touches[0].clientX - touchStart.clientX; const dy=e.touches[0].clientY - touchStart.clientY; if(Math.abs(dx)>Math.abs(dy)){ if(dx>0 && dir.x!==-1) dir={x:1,y:0}; else if(dx<0 && dir.x!==1) dir={x:-1,y:0}; } else { if(dy>0 && dir.y!==-1) dir={x:0,y:1}; else if(dy<0 && dir.y!==1) dir={x:0,y:-1}; } touchStart=null; };
  cvs.addEventListener('touchstart', touchStartHandler);
  cvs.addEventListener('touchmove', touchMoveHandler);
  modalCleanup.push(()=>{ cvs.removeEventListener('touchstart', touchStartHandler); cvs.removeEventListener('touchmove', touchMoveHandler); });

  $('#snReset').onclick = reset;
  $('#snHome').onclick = closeModal;
  timer = setInterval(step, speed);
  // ensure timer is cleared when modal closes
  modalCleanup.push(()=> clearInterval(timer));
}

// Footer year
$('#year').textContent = new Date().getFullYear();

// Keyboard shortcuts for modal (global handler)
document.addEventListener('keydown', (e)=>{
  if(modal.classList.contains('hidden')) return;
  const k = e.key.toLowerCase();
  if(k === 'escape') closeModal();
  if(k === '?') btnHelp.click();
  if(k === 'r') btnRestart.click();
  if(k === 'h') closeModal();
});
