const express = require('express');
const cors = require('cors');
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

if(!process.env.OPENAI_API_KEY){
  console.warn('Warning: OPENAI_API_KEY not set. Set it in .env for proxying requests.');
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

  const apiKey = process.env.OPENAI_API_KEY;
  if(!apiKey) return res.status(500).json({error:'Server has no OPENAI_API_KEY configured.'});

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

  const apiKey = process.env.OPENAI_API_KEY;
  if(!apiKey){
    res.status(500).json({error:'Server has no OPENAI_API_KEY configured.'});
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
      res.write(`event:error\ndata:${txt}\n\n`);
      res.end();
      return;
    }

    // Forward streamed chunks from OpenAI to client as SSE
    const reader = openaiRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    while(!done){
      const {value, done: d} = await reader.read();
      done = d;
      if(value){
        const chunk = decoder.decode(value);
        // OpenAI already sends lines starting with 'data:'. Forward them.
        // Ensure proper SSE framing: each chunk should be followed by double newline.
        res.write(chunk);
      }
    }
    // signal end
    res.write('\nevent:end\ndata:[DONE]\n\n');
    res.end();
  }catch(err){
    console.error('SSE proxy error', err);
    try{ res.write(`event:error\ndata:${err.message}\n\n`); res.end(); }catch(e){}
  }
});

app.listen(PORT, () => {
  console.log(`AI proxy server listening on http://localhost:${PORT}`);
});
