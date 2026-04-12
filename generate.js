export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { kana, roma, scriptType } = req.body;
    const isKata = scriptType === 'kata';
    const sn = isKata ? '片假名' : '平假名';

    const prompt = `你是日語老師，幫台灣學生學習五十音。假名「${kana}」（${sn}，羅馬字：${roma}）。

回傳純JSON（不含markdown），格式：
{"vocab":[{"word":"單字","roma":"羅馬字","meaning":"中文"},{"word":"...","roma":"...","meaning":"..."},{"word":"...","roma":"...","meaning":"..."},{"word":"...","roma":"...","meaning":"..."},{"word":"...","roma":"...","meaning":"..."}],"scenes":[{"jp":"例句","roma":"羅馬字","zh":"中文","words":[{"w":"詞","m":"意思"}]},{"jp":"...","roma":"...","zh":"...","words":[...]},{"jp":"...","roma":"...","zh":"...","words":[...]}],"quiz":[{"q":"中文問題","opts":["A","B","C","D"],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0}]}

規則：
- vocab：5個含「${kana}」的${sn}單字
- scenes：3個含「${kana}」的日文例句，附單詞拆解
- quiz：10道多元題型（單字意思/讀音/例句填空/用法）
- ${isKata ? '片假名：外來語、擬聲詞等片假名詞彙' : '平假名：和語詞彙'}
- ans為正確答案index(0-3)
- 只回傳JSON，不要其他文字`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: err });
    }

    const data = await response.json();
    const text = data.content.map(i => i.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
