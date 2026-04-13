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
      ? `學生目前已學過的假名：${learnedKana.join('、')}。`
      : `學生目前只學了「${kana}」。`;

    const prompt = `你是專業日語老師，幫台灣學生學習五十音。現在學習的假名是「${kana}」（${sn}，羅馬字：${roma}）。

${learnedList}

請生成學習內容，回傳純JSON（不含markdown或說明文字）：

{
  "vocab": [
    {"word": "真實日文單字", "roma": "羅馬字", "meaning": "中文意思"},
    ...共5個
  ],
  "lessons": [
    {
      "jp": "日文例句",
      "roma": "羅馬字",
      "zh": "中文翻譯",
      "words": [{"w": "單詞", "m": "意思"}],
      "quiz": {
        "q": "關於這個例句的選擇題（中文）",
        "opts": ["選項A", "選項B", "選項C", "選項D"],
        "ans": 0
      }
    },
    ...共3個例句，每個例句配一道考題
  ],
  "extra_quiz": [
    {
      "q": "關於「${kana}」的額外考題",
      "opts": ["選項A", "選項B", "選項C", "選項D"],
      "ans": 0
    },
    ...共7道
  ]
}

嚴格規則：
- vocab：5個真實常用日文單字，必須包含「${kana}」這個假名，不可以只有單個假名或重複假名（如「ああ」「うう」這種沒意義的不行）
- 例句要自然，是日常生活真實會用的句子
- 每個例句直接配一道考題，考題要測試該例句的理解（填空/翻譯/單字意思）
- extra_quiz 額外7道考題，題型多樣：讀音、意思、填空、情境選擇
- 所有考題必須有明確正確答案，四個選項要合理（不能全是亂碼）
- ${isKata ? '片假名詞彙：用真實外來語片假名單字，如コーヒー、テレビ等' : '平假名詞彙：用真實和語詞彙'}
- ans 是正確答案的 index（0-3）
- 只回傳JSON，不要任何其他文字`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
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
