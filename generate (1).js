export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { kana, roma, scriptType, learnedKana } = req.body;
    const isKata = scriptType === 'kata';
    const sn = isKata ? '片假名' : '平假名';
    const learnedList = learnedKana && learnedKana.length > 0
      ? `學生目前已學過的假名：${learnedKana.join('、')}。請只使用這些假名組成的單字出題，不要出現學生還沒學到的假名。`
      : `學生剛開始學習，目前只學了「${kana}」這個假名。請只用非常基礎、以「${kana}」為主的單字。`;

    const prompt = `你是日語老師，幫台灣學生學習五十音。假名「${kana}」（${sn}，羅馬字：${roma}）。

${learnedList}

回傳純JSON（不含markdown），格式：
{"vocab":[{"word":"單字","roma":"羅馬字","meaning":"中文"},{"word":"...","roma":"...","meaning":"..."},{"word":"...","roma":"...","meaning":"..."},{"word":"...","roma":"...","meaning":"..."},{"word":"...","roma":"...","meaning":"..."}],"scenes":[{"jp":"例句","roma":"羅馬字","zh":"中文","words":[{"w":"詞","m":"意思"}]},{"jp":"...","roma":"...","zh":"...","words":[...]},{"jp":"...","roma":"...","zh":"...","words":[...]}],"quiz":[{"q":"中文問題","opts":["A","B","C","D"],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0},{"q":"...","opts":[...],"ans":0}]}

規則：
- vocab：5個含「${kana}」的${sn}單字，只用已學假名
- scenes：3個含「${kana}」的日文例句，盡量只用已學假名的詞彙
- quiz：10道多元題型（單字意思/讀音/例句填空/用法），只考已學範圍
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
