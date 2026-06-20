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

  const openAIBtn = document.getElementById('openAIBtn');
  const aiModal = new bootstrap.Modal(document.getElementById('aiModal'));
  const closeAIModal = document.getElementById('closeAIModal');
  const sendAI = document.getElementById('sendAI');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const proxySecretInput = document.getElementById('proxySecretInput');
  const forceProxyCheck = document.getElementById('forceProxyCheck');
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
  }
  viewDay.addEventListener('click', ()=>{ setActiveView(viewDay); renderStats('day'); });
  viewMonth.addEventListener('click', ()=>{ setActiveView(viewMonth); renderStats('month'); });
  viewYear.addEventListener('click', ()=>{ setActiveView(viewYear); renderStats('year'); });

  // Stats generation
  function startChart(){
    statsChart = new Chart(statsCanvas, {
      type: 'bar',
      data: {labels:[], datasets:[{label:'專注時數（小時）', data:[], backgroundColor:'#0d6efd'}]},
      options: {responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true}}}
    });
  }

  function renderStats(view='day'){
    const sessions = loadSessions();
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
    const key = apiKeyInput.value.trim();
    const proxySecret = proxySecretInput.value.trim();
    const prompt = aiPrompt.value.trim();
    if(!prompt) return;
    aiResponse.textContent = '查詢中...';
    try{
      // 1) 若使用者選擇強制使用代理，直接呼叫後端；否則先試探 /health
      let backendAvailable = false;
      if(forceProxyCheck && forceProxyCheck.checked){
        backendAvailable = true;
      } else {
        try{
          const h = await fetch('/health');
          backendAvailable = h.ok;
        }catch(e){ backendAvailable = false; }
      }

      if(backendAvailable){
        // 呼叫後端代理
        const headers = {'Content-Type':'application/json'};
        if(proxySecret) headers['x-client-secret'] = proxySecret;
        const res = await fetch('/api/ai', {method:'POST', headers, body: JSON.stringify({prompt})});
        const data = await res.json();
        aiResponse.textContent = data?.choices?.[0]?.message?.content || JSON.stringify(data);
        return;
      }

      // 2) 若沒有代理可用，使用者有提供 OpenAI Key，則直接呼叫 OpenAI
      if(key){
        const res = await fetch('https://api.openai.com/v1/chat/completions',{
          method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
          body: JSON.stringify({model:'gpt-3.5-turbo', messages:[{role:'user', content:prompt}], max_tokens:800})
        });
        const data = await res.json();
        aiResponse.textContent = data?.choices?.[0]?.message?.content || JSON.stringify(data);
        return;
      }

      aiResponse.textContent = '未偵測到後端代理，且未提供 OpenAI API Key。請啟動代理或輸入 API Key。';
    }catch(e){
      aiResponse.textContent = '錯誤：'+e.message;
    }
  });

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
    if(prompt.length < 3) return; // avoid tiny requests
    setSpinner(true);
    try{
      // reuse logic: try backend first (respect forceProxyCheck and proxySecret)
      const key = apiKeyInput.value.trim();
      const proxySecret = proxySecretInput.value.trim();
      let backendAvailable = false;
      if(forceProxyCheck && forceProxyCheck.checked){ backendAvailable = true; }
      else {
        try{ const h = await fetch('/health'); backendAvailable = h.ok; }catch(e){ backendAvailable = false; }
      }
      if(backendAvailable){
        // If backend available, use SSE stream
        // Close previous EventSource if any
        if(currentEventSource){
          try{ currentEventSource.close(); }catch(e){}
          currentEventSource = null;
        }
        // build URL
        const params = new URLSearchParams({prompt});
        if(proxySecret) params.set('secret', proxySecret);
        const url = '/sse?' + params.toString();
        try{
          setSpinner(true);
          currentEventSource = new EventSource(url);
          aiResponse.textContent = '';
          currentEventSource.onmessage = (e)=>{
            // append chunked data
            aiResponse.textContent += e.data;
          };
          currentEventSource.onerror = (e)=>{
            setSpinner(false);
            try{ currentEventSource.close(); }catch(_){}
            currentEventSource = null;
          };
        }catch(e){
          setSpinner(false);
          aiResponse.textContent = 'SSE 連線失敗：'+e.message;
        }
        return;
      }
      if(key){
        const res = await fetch('https://api.openai.com/v1/chat/completions',{
          method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
          body: JSON.stringify({model:'gpt-3.5-turbo', messages:[{role:'user', content:prompt}], max_tokens:300})
        });
        const data = await res.json();
        aiResponse.textContent = data?.choices?.[0]?.message?.content || JSON.stringify(data);
      }
    }catch(e){ aiResponse.textContent = '錯誤：'+e.message; }
    finally{ setSpinner(false); }
  }, 600);

  aiPrompt.addEventListener('input', liveSend);

  // Init
  function init(){
    workSeconds = parseInt(workMinutesInput.value||25)*60;
    breakSeconds = parseInt(breakMinutesInput.value||5)*60;
    remaining = workSeconds;
    updateDisplay();
    startChart();
    renderStats('day');
  }

  init();
  // expose for debugging
  window.FocusStats = {loadSessions, addSession, renderStats};

})();
