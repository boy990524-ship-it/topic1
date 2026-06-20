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

  // Timer state
  let mode = 'work'; // 'work' or 'break'
  let workSeconds = parseInt(workMinutesInput.value || 25) * 60;
  let breakSeconds = parseInt(breakMinutesInput.value || 5) * 60;
  let remaining = workSeconds;
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
    pauseTimer();
    workSeconds = parseInt(workMinutesInput.value||25)*60;
    breakSeconds = parseInt(breakMinutesInput.value||5)*60;
    remaining = (mode==='work')? workSeconds : breakSeconds;
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
      const endTs = Date.now();
      const startTs = endTs - ((mode==='work')? (workSeconds*1000) : (breakSeconds*1000));
      if(mode === 'work'){
        // save a work session with actual duration (we approximate by configured duration)
        addSession(startTs, endTs);
      }
      // auto-switch to other mode
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
    if(mode==='work' && !running) remaining = workSeconds;
    updateDisplay();
  });
  breakMinutesInput.addEventListener('change', ()=>{
    breakSeconds = parseInt(breakMinutesInput.value||5)*60;
    if(mode==='break' && !running) remaining = breakSeconds;
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

  const apiBaseUrl = window.location.protocol === 'file:' ? 'http://localhost:3000' : '';

  // Live reply: send on input with debounce
  function setSpinner(show){
    if(!aiSpinner) return;
    aiSpinner.style.display = show ? 'inline-block' : 'none';
  }

  function debounce(fn, wait){
    let t;
    return (...args)=>{
      clearTimeout(t);
      t = setTimeout(()=>fn(...args), wait);
    };
  }

  const liveSend = debounce(async ()=>{
    if(!liveReplyCheck || !liveReplyCheck.checked) return;
    const prompt = aiPrompt.value.trim();
    if(prompt.length < 3) return;
    await startAIStream(prompt);
  }, 600);

  aiPrompt.addEventListener('input', liveSend);

  async function startAIStream(prompt){
    aiResponse.textContent = '查詢中...';
    setSpinner(true);
    try{
      if(currentEventSource){
        try{ currentEventSource.close(); }catch(e){}
        currentEventSource = null;
      }
      const params = new URLSearchParams({prompt});
      const url = `${apiBaseUrl}/sse?` + params.toString();
      let streamEnded = false;
      const eventSource = new EventSource(url);
      currentEventSource = eventSource;
      aiResponse.textContent = '';
      eventSource.onmessage = (e)=>{
        aiResponse.textContent += e.data.replace(/\n/g, '\n');
      };
      eventSource.addEventListener('sse_error', (e)=>{
        streamEnded = true;
        setSpinner(false);
        aiResponse.textContent = 'AI 服務錯誤：' + e.data;
        try{ eventSource.close(); }catch(_){ }
        if(currentEventSource === eventSource) currentEventSource = null;
      });
      eventSource.addEventListener('sse_end', ()=>{
        streamEnded = true;
        setSpinner(false);
        try{ eventSource.close(); }catch(_){ }
        if(currentEventSource === eventSource) currentEventSource = null;
      });
      eventSource.onerror = () =>{
        if(streamEnded) return;
        if(eventSource.readyState === EventSource.CLOSED) return;
        setSpinner(false);
        aiResponse.textContent = 'AI 服務連線中斷，請稍後再試。';
        try{ eventSource.close(); }catch(_){ }
        if(currentEventSource === eventSource) currentEventSource = null;
      };
    }catch(e){
      aiResponse.textContent = '錯誤：' + e.message;
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
    showPage('timer');
  }

  init();
  // expose for debugging
  window.FocusStats = {loadSessions, addSession, renderStats};

})();
