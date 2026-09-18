/** Artwork from the approved reference. Text, controls and records remain real DOM. */
const ART = new Set(['logo','cloud','coin','cards','dice','rps','roulette','coffee','shirt','plane']);
export function artwork(name) {
  const span = document.createElement('span');
  span.className = `lucky-art art-${ART.has(name) ? name : 'cloud'}`;
  span.setAttribute('aria-hidden', 'true');
  return span;
}
export const TEMPLATES = Object.freeze([
  {id:'cafe',art:'coffee',category:'ごはん',title:'ランチどこに行く？',note:'気になっていたカフェに入ってみる？',method:'coin'},
  {id:'outfit',art:'shirt',category:'自分時間',title:'どっちの服を着る？',note:'今日は明るい色の服を着てみる？',method:'cards'},
  {id:'trip',art:'plane',category:'おでかけ',title:'週末どこに行く？',note:'次の休日、近くの街を散歩してみる？',method:'roulette'},
  {id:'lunch',art:'coffee',category:'ごはん',title:'いつもと違うメニュー',note:'今日はいつもと違うランチを注文してみる？',method:'dice'},
  {id:'walk',art:'plane',category:'おでかけ',title:'帰り道に、ちょっと寄り道',note:'帰り道に近くの公園へ寄ってみる？',method:'coin'},
  {id:'book',art:'cards',category:'自分時間',title:'気になっていた一冊',note:'気になっていた本を5分だけ読んでみる？',method:'cards'},
  {id:'music',art:'roulette',category:'自分時間',title:'新しい「好き」に出会う',note:'今日は聴いたことのない曲を1曲聴いてみる？',method:'roulette'},
  {id:'message',art:'rps',category:'ひとこと',title:'久しぶり、って送ってみる？',note:'しばらく会っていない友だちに近況を送ってみる？',method:'rps'},
  {id:'thanks',art:'cloud',category:'ひとこと',title:'ありがとうをひとこと',note:'お世話になった人に、ひとことお礼を伝えてみる？',method:'coin'},
  {id:'break',art:'coffee',category:'自分時間',title:'ひと息、いれてみよう',note:'今から5分、スマホを置いてひと息ついてみる？',method:'dice'},
  {id:'cook',art:'dice',category:'ごはん',title:'おうちで新しい一品',note:'今日は簡単な新しいレシピを試してみる？',method:'dice'},
  {id:'photo',art:'plane',category:'おでかけ',title:'今日の景色を一枚',note:'散歩しながら、気に入った景色を一枚撮ってみる？',method:'cards'}
]);
export const TEMPLATE_CATEGORIES = Object.freeze(['すべて','ごはん','おでかけ','自分時間','ひとこと']);
export function filterTemplates(query = '', category = 'すべて') {
  const words = String(query).normalize('NFKC').toLocaleLowerCase('ja').trim().split(/\s+/).filter(Boolean);
  return TEMPLATES.filter(t => (category === 'すべて' || t.category === category) && words.every(w => `${t.title} ${t.note} ${t.category}`.normalize('NFKC').toLocaleLowerCase('ja').includes(w)));
}
export function memoArt(note = '', theme = '') {
  const text = `${note} ${theme}`;
  if (/服|着|シャツ/.test(text)) return 'shirt';
  if (/旅|散歩|街|公園|道|おでかけ/.test(text)) return 'plane';
  if (/ごはん|カフェ|ランチ|店|コーヒー|料理|食/.test(text)) return 'coffee';
  return 'cloud';
}
