import "dotenv/config";

import { supabase } from "./supabase.js";

const KAKAO_REST_API_KEY =
  process.env.KAKAO_REST_API_KEY;

if (!KAKAO_REST_API_KEY) {
  throw new Error(
    "KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.",
  );
}

// 수집하고 싶은 키워드 목록 (부산 지역 특화)
const keywords = ['부산 독립서점', '부산 공방', '부산 소품샵', '부산 문화공간'];

async function searchAndSave(keyword) {
  console.log(`🔍 '${keyword}' 검색 및 수집 시작...`);
  
  // 카카오 키워드 검색 API 호출
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(keyword)}&size=15`;
  
  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` }
  });

  const result = await response.json();

  if (!result.documents || result.documents.length === 0) {
    console.log(`⚠️ '${keyword}'에 대한 검색 결과가 없습니다.`);
    return;
  }

  // Supabase에 넣을 데이터 포맷으로 정리
  const placesToInsert = result.documents.map(item => ({
    name: item.place_name,
    address: item.address_name,
    latitude: parseFloat(item.y),  // y가 위도
    longitude: parseFloat(item.x), // x가 경도
    category: item.category_group_name || '문화공간',
    phone: item.phone || '정보 없음',
    url: item.place_url
  }));

  // Supabase DB에 한 번에 싹 밀어넣기(Insert)
  const { data, error } = await supabase
    .from('places')
    .insert(placesToInsert);

  if (error) {
    console.error(`❌ DB 저장 실패 (${keyword}):`, error.message);
  } else {
    console.log(`✅ '${keyword}' ${placesToInsert.length}개 장소 DB 저장 완료!`);
  }
}

async function run() {
  for (const keyword of keywords) {
    await searchAndSave(keyword);
  }
  console.log('🎉 모든 데이터 수집 및 DB 저장 작업이 끝났습니다!');
}

run();