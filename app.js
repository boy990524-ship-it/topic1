// FocusStats - app.js
// 簡單的番茄鐘、localStorage 儲存、Chart.js 統計與 AI 查詢前端

(() => {
  // DOM
  const timeDisplay = document.getElementById('timeDisplay');
  const startPauseBtn = document.getElementById('startPauseBtn');
  const resetBtn = document.getElementById('resetBtn');
  const modeSelect = document.getElementById('modeSelect');
  const modeLabel = document.getElementById('modeLabel');
  const workMinutesInput = document.getElementById('workMinutes');
  const breakMinutesInput = document.getElementById('breakMinutes');

  const viewDay = document.getElementById('viewDay');
  const viewMonth = document.getElementById('viewMonth');
  const viewYear = document.getElementById('viewYear');
  const statsCanvas = document.getElementById('statsChart');
  const recordList = document.getElementById('recordList');
  const tabTimer = document.getElementById('tabTimer');
  const tabRecords = document.getElementById('tabRecords');
  const timerPage = document.getElementById('timerPage');
  const recordsPage = document.getElementById('recordsPage');
  // record controls
  const recordFilter = document.getElementById('recordFilter');
  const filterStart = document.getElementById('filterStart');
  const filterEnd = document.getElementById('filterEnd');
  const applyFilterBtn = document.getElementById('applyFilterBtn');
  const clearRecordsBtn = document.getElementById('clearRecordsBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const taskInput = document.getElementById('taskInput');
  const addTaskBtn = document.getElementById('addTaskBtn');
  const clearCompletedBtn = document.getElementById('clearCompletedBtn');
  const taskList = document.getElementById('taskList');
  const taskSummary = document.getElementById('taskSummary');
  const taskProgressBar = document.getElementById('taskProgressBar');
  const taskCategoryInput = document.getElementById('taskCategory');
  const taskGaugeFill = document.getElementById('taskGaugeFill');
  const taskGaugeText = document.getElementById('taskGaugeText');
  let currentFilteredSessions = null;
  let lastStatsView = 'day';

  const openAIBtn = document.getElementById('openAIBtn');
  const aiModal = new bootstrap.Modal(document.getElementById('aiModal'));
  const closeAIModal = document.getElementById('closeAIModal');
  const sendAI = document.getElementById('sendAI');
  const aiPrompt = document.getElementById('aiPrompt');
  const aiResponse = document.getElementById('aiResponse');
  const liveReplyCheck = document.getElementById('liveReplyCheck');
  const aiSpinner = document.getElementById('aiSpinner');
  let currentEventSource = null;

  // Record confirmation modal
  const recordConfirmModal = new bootstrap.Modal(document.getElementById('recordConfirmModal'));
  const closeRecordConfirm = document.getElementById('closeRecordConfirm');
  const skipRecordBtn = document.getElementById('skipRecordBtn');
  const confirmRecordBtn = document.getElementById('confirmRecordBtn');
  const recordConfirmDuration = document.getElementById('recordConfirmDuration');
  let pendingRecord = null; // {startTs, endTs, mode}

  // Timer state
  let mode = 'work'; // 'work' or 'break'
  let workSeconds = parseInt(workMinutesInput.value || 25) * 60;
  let breakSeconds = parseInt(breakMinutesInput.value || 5) * 60;
  let remaining = workSeconds;
  let initialRemaining = workSeconds; // Track initial remaining for current session
  let intervalId = null;
  let running = false;
  let tickStart = null;

  // Storage key
  const SESSIONS_KEY = 'focus_sessions_v1';

  // Chart
  let statsChart = null;

  function loadSessions(){
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  function saveSessions(sessions){
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }
  function addSession(startTs, endTs){
    const sessions = loadSessions();
    const duration = Math.max(0, Math.round((endTs - startTs)/1000));
    sessions.push({start:startTs, end:endTs, duration});
    saveSessions(sessions);
    renderStats();
  }

  function formatTime(sec){
    const m = Math.floor(sec/60).toString().padStart(2,'0');
    const s = (sec%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  }

  function updateDisplay(){
    timeDisplay.textContent = formatTime(remaining);
    modeLabel.textContent = (mode==='work')? '工作計時' : '休息計時';
    if(mode==='work') modeLabel.classList.remove('bg-success');
  }

  function startTimer(){
    if(running) return;
    running = true;
    startPauseBtn.textContent = '暫停';
    initialRemaining = remaining; // Record initial remaining when starting
    tickStart = Date.now();
    intervalId = setInterval(tick, 1000);
  }
  function pauseTimer(){
    if(!running) return;
    running = false;
    startPauseBtn.textContent = '開始';
    clearInterval(intervalId);
    intervalId = null;
  }
  function resetTimer(){
    const timeSpent = initialRemaining - remaining;
    
    // Only show confirmation if user has spent some time (more than 0 seconds)
    if(timeSpent > 0){
      const endTs = Date.now();
      const startTs = endTs - (timeSpent * 1000);
      const mins = Math.round(timeSpent / 60);
      
      recordConfirmDuration.textContent = `本次計時：${mins} 分鐘`;
      pendingRecord = {startTs, endTs, mode};
      recordConfirmModal.show();
      return;
    }
    
    // If no time spent, just reset normally
    pauseTimer();
    workSeconds = parseInt(workMinutesInput.value||25)*60;
    breakSeconds = parseInt(breakMinutesInput.value||5)*60;
    remaining = (mode==='work')? workSeconds : breakSeconds;
    initialRemaining = remaining;
    updateDisplay();
  }

  function tick(){
    remaining -= 1;
    if(remaining <= 0){
      // session end
      remaining = 0;
      updateDisplay();
      pauseTimer();
      playBeep();
      // Auto-switch to next mode without asking
      mode = (mode==='work')? 'break' : 'work';
      modeSelect.value = mode;
      remaining = (mode==='work')? workSeconds : breakSeconds;
      updateDisplay();
    } else {
      updateDisplay();
    }
  }

  function playBeep(){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.0);
      o.stop(ctx.currentTime + 1.05);
    }catch(e){
      console.warn('beep failed', e);
    }
  }

  // Events
  startPauseBtn.addEventListener('click', ()=>{
    if(running) pauseTimer(); else startTimer();
  });
  resetBtn.addEventListener('click', ()=>{
    resetTimer();
  });
  modeSelect.addEventListener('change', (e)=>{
    mode = e.target.value;
    remaining = (mode==='work')? workSeconds : breakSeconds;
    updateDisplay();
  });

  workMinutesInput.addEventListener('change', ()=>{
    workSeconds = parseInt(workMinutesInput.value||25)*60;
    if(mode==='work' && !running) {
      remaining = workSeconds;
      initialRemaining = workSeconds;
    }
    updateDisplay();
  });
  breakMinutesInput.addEventListener('change', ()=>{
    breakSeconds = parseInt(breakMinutesInput.value||5)*60;
    if(mode==='break' && !running) {
      remaining = breakSeconds;
      initialRemaining = breakSeconds;
    }
    updateDisplay();
  });

  // Stats view toggles
  function setActiveView(btn){
    [viewDay, viewMonth, viewYear].forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    // remember current view
    if(btn === viewDay) lastStatsView = 'day';
    if(btn === viewMonth) lastStatsView = 'month';
    if(btn === viewYear) lastStatsView = 'year';
  }
  viewDay.addEventListener('click', ()=>{ setActiveView(viewDay); renderStats('day'); });
  viewMonth.addEventListener('click', ()=>{ setActiveView(viewMonth); renderStats('month'); });
  viewYear.addEventListener('click', ()=>{ setActiveView(viewYear); renderStats('year'); });

  tabTimer.addEventListener('click', ()=> showPage('timer'));
  tabRecords.addEventListener('click', ()=> showPage('records'));

  function showPage(page){
    if(page === 'records'){
      tabTimer.classList.remove('btn-primary');
      tabTimer.classList.add('btn-outline-primary');
      tabRecords.classList.remove('btn-outline-primary');
      tabRecords.classList.add('btn-primary');
      timerPage.classList.add('d-none');
      recordsPage.classList.remove('d-none');
      renderStats(lastStatsView, currentFilteredSessions);
      renderRecordList(currentFilteredSessions);
    } else {
      tabTimer.classList.add('btn-primary');
      tabTimer.classList.remove('btn-outline-primary');
      tabRecords.classList.add('btn-outline-primary');
      tabRecords.classList.remove('btn-primary');
      timerPage.classList.remove('d-none');
      recordsPage.classList.add('d-none');
    }
  }

  // Filter helpers
  function parseDateInput(v){
    if(!v) return null;
    const t = new Date(v + 'T00:00:00');
    return t.getTime();
  }

  function getFilteredSessions(){
    const all = loadSessions().slice();
    const mode = recordFilter?.value || 'all';
    if(mode === 'all') return all;
    if(mode === 'custom'){
      const s = parseDateInput(filterStart.value);
      const e = parseDateInput(filterEnd.value);
      if(!s || !e) return all;
      const endTs = e + 24*3600*1000 - 1;
      return all.filter(x => x.end >= s && x.start <= endTs);
    }
    const days = parseInt(mode,10);
    if(isNaN(days)) return all;
    const cutoff = Date.now() - days*24*3600*1000;
    return all.filter(x => x.end >= cutoff);
  }

  applyFilterBtn?.addEventListener('click', ()=>{
    currentFilteredSessions = getFilteredSessions();
    renderStats(lastStatsView, currentFilteredSessions);
    renderRecordList(currentFilteredSessions);
  });

  recordFilter?.addEventListener('change', (e)=>{
    if(e.target.value === 'custom'){
      filterStart.style.display = 'inline-block';
      filterEnd.style.display = 'inline-block';
    } else {
      filterStart.style.display = 'none';
      filterEnd.style.display = 'none';
    }
  });

  clearRecordsBtn?.addEventListener('click', ()=>{
    if(!confirm('確定要清除所有紀錄嗎？此動作無法復原。')) return;
    localStorage.removeItem(SESSIONS_KEY);
    currentFilteredSessions = null;
    renderStats(lastStatsView);
    renderRecordList();
  });

  exportCsvBtn?.addEventListener('click', ()=>{
    const sessions = currentFilteredSessions || loadSessions();
    if(!sessions || !sessions.length){ alert('沒有可匯出的紀錄'); return; }
    const rows = ['start,end,duration_seconds'];
    sessions.slice().sort((a,b)=>a.start-b.start).forEach(s=>{
      rows.push(`${new Date(s.start).toISOString()},${new Date(s.end).toISOString()},${s.duration}`);
    });
    const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'focus_sessions.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const TASKS_KEY = 'focus_tasks_v1';

  function loadTasks(){
    const raw = localStorage.getItem(TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  function saveTasks(tasks){
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }

  function renderTasks(){
    const tasks = loadTasks();
    const total = tasks.length;
    const completedCount = tasks.filter(task => task.completed).length;
    if(taskSummary){
      taskSummary.textContent = total === 0
        ? '目前尚無任務，請建立今日重點。'
        : `今日任務 ${total} 件，完成 ${completedCount} 件`;
    }
    if(taskProgressBar){
      const percent = total ? Math.round((completedCount / total) * 100) : 0;
      taskProgressBar.style.width = `${percent}%`;
      taskProgressBar.textContent = total ? `${percent}%` : '';
      updateTaskGauge(percent);
    }
    if(!taskList) return;
    if(!tasks.length){
      taskList.innerHTML = '<div class="text-muted">尚無任務，請新增一個今日重點。</div>';
      return;
    }
    taskList.innerHTML = tasks.map(task => {
      const checked = task.completed ? 'checked' : '';
      const labelClass = task.completed ? 'text-decoration-line-through text-muted' : '';
      const cat = task.category ? `<span class="badge bg-secondary ms-2">${escapeHtml(task.category)}</span>` : '';
      return `<label class="list-group-item task-item d-flex align-items-center justify-content-between">
        <div class="form-check d-flex align-items-center gap-2">
          <input class="form-check-input task-toggle" type="checkbox" data-id="${task.id}" ${checked}>
          <span class="form-check-label ${labelClass}">${escapeHtml(task.title)}${cat}</span>
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary task-remove" data-id="${task.id}">刪除</button>
      </label>`;
    }).join('');
  }

  function updateTaskGauge(percent){
    if(!taskGaugeFill || !taskGaugeText) return;
    const r = 28;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, percent));
    const offset = c * (1 - pct/100);
    taskGaugeFill.style.strokeDasharray = `${c.toFixed(2)}`;
    taskGaugeFill.style.strokeDashoffset = `${offset.toFixed(2)}`;
    taskGaugeText.textContent = pct + '%';
  }

  function addTask(title){
    const tasks = loadTasks();
    const category = taskCategoryInput?.value?.trim() || '';
    tasks.unshift({id: Date.now().toString(), title: title.trim(), category, completed: false, createdAt: Date.now()});
    saveTasks(tasks);
    renderTasks();
  }

  function toggleTaskCompleted(taskId, completed){
    const tasks = loadTasks();
    const updated = tasks.map(task => task.id === taskId ? {...task, completed} : task);
    saveTasks(updated);
    renderTasks();
  }

  function removeTask(taskId){
    const tasks = loadTasks().filter(task => task.id !== taskId);
    saveTasks(tasks);
    renderTasks();
  }

  function clearCompletedTasks(){
    const tasks = loadTasks().filter(task => !task.completed);
    saveTasks(tasks);
    renderTasks();
  }

  function escapeHtml(text){
    return text.replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  addTaskBtn?.addEventListener('click', ()=>{
    const text = taskInput?.value.trim();
    if(!text) return;
    addTask(text);
    if(taskInput) taskInput.value = '';
    if(taskCategoryInput) taskCategoryInput.value = '';
  });

  taskInput?.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      e.preventDefault();
      addTaskBtn?.click();
    }
  });

  taskList?.addEventListener('click', (e)=>{
    const target = e.target;
    if(target.matches('.task-toggle')){
      const id = target.dataset.id;
      toggleTaskCompleted(id, target.checked);
    }
    if(target.matches('.task-remove')){
      const id = target.dataset.id;
      removeTask(id);
    }
    // handle clicks on badge area (if user clicks the title span)
    if(target.matches('.form-check-label')){
      const checkbox = target.parentElement.querySelector('.task-toggle');
      if(checkbox){
        checkbox.checked = !checkbox.checked;
        toggleTaskCompleted(checkbox.dataset.id, checkbox.checked);
      }
    }
  });

  clearCompletedBtn?.addEventListener('click', ()=>{
    clearCompletedTasks();
  });

  function renderRecordList(sessionsOverride){
    const sessions = (sessionsOverride || loadSessions()).slice().sort((a,b)=>b.start - a.start);
    if(!recordList) return;
    if(!sessions.length){
      recordList.innerHTML = '<div class="text-muted">尚無記錄，請開始工作計時以建立專注紀錄。</div>';
      return;
    }
    recordList.innerHTML = sessions.slice(0, 6).map(s => {
      const start = formatDateTime(new Date(s.start));
      const end = formatDateTime(new Date(s.end));
      const minutes = Math.max(1, Math.round(s.duration/60));
      return `<div class="list-group-item">
        <div class="record-title">${start} - ${minutes} 分鐘</div>
        <div class="record-meta">結束時間：${end}</div>
      </div>`;
    }).join('');
  }

  function formatDateTime(date){
    const pad = n => String(n).padStart(2,'0');
    return `${date.getFullYear()}/${pad(date.getMonth()+1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // Stats generation
  function startChart(){
    statsChart = new Chart(statsCanvas, {
      type: 'bar',
      data: {labels:[], datasets:[{label:'專注時數（小時）', data:[], backgroundColor:'#0d6efd'}]},
      options: {responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true}}}
    });
  }

  function renderStats(view='day', sessionsOverride){
    const sessions = sessionsOverride || loadSessions();
    const now = new Date();
    if(view==='day'){
      // hourly totals for today
      const labels = Array.from({length:24}, (_,i)=>`${i}:00`);
      const data = new Array(24).fill(0);
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const endOfDay = startOfDay + 24*3600*1000;
      sessions.forEach(s=>{
        if(s.end > startOfDay && s.start < endOfDay){
          const localStart = Math.max(s.start, startOfDay);
          const localEnd = Math.min(s.end, endOfDay);
          // split into hours
          let t = localStart;
          while(t < localEnd){
            const hour = new Date(t).getHours();
            const nextHour = new Date(new Date(t).setMinutes(60,0,0)).getTime();
            const chunkEnd = Math.min(localEnd, nextHour);
            data[hour] += (chunkEnd - t)/3600/1000; // hours
            t = chunkEnd;
          }
        }
      });
      statsChart.data.labels = labels;
      statsChart.data.datasets[0].data = data.map(v=>Number(v.toFixed(2)));
      statsChart.options.scales.y.title = {display:true, text:'小時'};
      statsChart.update();
    } else if(view==='month'){
      // daily totals for current month
      const year = now.getFullYear(), month = now.getMonth();
      const days = new Date(year, month+1, 0).getDate();
      const labels = Array.from({length:days}, (_,i)=>`${i+1}`);
      const data = new Array(days).fill(0);
      const startOfMonth = new Date(year, month, 1).getTime();
      const endOfMonth = new Date(year, month, days,23,59,59).getTime();
      sessions.forEach(s=>{
        if(s.end > startOfMonth && s.start < endOfMonth){
          const localStart = Math.max(s.start, startOfMonth);
          const localEnd = Math.min(s.end, endOfMonth);
          let t = localStart;
          while(t < localEnd){
            const day = new Date(t).getDate();
            const nextDay = new Date(new Date(t).setHours(24,0,0,0)).getTime();
            const chunkEnd = Math.min(localEnd, nextDay);
            data[day-1] += (chunkEnd - t)/3600/1000;
            t = chunkEnd;
          }
        }
      });
      statsChart.data.labels = labels;
      statsChart.data.datasets[0].data = data.map(v=>Number(v.toFixed(2)));
      statsChart.options.scales.y.title = {display:true, text:'小時'};
      statsChart.update();
    } else {
      // year: monthly totals
      const year = now.getFullYear();
      const labels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
      const data = new Array(12).fill(0);
      const startOfYear = new Date(year,0,1).getTime();
      const endOfYear = new Date(year,11,31,23,59,59).getTime();
      sessions.forEach(s=>{
        if(s.end > startOfYear && s.start < endOfYear){
          const localStart = Math.max(s.start, startOfYear);
          const localEnd = Math.min(s.end, endOfYear);
          let t = localStart;
          while(t < localEnd){
            const month = new Date(t).getMonth();
            const nextMonth = new Date(new Date(t).getFullYear(), new Date(t).getMonth()+1,1).getTime();
            const chunkEnd = Math.min(localEnd, nextMonth);
            data[month] += (chunkEnd - t)/3600/1000;
            t = chunkEnd;
          }
        }
      });
      statsChart.data.labels = labels;
      statsChart.data.datasets[0].data = data.map(v=>Number(v.toFixed(2)));
      statsChart.options.scales.y.title = {display:true, text:'小時'};
      statsChart.update();
    }
  }
  // AI assistant
  openAIBtn.addEventListener('click', ()=>{
    aiModal.show();
  });
  closeAIModal.addEventListener('click', ()=> aiModal.hide());
  sendAI.addEventListener('click', async ()=>{
    const prompt = aiPrompt.value.trim();
    if(!prompt) return;
    await startAIStream(prompt);
  });

  // Record confirmation dialog
  closeRecordConfirm.addEventListener('click', ()=> recordConfirmModal.hide());
  skipRecordBtn.addEventListener('click', ()=>{
    recordConfirmModal.hide();
    pendingRecord = null;
    // Just reset without recording
    pauseTimer();
    workSeconds = parseInt(workMinutesInput.value||25)*60;
    breakSeconds = parseInt(breakMinutesInput.value||5)*60;
    remaining = (mode==='work')? workSeconds : breakSeconds;
    updateDisplay();
  });
  confirmRecordBtn.addEventListener('click', ()=>{
    if(pendingRecord && pendingRecord.mode === 'work'){
      addSession(pendingRecord.startTs, pendingRecord.endTs);
    }
    recordConfirmModal.hide();
    pendingRecord = null;
    // Reset after recording
    pauseTimer();
    workSeconds = parseInt(workMinutesInput.value||25)*60;
    breakSeconds = parseInt(breakMinutesInput.value||5)*60;
    remaining = (mode==='work')? workSeconds : breakSeconds;
    updateDisplay();
  });

  function setSpinner(show){
    if(!aiSpinner) return;
    aiSpinner.style.display = show ? 'inline-block' : 'none';
  }

  function getGuidance(prompt){
    const trimmed = String(prompt || '').trim();
    if(!trimmed){
      return '請先描述你的學習或專注狀況，讓我幫你整理下一步方向。';
    }
    const lower = trimmed.toLowerCase();
    if(lower.includes('專注') || lower.includes('注意力') || lower.includes('分心')){
      return '建議先設定 25 分鐘專注時段，期間關閉通知與分心來源，結束後再休息 5 分鐘。';
    }
    if(lower.includes('規劃') || lower.includes('計畫') || lower.includes('待辦')){
      return '你可以先寫下今天最重要的三件事，依優先順序安排時間，並把大任務拆成 10-15 分鐘的小步驟。';
    }
    if(lower.includes('學習') || lower.includes('讀書') || lower.includes('考試')){
      return '試試「先閱讀重點，再用自己的話整理，再練習」的模式，這樣能快速找到知識結構。';
    }
    if(lower.includes('休息') || lower.includes('疲勞') || lower.includes('累')){
      return '建議做 5 分鐘伸展與深呼吸休息，或改用番茄鐘模式短暫離開並回復專注。';
    }
    return '建議先把當前目標寫下來，選一件最重要的任務，專注完成 10-25 分鐘後再檢視成果。';
  }

  async function startAIStream(prompt){
    aiResponse.textContent = '生成方向建議...';
    setSpinner(true);
    try{
      await new Promise(resolve => setTimeout(resolve, 500));
      aiResponse.textContent = getGuidance(prompt);
    }catch(e){
      aiResponse.textContent = '發生錯誤，請稍後再試。';
    }finally{
      setSpinner(false);
    }
  }

  // Init
  function init(){
    workSeconds = parseInt(workMinutesInput.value||25)*60;
    breakSeconds = parseInt(breakMinutesInput.value||5)*60;
    remaining = workSeconds;
    updateDisplay();
    startChart();
    renderStats('day');
    renderRecordList();
    renderTasks();
    showPage('timer');
  }

  init();
  // expose for debugging
  window.FocusStats = {loadSessions, addSession, renderStats};

})();
