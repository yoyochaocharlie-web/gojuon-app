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
      ? `學生已學假名：${learnedKana.join('、')}`
      : `學生剛學「${kana}」`;

    const prompt = `你是專業日語老師，幫台灣學生學習五十音。現在學習「${kana}」（${sn}，羅馬字：${roma}）。${learnedList}。

重要：vocab 必須是真實日文詞彙，不可以是單個假名重複（如「ああ」「うう」「いいい」等無意義的詞絕對禁止）。
必須使用真實存在、日常生活會用到的日文單字。例如「あ」的真實單字：あお（藍色）、あめ（雨）、あさ（早上）、あに（哥哥）、あし（腳）。

回傳純JSON（不含markdown）：
{
  "vocab": [
    {"word": "真實日文單字（至少2個假名以上）", "roma": "羅馬字", "meaning": "中文"},
    {"word": "...", "roma": "...", "meaning": "..."},
    {"word": "...", "roma": "...", "meaning": "..."},
    {"word": "...", "roma": "...", "meaning": "..."},
    {"word": "...", "roma": "...", "meaning": "..."}
  ],
  "lessons": [
    {
      "jp": "包含「${kana}」的自然日文例句",
      "roma": "完整羅馬字",
      "zh": "中文翻譯",
      "words": [{"w": "單詞", "m": "意思"}, {"w": "...", "m": "..."}],
      "quiz": {
        "q": "關於這個例句的問題（測試理解）",
        "opts": ["正確答案", "錯誤選項", "錯誤選項", "錯誤選項"],
        "ans": 0
      }
    },
    {
      "jp": "第二個例句",
      "roma": "...", "zh": "...",
      "words": [...],
      "quiz": {"q": "...", "opts": ["...", "...", "...", "..."], "ans": 0}
    },
    {
      "jp": "第三個例句",
      "roma": "...", "zh": "...",
      "words": [...],
      "quiz": {"q": "...", "opts": ["...", "...", "...", "..."], "ans": 0}
    }
  ],
  "extra_quiz": [
    {"q": "額外考題1", "opts": ["A", "B", "C", "D"], "ans": 0},
    {"q": "額外考題2", "opts": ["A", "B", "C", "D"], "ans": 1},
    {"q": "額外考題3", "opts": ["A", "B", "C", "D"], "ans": 2},
    {"q": "額外考題4", "opts": ["A", "B", "C", "D"], "ans": 0},
    {"q": "額外考題5", "opts": ["A", "B", "C", "D"], "ans": 3},
    {"q": "額外考題6", "opts": ["A", "B", "C", "D"], "ans": 1},
    {"q": "額外考題7", "opts": ["A", "B", "C", "D"], "ans": 2}
  ]
}

嚴格規則：
1. vocab 的 word 欄位必須是真實常用日文單字，至少2個字，絕對禁止重複假名（あああ、いいい等）
2. ${isKata ? '片假名單字用真實外來語，如コーヒー、テレビ、アイスクリーム等' : '平假名單字用真實和語，如あめ、いぬ、うみ、えき、おかあさん等'}
3. 例句要自然，日常生活真實會說的句子
4. 每個例句的 quiz 要測試該例句的關鍵單字或文法
5. extra_quiz 題型多樣：讀音判斷、意思選擇、情境選擇、句子填空
6. 所有 ans 都要是 0-3 的數字，對應 opts 陣列的正確答案索引
7. 只回傳 JSON，不要任何說明文字`;

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

    // Filter out bad vocab (single repeated chars)
    if (parsed.vocab) {
      parsed.vocab = parsed.vocab.filter(v => {
        const w = v.word;
        if (w.length < 2) return false;
        const unique = new Set(w.split('')).size;
        if (unique === 1) return false; // all same char like ああ
        return true;
      });
      // If less than 3 good vocab, add fallback
      if (parsed.vocab.length < 3) {
        const fallbacks = {
          'あ': [{word:'あめ',roma:'ame',meaning:'雨'},{word:'あお',roma:'ao',meaning:'藍色'},{word:'あさ',roma:'asa',meaning:'早上'}],
          'い': [{word:'いぬ',roma:'inu',meaning:'狗'},{word:'いえ',roma:'ie',meaning:'家'},{word:'いす',roma:'isu',meaning:'椅子'}],
          'う': [{word:'うみ',roma:'umi',meaning:'海'},{word:'うた',roma:'uta',meaning:'歌'},{word:'うし',roma:'ushi',meaning:'牛'}],
          'え': [{word:'えき',roma:'eki',meaning:'車站'},{word:'えん',roma:'en',meaning:'日圓'},{word:'えほん',roma:'ehon',meaning:'繪本'}],
          'お': [{word:'おちゃ',roma:'ocha',meaning:'茶'},{word:'おかあさん',roma:'okaasan',meaning:'媽媽'},{word:'おんがく',roma:'ongaku',meaning:'音樂'}],
        };
        if (fallbacks[kana]) parsed.vocab = [...parsed.vocab, ...fallbacks[kana]].slice(0,5);
      }
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
