// Original messages are NOT quotations attributed to real people.
export const WORDS = Object.freeze([
  { id: 'w01', category: 'step', text: 'いつもと違う一歩が、\n今日の思い出になるかもしれない。', note: '大きな挑戦でなくても。気になるほうへ、少しだけ。' },
  { id: 'w02', category: 'step', text: '人生を変える前に、\n帰り道を変えてみる。', note: '無理なく、安全にできる寄り道から。' },
  { id: 'w03', category: 'step', text: '「ちょっと気になる」は、\n立派なきっかけ。', note: '始める理由は、それくらい小さくていい。' },
  { id: 'w04', category: 'rest', text: '今日は見送る。\nそれも、自分で選んだこと。', note: '動いた日だけが、大切な日ではありません。' },
  { id: 'w05', category: 'rest', text: '気持ちが追いつくまで、\n答えを出さなくていい。', note: '急がずに決めていい、小さな迷いのために。' },
  { id: 'w06', category: 'step', text: 'うまくいくかは、まだわからない。\nでも、気になった自分は本物。', note: 'その気持ちだけ、メモに残しておこう。' },
  { id: 'w07', category: 'step', text: 'いつもの外側は、\n案外すぐそばにある。', note: '初めての一曲。初めての一冊。そんな入口もある。' },
  { id: 'w08', category: 'rest', text: '結果はひとつ。\n選び方は、あなたのもの。', note: '偶然と違う答えを選んでも、何も間違っていません。' },
  { id: 'w09', category: 'step', text: '小さな「やってみた」が、\nあとで話したいことになる。', note: '面白かったことも、合わなかったことも、あなたの一ページ。' },
  { id: 'w10', category: 'rest', text: '何も変えない日にも、\nほっとする時間を。', note: '毎日新しいことをしなくても、大丈夫。' },
  { id: 'w11', category: 'step', text: '知らなかった「好き」に、\nまだ出会える。', note: 'いつものお気に入りも、新しい出会いも、どちらも大事に。' },
  { id: 'w12', category: 'rest', text: '勇気を出すことと、\n無理をすることは、別のこと。', note: '安心できる範囲を、自分で決めていい。' },
  { id: 'w13', category: 'step', text: 'たった一言で、\n会話が始まることもある。', note: '相手の気持ちも大切にしながら、あなたのペースで。' },
  { id: 'w14', category: 'rest', text: '昨日の自分と、\n違う答えでもいい。', note: '気持ちは変わるもの。その日の自分の声を聞いてみよう。' },
  { id: 'w15', category: 'step', text: '予定になかったことが、\n今日いちばんの話になるかも。', note: '「あのとき、やってみてよかった」が増えますように。' },
  { id: 'w16', category: 'rest', text: '何を選んでも、\n自分を責めるためには使わない。', note: 'luckyは、あなたを採点する場所ではありません。' },
  { id: 'w17', category: 'step', text: '小さな選択が、\nいい一日をつくる。', note: '大きな決断じゃなくても、今日の空気は少し変えられる。' },
  { id: 'w18', category: 'rest', text: 'がんばることもすてきだけど、\n休むこともだいじ。', note: '休む選択にも、ちゃんと意味があります。' },
  { id: 'w19', category: 'step', text: '今できることを、\nひとつずつでいい。', note: '一歩は、小さくても一歩。' },
  { id: 'w20', category: 'rest', text: 'きのうより少しでも、\nやさしい自分でいられたらそれでいい。', note: '比べるなら、昨日の自分と。' },
  { id: 'p01', category: 'proverb', text: '思い立ったが吉日', note: '「やってみよう」と決めた、その日を始める日に。気持ちが決まったときの言葉です。', source: 'https://www.kanjipedia.jp/kotoba/0002766600' },
  { id: 'p02', category: 'proverb', text: '急がば回れ', note: '近道を急ぐより、安心して進める道を。遠回りが助けになることもあります。', source: 'https://www.kanjipedia.jp/kotoba/0001390300' },
  { id: 'p03', category: 'proverb', text: '急いては事を仕損じる', note: '急ぐあまり見落とさないように。ひと呼吸おいてから選ぼう。', source: 'https://www.kanjipedia.jp/kotoba/0001393800' }
]);
export function dailyWord(key) {
  let hash = 0;
  for (const char of key) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  return WORDS[hash % WORDS.length];
}
