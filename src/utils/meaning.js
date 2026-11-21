// 쉬운 뜻: 교육부 추천 초등 영단어 800의 원래 뜻(ko)은 그대로 두고, 어려운 말만 쉬운 말로 함께 보여 준다.
// 원래 뜻과 같은 단어는 데이터에 없다.
import easy from '../data/easy_meanings.json'

export const easyOf = (en) => easy[en] || null

// 검색: 원래 뜻이나 쉬운 뜻에 들어 있으면 찾는다
export const meaningIncludes = (word, term) => word.ko.includes(term) || (easyOf(word.en) || '').includes(term)
