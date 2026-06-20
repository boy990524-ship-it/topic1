const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS: 若有設定 ALLOWED_ORIGINS，僅允許那些來源（逗號分隔）
const allowed = process.env.ALLOWED_ORIGINS;
if(allowed){
  const origins = allowed.split(',').map(s=>s.trim());
  app.use(cors({origin: origins}));
} else {
  app.use(cors());
}
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function getOpenAIKey(){
  const key = String(process.env.OPENAI_API_KEY || '').trim();
  if(!key) return null;
  const placeholderPattern = /your[_-]?openai[_-]?api[_-]?key|your[_-]?api[_-]?key|change[-_]?me|dummy/i;
  if(placeholderPattern.test(key)) return null;
  return key;
}

function createMockReply(prompt){
  const trimmed = String(prompt || '').trim();
  if(!trimmed){
    return '請提供問題內容，AI 才能幫你回答。';
  }
  const lower = trimmed.toLowerCase();
  if(lower.includes('你好') || lower.includes('hello') || lower.includes('hi')){
    return '你好！目前沒有設定 OpenAI 金鑰，但我仍可以提供本地模擬回答。';
  }
  if(lower.includes('功能') || lower.includes('可以做') || lower.includes('幹嘛')){
    return '這個專案可以作為番茄鐘與專注紀錄工具，並內建本地 AI 模擬回覆功能。';
  }
  return `這是本地模擬回覆，因為目前未設定 OpenAI API 金鑰。你剛剛問：${trimmed}`;
}

const OPENAI_API_KEY = getOpenAIKey();
if(!OPENAI_API_KEY){
  console.warn('Warning: OPENAI_API_KEY not set or is placeholder. Server will use local fallback AI responses.');
}

app.get('/health', (req, res) => res.json({status:'ok'}));

app.post('/api/ai', async (req, res) => {
  const prompt = req.body.prompt;
  const model = req.body.model || 'gpt-3.5-turbo';
  if(!prompt) return res.status(400).json({error:'prompt required'});

  // 若伺服器環境設定了 CLIENT_SECRET，要求前端在標頭帶上 x-client-secret
  const clientSecret = process.env.CLIENT_SECRET;
  if(clientSecret){
    const provided = req.get('x-client-secret') || '';
    if(provided !== clientSecret){
      return res.status(401).json({error:'Invalid client secret'});
    }
  }

  const apiKey = OPENAI_API_KEY;
  if(!apiKey){
    return res.json({
      id: 'local-fallback',
      object: 'chat.completion',
      choices: [{
        message: { role: 'assistant', content: createMockReply(prompt) }
      }]
    });
  }

  try{
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [ { role: 'user', content: prompt } ],
        max_tokens: 800
      })
    });
    const data = await resp.json();
    return res.json(data);
  }catch(err){
    console.error('AI proxy error', err);
    return res.status(500).json({error: err.message});
  }
});

// SSE endpoint: client opens EventSource to receive streaming AI response.
app.get('/sse', async (req, res) => {
  const prompt = req.query.prompt || req.query.q;
  if(!prompt) return res.status(400).json({error:'prompt required'});

  // client secret optional check
  const clientSecret = process.env.CLIENT_SECRET;
  if(clientSecret){
    const provided = req.query.secret || '';
    if(provided !== clientSecret){
      res.status(401).json({error:'Invalid client secret'});
      return;
    }
  }

  const apiKey = OPENAI_API_KEY;
  if(!apiKey){
    const message = createMockReply(prompt);
    res.setHeader('Content-Type','text/event-stream');
    res.setHeader('Cache-Control','no-cache');
    res.setHeader('Connection','keep-alive');
    res.flushHeaders && res.flushHeaders();
    const safe = message.replace(/\r?\n/g, '\\n');
    res.write(`data: ${safe}\n\n`);
    res.write('event:sse_end\ndata:[DONE]\n\n');
    res.end();
    return;
  }

  // Setup SSE headers
  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  res.flushHeaders && res.flushHeaders();

  try{
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{role:'user', content: prompt}],
        stream: true
      })
    });

    if(!openaiRes.ok){
      const txt = await openaiRes.text();
      res.write(`event:sse_error\ndata:${txt}\n\n`);
      res.end();
      return;
    }

    // Forward streamed chunks from OpenAI to client as SSE
    const reader = openaiRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let done = false;
    while(!done){
      const {value, done: d} = await reader.read();
      done = d;
      if(value){
        buffer += decoder.decode(value, {stream: true});
        // Split into lines
        const lines = buffer.split(/\r?\n/);
        // Keep last partial line in buffer
        buffer = lines.pop() || '';
        for(const line of lines){
          if(!line) continue;
          // OpenAI stream lines are prefixed with 'data: '
          const match = line.match(/^data:\s?(.*)$/);
          if(!match) continue;
          const payload = match[1];
          if(payload === '[DONE]'){
            res.write('event:sse_end\ndata:[DONE]\n\n');
            res.end();
            return;
          }
          try{
            const parsed = JSON.parse(payload);
            const delta = parsed?.choices?.[0]?.delta;
            const text = delta?.content || '';
            if(text){
              // send plain text delta as SSE data
              // escape any lone newlines by replacing with \n to keep SSE framing safe
              const safe = text.replace(/\r?\n/g, '\\n');
              res.write(`data: ${safe}\n\n`);
            }
          }catch(err){
            // ignore malformed JSON from chunks
          }
        }
      }
    }
    // if stream ended without explicit [DONE]
    try{ res.write('event:sse_end\ndata:[DONE]\n\n'); }catch(e){}
    try{ res.end(); }catch(e){}
  }catch(err){
    console.error('SSE proxy error', err);
    try{ res.write(`event:error\ndata:${err.message}\n\n`); res.end(); }catch(e){}
  }
});

app.listen(PORT, () => {
  console.log(`AI proxy server listening on http://localhost:${PORT}`);
});
