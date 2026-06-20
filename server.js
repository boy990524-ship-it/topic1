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

app.listen(PORT, () => {
  console.log(`AI proxy server listening on http://localhost:${PORT}`);
});
