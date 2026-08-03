export { };

// Supabase Edge Runtime에서 실제로 해석되는 JSR import다.
// Expo 프로젝트의 일반 TypeScript 서버는 jsr: 스킴을 모르므로 편집기 진단만 무시한다.
// @ts-ignore
  import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore
import { createClient } from "jsr:@supabase/supabase-js@2";

type DenoRuntime = {
  env: {
    get(name: string): string | undefined;
  };
  serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
};

const denoRuntime = (
  globalThis as unknown as { Deno: DenoRuntime }
).Deno;

type CostFilter = "무료" | "유료" | "무료/유료" | string;
type LocationType = "실내" | "실외" | "실내/실외" | string;

type AvailablePlace = {
  id?: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  distance?: number | string;
  district?: string;
  category?: string;
  categoryName?: string;
  category_name?: string;
  categoryGroupCode?: string;
  category_group_code?: string;
  categoryGroupName?: string;
  category_group_name?: string;
  kakaoCategoryName?: string;
  kakao_category_name?: string;
  kakaoCategoryGroupCode?: string;
  kakao_category_group_code?: string;
  kakaoCategoryGroupName?: string;
  kakao_category_group_name?: string;
  foodOnly?: boolean;
};

type RequestBody = {
  category?: string;
  categories?: string[];
  preferredCategories?: string[];
  interests?: string[];
  initialInterests?: string[];
  journeyGoal?: string;
  likedCategories?: string[];
  dislikedCategories?: string[];
  likedMissionExamples?: string[];
  dislikedMissionExamples?: string[];
  cost?: CostFilter;
  time?: string;
  estimatedDuration?: string;
  locationType?: LocationType;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  radius_km?: number;
  district?: string;
  gu?: string;
  availablePlaces?: AvailablePlace[];
  excludeTitles?: string[];
  excludeMissionIds?: string[];
  limit?: number;
  homeMissionLimit?: number;
  atHomeMissionLimit?: number;
  flexibleMissionLimit?: number;
  minimumFlexibleMissionCount?: number;
  flexiblePlaceAllowed?: boolean;
  generationInstruction?: string;
  recommendationReasonInstruction?: string;
  language?: string;
  locale?: string;
};

type AiMission = {
  category?: string;
  title?: string;
  description?: string;
  instructions?: string;
  recommendationReason?: string;
  recommendation_reason?: string;
  durationText?: string;
  costText?: string;
  place_name?: string | null;
  is_at_home?: boolean;
  is_flexible?: boolean;
  requires_place?: boolean;
  environment?: string;
  badge_ids?: string[];
  required_items?: string[];
};

type AppCategory =
  | "음식"
  | "카페 및 디저트"
  | "산책"
  | "배움"
  | "감상"
  | "활동"
  | "휴식"
  | "기타";

type FlexibleMissionExample = {
  category: AppCategory;
  title: string;
  description: string;
  instructions: string;
  recommendationReason: string;
  durationText: string;
  costText: string;
  requiredItems: string[];
};

type NormalizedPlace = {
  id?: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance?: number;
  district?: string;
  category: AppCategory;
  kakaoCategoryName?: string;
  kakaoCategoryGroupCode?: string;
  kakaoCategoryGroupName?: string;
  foodOnly: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseClient = createClient(
  denoRuntime.env.get("SUPABASE_URL")!,
  denoRuntime.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ALL_CATEGORIES = [
  "음식",
  "카페 및 디저트",
  "산책",
  "배움",
  "감상",
  "활동",
  "휴식",
  "기타",
] as const;

const CATEGORY_GROUP_CODES: Record<string, string[]> = {
  "카페 및 디저트": ["CE7"],
  음식: ["FD6", "MT1", "CS2"],
  산책: ["AT4"],
  배움: ["CT1", "AT4"],
  감상: ["CT1", "AT4"],
  활동: ["AT4", "MT1"],
  휴식: ["AD5", "AT4"],
  기타: [],
};

// Solar가 '어디서나 가능' 미션의 방향과 문장 스타일을 참고할 few-shot 예시다.
// 예시는 그대로 추천되는 고정 미션이 아니라, 매 생성 요청의 프롬프트에 참고 자료로 전달된다.
const FLEXIBLE_MISSION_EXAMPLES: FlexibleMissionExample[] = [
  {
    category: "산책",
    title: "오늘의 하늘",
    description: "오늘의 하늘을 사진으로 기록해보세요.",
    instructions:
      "지금 보이는 하늘을 사진으로 남겨보세요. 빛과 구름의 모습을 천천히 살펴보며 잠시 여유를 느낄 수 있을 거예요.",
    recommendationReason:
      "짧은 시간 동안 주변을 바라보며 기분을 환기하기 좋아요.",
    durationText: "3분",
    costText: "무료",
    requiredItems: ["휴대폰"],
  },
  {
    category: "산책",
    title: "계절을 담은 사진",
    description: "지금 계절의 모습을 사진으로 기록해보세요.",
    instructions:
      "주변에서 지금 계절이 잘 드러나는 풍경이나 사물을 찾아 사진으로 남겨보세요. 사계절의 사진이 하나씩 모이면 일상의 변화를 담은 좋은 추억이 될 거예요.",
    recommendationReason:
      "익숙한 주변에서도 계절의 새로운 모습을 발견하기 좋아요.",
    durationText: "5분",
    costText: "무료",
    requiredItems: ["휴대폰"],
  },
  {
    category: "감상",
    title: "주변의 소리 감상하기",
    description: "지금 있는 곳의 소리에 잠시 집중해보세요.",
    instructions:
      "잠시 하던 일을 멈추고 주변에서 들려오는 소리를 5분 동안 감상해보세요. 평소에는 지나쳤던 공간의 분위기와 새로운 소리를 발견할 수 있을 거예요.",
    recommendationReason:
      "특별한 준비 없이 현재 공간을 새롭게 느껴보기 좋아요.",
    durationText: "5분",
    costText: "무료",
    requiredItems: [],
  },
];

const BLOCKED_MISSION_TITLE_PATTERNS = [
  "천장구름관찰하기",
] as const;

const BLOCKED_MISSION_TEXT_PATTERNS = [
  /천장\s*(?:의|에|에서)?\s*구름/u,
  /구름.*천장/u,
] as const;

function isBlockedMissionText(value: unknown) {
  const text = String(value ?? "").trim();
  const normalized = normalizeComparableText(text);

  return (
    BLOCKED_MISSION_TITLE_PATTERNS.some(
      (pattern) => normalized.includes(pattern),
    ) ||
    BLOCKED_MISSION_TEXT_PATTERNS.some((pattern) =>
      pattern.test(text),
    )
  );
}

function isAiFlexibleMission(mission: AiMission) {
  const normalizedPlaceName = normalizeComparableText(
    mission.place_name,
  );

  return (
    mission.is_at_home !== true &&
    (mission.is_flexible === true ||
      mission.requires_place === false ||
      normalizedPlaceName === "어디서나가능")
  );
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeComparableText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()\[\]{}.,·'"“”‘’_-]/g, "");
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function inferCategory(text: string) {
  const normalized = text.replace(/\s+/g, " ").toLowerCase();

  if (/(카페|디저트|베이커리|빵집|커피|라떼|케이크|차 한 잔)/.test(normalized)) {
    return "카페 및 디저트";
  }
  if (/(음식|식사|맛집|요리|먹기|국밥|라면|국수|분식|한 끼)/.test(normalized)) {
    return "음식";
  }
  if (/(산책|걷기|공원|골목|해변|강변|둘레길|동네|자연)/.test(normalized)) {
    return "산책";
  }
  if (/(독서|책|공부|배우|학습|강의|도서관|서점|박물관|역사관|기념관|사찰|성당|교회|역사유적|문화재)/.test(normalized)) {
    return "배움";
  }
  if (/(음악|영화|공연|전시|버스킹|미술관|갤러리|감상|사진)/.test(normalized)) {
    return "감상";
  }
  if (/(운동|체험|만들기|공방|자전거|클라이밍|러닝|요가|춤|볼링)/.test(normalized)) {
    return "활동";
  }
  if (/(휴식|명상|호흡|낮잠|멍 때리|힐링|쉬기)/.test(normalized)) {
    return "휴식";
  }

  return "기타";
}

function normalizeCategory(value: unknown, fallbackText = "") {
  const category = String(value ?? "").trim();

  if (ALL_CATEGORIES.includes(category as (typeof ALL_CATEGORIES)[number])) {
    return category;
  }

  return inferCategory(`${category} ${fallbackText}`);
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }

  return "";
}

function isAppCategory(value: string): value is AppCategory {
  return ALL_CATEGORIES.includes(
    value as (typeof ALL_CATEGORIES)[number],
  );
}

function resolveKakaoPlaceCategory(
  place: AvailablePlace | Record<string, unknown>,
): {
  category: AppCategory;
  foodOnly: boolean;
  kakaoCategoryName?: string;
  kakaoCategoryGroupCode?: string;
  kakaoCategoryGroupName?: string;
} | null {
  const raw = place as AvailablePlace;
  const name = firstNonEmptyString(raw.name);
  const address = firstNonEmptyString(raw.address);
  const rawCategory = firstNonEmptyString(raw.category);
  const kakaoCategoryName = firstNonEmptyString(
    raw.kakao_category_name,
    raw.kakaoCategoryName,
    raw.category_name,
    raw.categoryName,
    isAppCategory(rawCategory) ? "" : rawCategory,
  );
  const kakaoCategoryGroupCode = firstNonEmptyString(
    raw.kakao_category_group_code,
    raw.kakaoCategoryGroupCode,
    raw.category_group_code,
    raw.categoryGroupCode,
  ).toUpperCase();
  const kakaoCategoryGroupName = firstNonEmptyString(
    raw.kakao_category_group_name,
    raw.kakaoCategoryGroupName,
    raw.category_group_name,
    raw.categoryGroupName,
  );
  const explicitAppCategory = [
    rawCategory,
    kakaoCategoryName,
  ].find(isAppCategory);
  const sourceText = `${kakaoCategoryName} ${kakaoCategoryGroupName} ${name} ${address}`
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const excludedPattern =
    /(병원|의원|치과|한의원|약국|은행|증권|보험|부동산|중개업|주차장|주유소|충전소|행정복지센터|주민센터|시청|구청|군청|경찰서|소방서|우체국|공공기관|공사|공단|법원|검찰청|세무서|관공서)/u;

  if (
    excludedPattern.test(sourceText) ||
    ["PK6", "OL7", "BK9", "AG2", "PO3", "HP8", "PM9"].includes(
      kakaoCategoryGroupCode,
    )
  ) {
    return null;
  }

  const build = (
    category: AppCategory,
    foodOnly = false,
  ) => ({
    category,
    foodOnly,
    kakaoCategoryName: kakaoCategoryName || undefined,
    kakaoCategoryGroupCode: kakaoCategoryGroupCode || undefined,
    kakaoCategoryGroupName: kakaoCategoryGroupName || undefined,
  });

  if (
    /(편의점|대형마트|슈퍼마켓|식료품점|식자재마트|마트)/u.test(
      sourceText,
    ) ||
    ["MT1", "CS2"].includes(kakaoCategoryGroupCode)
  ) {
    return build("음식", true);
  }

  if (
    /(카페|커피전문점|커피숍|찻집|전통찻집|베이커리|제과점|빵집|디저트|아이스크림|케이크)/u.test(
      sourceText,
    ) ||
    kakaoCategoryGroupCode === "CE7"
  ) {
    return build("카페 및 디저트");
  }

  if (
    /(음식점|한식|중식|일식|양식|분식|패스트푸드|치킨|피자|국수|냉면|고기집|식당|레스토랑|뷔페|샐러드|김밥|도시락)/u.test(
      sourceText,
    ) ||
    kakaoCategoryGroupCode === "FD6"
  ) {
    return build("음식");
  }

  if (
    /(영화관|공연장|극장|콘서트홀|아트홀|문화예술회관|버스킹|공연무대|미술관|갤러리|전시장|전시관|아쿠아리움|수족관|동물원|오페라|뮤지컬)/u.test(
      sourceText,
    )
  ) {
    return build("감상");
  }

  if (
    /(도서관|서점|과학관|천문대|박물관|역사관|기념관|사찰|성당|교회|역사유적|유적지|문화재|향교|서원|고택|생가|기념비)/u.test(
      sourceText,
    )
  ) {
    return build("배움");
  }

  if (
    /(공원|산책로|둘레길|해변|해수욕장|숲|수목원|정원|강변|하천|호수|생태공원|자연휴양림|등산로|전망대|광장|수변공원)/u.test(
      sourceText,
    )
  ) {
    return build("산책");
  }

  if (
    /(마사지|피부관리|피부미용|미용실|헤어샵|네일숍|네일샵|스파|찜질방|사우나|온천|호텔|펜션|게스트하우스|리조트|모텔|숙박|휴양소)/u.test(
      sourceText,
    ) ||
    kakaoCategoryGroupCode === "AD5"
  ) {
    return build("휴식");
  }

  if (
    /(소품샵|소품점|문구점|전통시장|시장|쇼핑몰|백화점|아울렛|편집숍|공방|체험장|체육시설|운동장|헬스장|수영장|볼링장|클라이밍|노래방|오락실|pc방|피시방|놀이공원|테마파크|캠핑장|낚시터|자전거|사진관|포토부스|스케이트장|야구장|축구장|테니스장|골프장)/u.test(
      sourceText,
    )
  ) {
    return build("활동");
  }

  if (explicitAppCategory && explicitAppCategory !== "기타") {
    return build(explicitAppCategory);
  }

  console.warn(
    "앱 카테고리로 확정하지 못한 카카오 장소를 추천에서 제외합니다:",
    {
      name,
      kakaoCategoryName,
      kakaoCategoryGroupCode,
      kakaoCategoryGroupName,
    },
  );
  return null;
}

function isFoodMissionText(value: string) {
  return /(먹|맛보|음식|식사|간식|메뉴|도시락|과자|음료|식재료|장보기|구매|골라|신제품|시그니처)/u.test(
    value.replace(/\s+/g, " ").toLowerCase(),
  );
}

function isMissionTextCompatibleWithPlace(
  missionCategory: string,
  place: NormalizedPlace,
  missionText: string,
) {
  const normalizedText = missionText
    .replace(/\s+/g, " ")
    .toLowerCase();

  // 실제 장소 미션의 최종 카테고리는 카카오 상세 카테고리와 정확히 같아야 한다.
  if (missionCategory !== place.category) {
    return false;
  }

  if (place.foodOnly) {
    return isFoodMissionText(normalizedText);
  }

  if (place.category === "카페 및 디저트") {
    return (
      /(카페|커피|차|음료|디저트|빵|케이크|메뉴|맛|주문|시그니처|분위기)/u.test(
        normalizedText,
      ) &&
      !/(명상|호흡\s*운동|요가|러닝|달리기|낮잠|스트레칭|근력\s*운동)/u.test(
        normalizedText,
      )
    );
  }

  if (place.category === "음식") {
    return (
      isFoodMissionText(normalizedText) &&
      !/(명상|요가|러닝|낮잠|독서|공부)/u.test(normalizedText)
    );
  }

  if (place.category === "감상") {
    return /(감상|관람|전시|공연|영화|작품|무대|버스킹|둘러보|바라보|관찰)/u.test(
      normalizedText,
    );
  }

  if (place.category === "배움") {
    return /(배우|알아보|읽|역사|문화|건축|유래|탐방|관찰|지식|이야기)/u.test(
      normalizedText,
    );
  }

  if (place.category === "산책") {
    return /(걷|산책|풍경|자연|둘러보|살펴보|사진|관찰|탐방)/u.test(
      normalizedText,
    );
  }

  if (place.category === "활동") {
    return /(체험|활동|운동|만들|고르|구경|쇼핑|타기|도전|참여|노래|게임|찾아|발견|둘러보)/u.test(
      normalizedText,
    );
  }

  if (place.category === "휴식") {
    return /(쉬|휴식|여유|관리|마사지|미용|숙박|머물|편안|재충전|헤어|머리|네일|피부|스타일|손질|케어|꾸며|변신|체크인|숙소|하룻밤)/u.test(
      normalizedText,
    );
  }

  return false;
}

function parseDurationMinutes(value: unknown) {
  const text = String(value ?? "").trim();
  const direct = Number.parseInt(text, 10);

  if (Number.isFinite(direct) && direct > 0) {
    if (/시간/.test(text) && !/분/.test(text)) {
      return direct * 60;
    }
    return direct;
  }

  return 20;
}

function extractNaturalSentences(
  value: unknown,
) {
  const prepared = String(value ?? "")
    .replace(/\r/g, "\n")
    .replace(
      /^\s*(?:미션\s*)?(?:수행\s*)?(?:방법|안내|설명)\s*[:：-]?\s*/i,
      "",
    )
    .replace(
      /(?:^|\n|\s)(?:\(?\d{1,2}\)?\s*[.)]|[-•▪◦])\s*/g,
      "\n",
    )
    .replace(/[;；]+/g, ".\n")
    .replace(/([.!?。！？])\s*/g, "$1\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

  if (!prepared) {
    return [];
  }

  return prepared
    .split(/\n+/)
    .map((sentence) =>
      sentence
        .replace(/\s+/g, " ")
        .replace(
          /^(?:먼저|다음으로|그다음|마지막으로|이후에|그 후에)\s*/u,
          "",
        )
        .replace(/[.!?。！？]+$/g, "")
        .trim(),
    )
    .filter(Boolean);
}

function finishSentence(
  value: string,
) {
  const sentence = value
    .replace(/\s+/g, " ")
    .replace(/[.!?。！？]+$/g, "")
    .trim();

  return sentence ? `${sentence}.` : "";
}

function isPoliteEnding(
  value: string,
) {
  return /(?:요|죠|세요|까요|니다|예요|이에요|거예요|돼요|있어요|좋아요)$/u.test(
    value.replace(/[.!?。！？]+$/g, "").trim(),
  );
}

function toFriendlyActionSentence(
  value: string,
) {
  let sentence = value
    .replace(/\s+/g, " ")
    .replace(/[.!?。！？]+$/g, "")
    .trim();

  if (!sentence) {
    return "";
  }

  sentence = sentence
    .replace(/방문합니다$/u, "방문해보세요")
    .replace(/이동합니다$/u, "가보세요")
    .replace(/선택합니다$/u, "골라보세요")
    .replace(/고릅니다$/u, "골라보세요")
    .replace(/주문합니다$/u, "주문해보세요")
    .replace(/도전합니다$/u, "도전해보세요")
    .replace(/체험합니다$/u, "체험해보세요")
    .replace(/감상합니다$/u, "감상해보세요")
    .replace(/관찰합니다$/u, "천천히 살펴보세요")
    .replace(/살펴봅니다$/u, "천천히 살펴보세요")
    .replace(/기록합니다$/u, "기록해보세요")
    .replace(/촬영합니다$/u, "사진으로 남겨보세요")
    .replace(/찍습니다$/u, "사진으로 남겨보세요")
    .replace(/먹습니다$/u, "맛보세요")
    .replace(/마십니다$/u, "마셔보세요")
    .replace(/걷습니다$/u, "걸어보세요")
    .replace(/읽습니다$/u, "읽어보세요")
    .replace(/듣습니다$/u, "들어보세요")
    .replace(/만듭니다$/u, "만들어보세요")
    .replace(/느낍니다$/u, "느껴보세요")
    .replace(/해\s*주세요$/u, "해보세요")
    .replace(/해주세요$/u, "해보세요")
    .replace(/해\s*보세요$/u, "해보세요")
    .replace(/하세요$/u, "해보세요")
    .replace(/합니다$/u, "해보세요")
    .replace(/한다$/u, "해보세요")
    .replace(/해요$/u, "해보세요");

  if (!isPoliteEnding(sentence)) {
    return "";
  }

  return finishSentence(sentence);
}

function toPoliteBenefitSentence(
  value: string,
) {
  let sentence = value
    .replace(/\s+/g, " ")
    .replace(/[.!?。！？]+$/g, "")
    .trim();

  if (!sentence) {
    return "";
  }

  sentence = sentence
    .replace(/느낄 수 있다$/u, "느낄 수 있을 거예요")
    .replace(/발견할 수 있다$/u, "발견할 수 있을 거예요")
    .replace(/즐길 수 있다$/u, "즐길 수 있을 거예요")
    .replace(/경험할 수 있다$/u, "경험할 수 있을 거예요")
    .replace(/도움이 된다$/u, "도움이 돼요")
    .replace(/좋다$/u, "좋아요")
    .replace(/특별하다$/u, "특별해요")
    .replace(/새롭다$/u, "새로울 거예요")
    .replace(/있다$/u, "있을 거예요")
    .replace(/됩니다$/u, "돼요")
    .replace(/입니다$/u, "이에요");

  if (!isPoliteEnding(sentence)) {
    return "";
  }

  return finishSentence(sentence);
}

function normalizeShortDescription(
  value: unknown,
) {
  const first =
    extractNaturalSentences(value)[0] ?? "";

  if (!first) {
    return "";
  }

  const polite =
    toPoliteBenefitSentence(first) ||
    toFriendlyActionSentence(first);

  return polite || "";
}

function normalizeRecommendationReason(
  value: unknown,
) {
  const fallback =
    "지금의 취향과 상황에 부담 없이 시도하기 좋아 추천드려요.";

  const first =
    extractNaturalSentences(value)[0] ?? "";

  if (!first) {
    return fallback;
  }

  let sentence = first
    .replace(/(?:\.{3,}|…+)/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?。！？]+$/g, "")
    .trim();

  sentence = sentence
    .replace(/하기\s*좋음$/u, "하기 좋아요")
    .replace(/하기\s*좋다$/u, "하기 좋아요")
    .replace(/에\s*적합함$/u, "에 잘 맞아요")
    .replace(/에\s*적합하다$/u, "에 잘 맞아요")
    .replace(/도움이\s*됨$/u, "도움이 돼요")
    .replace(/도움이\s*된다$/u, "도움이 돼요")
    .replace(/추천함$/u, "추천드려요")
    .replace(/추천한다$/u, "추천드려요")
    .replace(/할 수 있다$/u, "할 수 있어요")
    .replace(/느낄 수 있다$/u, "느낄 수 있어요")
    .replace(/좋다$/u, "좋아요");

  if (!isPoliteEnding(sentence)) {
    return fallback;
  }

  // 추천 이유는 카드에서 한 줄로 읽히도록 한 문장만 사용한다.
  if (sentence.length > 72) {
    return fallback;
  }

  return finishSentence(sentence);
}

function cleanAiInstructions(value: unknown) {
  // AI가 만든 문장을 내용 수정 없이 저장한다.
  // 줄바꿈과 중복 공백만 화면 표시를 위해 정리한다.
  return String(value ?? "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEstimatedCost(value: unknown) {
  const text = String(value ?? "").trim();

  if (!text || /무료/.test(text)) {
    return 0;
  }

  const numericText = text.replace(/[^0-9]/g, "");
  const parsed = Number.parseInt(numericText, 10);
  return Number.isFinite(parsed) ? parsed : 5000;
}

function normalizePlaces(value: unknown): NormalizedPlace[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const result: NormalizedPlace[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== "object") {
      continue;
    }

    const place = raw as AvailablePlace;
    const name = String(place.name ?? "").trim();
    const lat = toFiniteNumber(place.latitude ?? place.lat);
    const lng = toFiniteNumber(place.longitude ?? place.lng);

    if (!name || lat === null || lng === null) {
      continue;
    }

    const categoryResolution = resolveKakaoPlaceCategory(place);
    if (!categoryResolution) {
      continue;
    }

    const key = `${normalizeComparableText(name)}:${lat.toFixed(5)}:${lng.toFixed(5)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    result.push({
      id: place.id ? String(place.id) : undefined,
      name,
      address: String(place.address ?? "").trim(),
      lat,
      lng,
      distance: toFiniteNumber(place.distance) ?? undefined,
      district: place.district
        ? String(place.district).trim()
        : undefined,
      category: categoryResolution.category,
      kakaoCategoryName: categoryResolution.kakaoCategoryName,
      kakaoCategoryGroupCode:
        categoryResolution.kakaoCategoryGroupCode,
      kakaoCategoryGroupName:
        categoryResolution.kakaoCategoryGroupName,
      foodOnly:
        place.foodOnly === true || categoryResolution.foodOnly,
    });
  }

  return result;
}

async function searchNearbyPlaces(
  categories: string[],
  latitude: number,
  longitude: number,
): Promise<NormalizedPlace[]> {
  const kakaoKey = denoRuntime.env.get("KAKAO_REST_API_KEY");
  if (!kakaoKey) {
    console.warn("KAKAO_REST_API_KEY가 없어 장소 검색을 건너뜁니다.");
    return [];
  }

  const categoryCodes = Array.from(
    new Set(
      categories
        .flatMap(
          (category) => CATEGORY_GROUP_CODES[category] ?? [],
        )
        .filter(Boolean),
    ),
  ).slice(0, 8);

  if (categoryCodes.length === 0) {
    categoryCodes.push("CE7", "FD6", "AT4", "CT1", "AD5", "MT1", "CS2");
  }

  const responses = await Promise.all(
    categoryCodes.map(async (groupCode) => {
      const url = new URL(
        "https://dapi.kakao.com/v2/local/search/category.json",
      );
      url.searchParams.set("category_group_code", groupCode);
      url.searchParams.set("x", String(longitude));
      url.searchParams.set("y", String(latitude));
      url.searchParams.set("radius", "3000");
      url.searchParams.set("sort", "distance");
      url.searchParams.set("size", "15");

      const response = await fetch(url, {
        headers: { Authorization: `KakaoAK ${kakaoKey}` },
      });

      if (!response.ok) {
        console.error(
          "카카오 로컬 API 실패:",
          groupCode,
          response.status,
          await response.text(),
        );
        return [];
      }

      const data = await response.json();
      return Array.isArray(data.documents) ? data.documents : [];
    }),
  );

  return normalizePlaces(
    responses.flat().map((place: any) => ({
      id: place.id,
      name: place.place_name,
      address: place.road_address_name || place.address_name,
      latitude: Number.parseFloat(place.y),
      longitude: Number.parseFloat(place.x),
      distance: Number.parseFloat(place.distance),
      categoryName: place.category_name,
      categoryGroupCode: place.category_group_code,
      categoryGroupName: place.category_group_name,
    })),
  ).slice(0, 60);
}

function buildPlacesPrompt(places: NormalizedPlace[]) {
  if (places.length === 0) {
    return "사용 가능한 실제 장소가 없습니다. 이 경우 모든 미션을 '내 방' 또는 '어디서나 가능' 미션으로 만들어주세요.";
  }

  return places
    .slice(0, 40)
    .map((place, index) => {
      const parts = [
        `${index + 1}. ${place.name}`,
        `앱 카테고리: ${place.category}`,
        place.kakaoCategoryName
          ? `카카오 상세 카테고리: ${place.kakaoCategoryName}`
          : "",
        place.foodOnly
          ? "사용 조건: 먹거리 관련 미션에만 사용 가능"
          : "",
        place.address ? `주소: ${place.address}` : "",
        place.district ? `지역: ${place.district}` : "",
      ].filter(Boolean);

      return parts.join(" | ");
    })
    .join("\n");
}

function buildFlexibleMissionExamplesPrompt(
  categories: string[],
) {
  const categorySet = new Set(
    categories.map((category) =>
      normalizeCategory(category, category),
    ),
  );

  const matchingExamples = FLEXIBLE_MISSION_EXAMPLES
    .filter((example) => categorySet.has(example.category))
    .slice(0, 8);

  if (matchingExamples.length === 0) {
    return "현재 선택된 카테고리에 해당하는 참고 예시는 없습니다.";
  }

  return matchingExamples
    .map((example, index) =>
      [
        `${index + 1}.`,
        `카테고리: ${example.category}`,
        `제목: ${example.title}`,
        `설명: ${example.description}`,
        `미션 안내: ${example.instructions}`,
        `추천 이유: ${example.recommendationReason}`,
        `예상 시간: ${example.durationText}`,
        `비용: ${example.costText}`,
        `준비물: ${
          example.requiredItems.length > 0
            ? example.requiredItems.join(", ")
            : "없음"
        }`,
      ].join("\n"),
    )
    .join("\n\n");
}

function extractJsonObject(raw: string) {
  const withoutFence = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");

  if (firstBrace < 0 || lastBrace < firstBrace) {
    throw new Error("AI 응답에서 JSON 객체를 찾지 못했습니다.");
  }

  return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
}

function findMatchingPlace(
  placeName: unknown,
  places: NormalizedPlace[],
) {
  const target = normalizeComparableText(placeName);
  if (!target) {
    return null;
  }

  return (
    places.find(
      (place) => normalizeComparableText(place.name) === target,
    ) ??
    places.find((place) => {
      const candidate = normalizeComparableText(place.name);
      return candidate.includes(target) || target.includes(candidate);
    }) ??
    null
  );
}

function chooseFallbackPlace(
  category: string,
  missionText: string,
  places: NormalizedPlace[],
  usedPlaceNames: Set<string>,
) {
  return (
    places.find(
      (place) =>
        !usedPlaceNames.has(normalizeComparableText(place.name)) &&
        isMissionTextCompatibleWithPlace(
          category,
          place,
          missionText,
        ),
    ) ?? null
  );
}

async function callUpstage({
  apiKey,
  systemPrompt,
  userPrompt,
  attempt,
}: {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  attempt: number;
}) {
  const model = "solar-pro";
  const retryInstruction =
    attempt === 1
      ? ""
      : "\n\n이전 응답을 사용할 수 없었습니다. 반드시 missions 배열을 포함한 유효한 JSON 객체만 반환하세요. instructions는 번호나 단계형 지시문이 아닌 자연스러운 미션 소개로 쓰세요. 반드시 정확히 2문장으로 작성합니다. 첫 문장은 무엇을 할지 부드럽게 권유하고, 둘째 문장은 경험의 매력이나 기대를 설명하세요. 세 번째 문장은 절대 작성하지 마세요. 모든 문장은 높임말로 작성하세요. recommendationReason은 높임말 한 문장만 작성하세요. 실제 장소 미션의 category는 장소 목록의 앱 카테고리와 정확히 같아야 합니다. 장소의 업종·성격과 행동도 반드시 맞아야 하며, 카페에서 명상·운동을 시키거나 음식점에서 독서·명상을 시키지 마세요. 마크다운 코드블록과 설명은 절대 쓰지 마세요.";

  const response = await fetch(
    "https://api.upstage.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `${userPrompt}${retryInstruction}`,
          },
        ],
        temperature: attempt === 1 ? 0.75 : 0.35,
      }),
    },
  );

  const responseText = await response.text();
  console.log("Upstage 모델:", model);
  console.log("Upstage 응답 상태:", response.status);
  console.log("Upstage 원본 응답:", responseText.slice(0, 5000));

  if (!response.ok) {
    throw new Error(
      `Upstage 호출 실패 (${response.status}): ${responseText.slice(0, 1200)}`,
    );
  }

  const responseData = JSON.parse(responseText);
  const content = responseData.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(
      `Upstage 응답에 content가 없습니다: ${responseText.slice(0, 1200)}`,
    );
  }

  const parsed = extractJsonObject(String(content));
  const missions = Array.isArray(parsed.missions)
    ? (parsed.missions as AiMission[])
    : [];

  if (missions.length === 0) {
    throw new Error(
      `AI가 미션을 반환하지 않았습니다: ${String(content).slice(0, 1200)}`,
    );
  }

  return missions;
}

denoRuntime.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "POST 요청만 지원합니다." }, 405);
  }

  try {
    const upstageApiKey = denoRuntime.env.get("UPSTAGE_API_KEY");
    if (!upstageApiKey) {
      return jsonResponse(
        { error: "UPSTAGE_API_KEY가 설정되지 않았습니다." },
        500,
      );
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;

    // categories는 사용자가 허용한 생성 범위이고,
    // 관심사와 호불호는 그 범위 안에서 우선순위를 정하는 신호다.
    const requestedCategories = Array.from(
      new Set(
        normalizeStringArray(body.categories)
          .map((category) => normalizeCategory(category, category))
          .filter(Boolean),
      ),
    );

    const singleCategory = String(body.category ?? "").trim();
    const categories =
      singleCategory &&
      singleCategory !== "전체" &&
      singleCategory !== "상관없음"
        ? [normalizeCategory(singleCategory, singleCategory)]
        : requestedCategories.length > 0
          ? requestedCategories
          : [...ALL_CATEGORIES];

    const initialInterests = Array.from(
      new Set(
        [
          ...normalizeStringArray(body.initialInterests),
          ...normalizeStringArray(body.interests),
        ]
          .map((category) => normalizeCategory(category, category))
          .filter((category) => categories.includes(category)),
      ),
    );
    const likedCategories = Array.from(
      new Set(
        normalizeStringArray(body.likedCategories)
          .map((category) => normalizeCategory(category, category))
          .filter((category) => categories.includes(category)),
      ),
    );
    const dislikedCategories = Array.from(
      new Set(
        normalizeStringArray(body.dislikedCategories)
          .map((category) => normalizeCategory(category, category))
          .filter((category) => categories.includes(category)),
      ),
    );
    const preferredCategories = Array.from(
      new Set(
        [
          ...normalizeStringArray(body.preferredCategories),
          ...likedCategories,
          ...initialInterests,
        ]
          .map((category) => normalizeCategory(category, category))
          .filter(
            (category) =>
              categories.includes(category) &&
              !dislikedCategories.includes(category),
          ),
      ),
    );
    const journeyGoal = String(body.journeyGoal ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);
    const likedMissionExamples = normalizeStringArray(
      body.likedMissionExamples,
    ).slice(0, 6);
    const dislikedMissionExamples = normalizeStringArray(
      body.dislikedMissionExamples,
    ).slice(0, 6);

    const requestedLimit = toFiniteNumber(body.limit) ?? 10;
    const missionCount = clamp(Math.round(requestedLimit), 4, 10);
    const homeMissionLimit = clamp(
      Math.round(
        toFiniteNumber(body.homeMissionLimit) ??
          toFiniteNumber(body.atHomeMissionLimit) ??
          2,
      ),
      0,
      2,
    );
    const flexibleMissionLimit = body.flexiblePlaceAllowed === false
      ? 0
      : clamp(
          Math.round(
            toFiniteNumber(body.flexibleMissionLimit) ?? 3,
          ),
          0,
          3,
        );

    const minimumFlexibleMissionCount =
      flexibleMissionLimit === 0
        ? 0
        : clamp(
            Math.round(
              toFiniteNumber(
                body.minimumFlexibleMissionCount,
              ) ?? 2,
            ),
            0,
            flexibleMissionLimit,
          );

    const latitude = toFiniteNumber(body.latitude);
    const longitude = toFiniteNumber(body.longitude);

    let places = normalizePlaces(body.availablePlaces);

    if (
      places.length === 0 &&
      latitude !== null &&
      longitude !== null
    ) {
      places = await searchNearbyPlaces(
        categories,
        latitude,
        longitude,
      );
    }

    places = places.filter((place) =>
      categories.includes(place.category),
    );

    console.log("요청 카테고리:", categories.join(", "));
    console.log("초기 관심 카테고리:", initialInterests.join(", "));
    console.log("최근 선호 카테고리:", likedCategories.join(", "));
    console.log("최근 비선호 카테고리:", dislikedCategories.join(", "));
    console.log("이번 여정 목표:", journeyGoal || "없음");
    console.log("요청 좌표:", latitude, longitude);
    console.log("카카오 상세 카테고리 적용 후 장소 수:", places.length);

    const excludedTitles = normalizeStringArray(body.excludeTitles);
    const categoryText = categories.join(", ");
    const placePrompt = buildPlacesPrompt(places);
    const flexibleMissionExamplesPrompt =
      buildFlexibleMissionExamplesPrompt(categories);

    const systemPrompt = `
너는 사용자의 일상 속 작은 행복과 의미를 찾는 챌린지 미션 추천 AI다.
사용자가 직접 실행할 수 있는 안전하고 구체적인 한국어 미션을 만들어야 한다.

[절대 생성하지 말아야 할 미션]
1. 야생동물, 무지개 등 운에 따라 성공 여부가 달라지는 미션
2. 실제로 존재하기 힘든 생물이나 장소를 요구하는 미션
3. 개인의 신체나 안전에 위험을 주는 행동
4. 법이나 윤리에 어긋나는 행동
5. 특정 날씨나 계절에만 가능한 미션
6. 사용자가 마음먹어도 완료 여부를 통제할 수 없는 미션
7. 천장에 구름이 있다고 가정하거나 천장 무늬를 구름처럼 관찰하게 하는 미션, 특히 '천장 구름 관찰하기'
8. 가짜 장소, '자유 장소', '지역 내 어디서나', '현재 위치 주변의 편한 장소' 같은 표현
   단, 특정 장소가 필요 없는 미션은 place_name을 정확히 '어디서나 가능'으로 쓸 수 있다.

[생성 규칙]
1. 총 ${missionCount}개의 서로 다른 미션을 만든다.
2. 허용 카테고리는 다음뿐이다: ${categoryText}
3. 허용 카테고리가 4개 이상이면 최소 4개 카테고리를 섞고 같은 카테고리는 최대 2개까지만 사용한다. 허용 카테고리가 3개 이하라면 가능한 카테고리를 고르게 섞는다.
4. 특정 장소 미션은 아래 실제 장소 목록의 이름을 정확히 그대로 place_name에 넣고 requires_place를 true로 한다.
4-1. 특정 장소 미션의 category는 장소 목록에 적힌 '앱 카테고리'와 반드시 정확히 같아야 한다. AI가 임의로 다른 카테고리를 선택하면 안 된다.
4-2. 카카오 상세 카테고리가 미션 카테고리보다 우선한다. 장소가 영화관·공연장·전시장·미술관처럼 관람 대상이 있는 곳이면 '감상', 사찰·성당·교회·역사 유적·기념관이면 '배움'으로 작성한다.
4-3. 편의점·대형마트는 장소 목록에 '먹거리 관련 미션에만 사용 가능'이라고 표시된 경우에만 음식 미션에 사용할 수 있다.
4-1. 실제 장소 미션은 반드시 장소 목록에 적힌 카테고리와 행동이 자연스럽게 맞아야 한다.
4-2. 카페 및 디저트 장소에서는 메뉴·음료·디저트·맛·공간 분위기를 경험하는 미션만 만든다. 명상, 요가, 운동, 낮잠 미션을 만들지 않는다.
4-3. 음식 장소에서는 메뉴·식사·맛을 경험하는 미션만 만들고 독서, 명상, 운동 미션을 만들지 않는다.
4-4. 산책 장소에서는 걷기·풍경 관찰·사진·자연 감상·가벼운 휴식 미션을 만든다.
4-5. 감상·배움 장소에서는 작품 관람·독서·전시·공연·학습처럼 해당 시설을 이용하는 미션을 만든다.
4-6. 장소 이름만 문장에 붙인 뒤 그 장소와 무관한 행동을 시키는 미션은 절대 만들지 않는다.
5. 집에서 하는 미션은 place_name을 정확히 '내 방'으로 쓰고 is_at_home을 true, requires_place를 false로 한다.
6. 특정 장소가 필요 없는 미션은 place_name을 정확히 '어디서나 가능'으로 쓰고 is_flexible을 true, requires_place를 false로 한다.
7. 집 미션은 최대 ${homeMissionLimit}개다. 어디서나 가능 미션은 최소 ${minimumFlexibleMissionCount}개, 최대 ${flexibleMissionLimit}개를 반드시 포함한다.
8. '어디서나 가능' 외에 자유 장소를 뜻하는 다른 표현은 절대 쓰지 않는다.
9. 제목, 설명, 수행 안내, 추천 이유를 모두 자연스러운 한국어로 작성한다.
10. instructions는 세부 절차나 체크리스트가 아니라 홈 화면에서 읽는 자연스러운 '미션 상세 소개'로 작성한다.
11. instructions는 반드시 정확히 2문장으로 쓰며 전체 길이는 대략 65~135자로 한다. 세 번째 문장은 절대 작성하지 않는다.
12. 첫 문장은 사용자가 무엇을 하면 되는지 '~해보세요.'처럼 부드러운 높임말로 안내한다.
13. 둘째 문장은 그 경험에서 느낄 수 있는 매력, 기대, 즐거움 또는 발견을 '~수 있을 거예요.', '~좋아요.' 같은 높임말로 설명한다.
14. instructions의 모든 문장은 높임말이어야 하며, 반말·메모체·명령조를 사용하지 않는다.
15. 1, 2, 3 같은 번호, 불릿, 줄바꿈, '먼저·다음·마지막' 같은 순서 표현, '방문합니다. 주문합니다. 기록합니다.' 같은 단계 나열을 절대 사용하지 않는다.
16. instructions는 앱에서 별도의 보충 문장을 붙이지 않고 그대로 사용자에게 표시되므로, 두 문장만으로 자연스럽고 완결되게 작성한다.
17. '천천히 시도해보세요.', '평소와 다른 경험을 할 수 있을 거예요.'처럼 어느 미션에나 붙일 수 있는 상투적인 문장을 추가하지 않는다.
18. 좋은 예: '00카페에 방문해 시그니처 메뉴에 도전해보세요. 그 가게만의 분위기와 매력을 자연스럽게 느낄 수 있을 거예요.'
19. 나쁜 예: '1. 00카페에 방문합니다. 2. 메뉴를 주문합니다. 3. 맛을 기록합니다.'
20. description은 번호나 불릿 없이 20~45자 정도의 자연스러운 높임말 한 문장으로 쓴다.
21. recommendationReason은 25~60자 정도의 높임말 한 문장만 쓴다. 추천 근거를 짧고 구체적으로 설명하고 '~해요.', '~좋아요.', '~추천드려요.'처럼 끝낸다.
22. recommendationReason에는 두 번째 문장, 줄바꿈, 번호, 말줄임표, 미완성 표현을 절대 넣지 않는다.
23. durationText는 '15분', '30분', '1시간'처럼 쓴다.
24. costText는 '무료' 또는 '약 6,000원'처럼 쓴다.
25. 각 미션은 사용자가 마음만 먹으면 100% 수행할 수 있어야 한다.

[개인화 적용 원칙]
1. 이번 여정의 목표가 있으면 가장 강한 추천 기준으로 사용한다. 목표를 그대로 제목에 반복하지 말고 실제 행동으로 자연스럽게 풀어낸다.
2. 최근 '또 해보고 싶어요'를 받은 카테고리와 미션의 공통 특징은 추천 비중을 높인다.
3. 최근 '다음엔 피하고 싶어요'를 받은 카테고리와 미션의 유사 행동은 추천 비중을 낮춘다. 단, 사용자가 직접 선택한 허용 카테고리를 완전히 제거하지는 않는다.
4. 최초 로그인 관심 카테고리는 기록이 적을 때의 기본 취향으로 사용한다.
5. 중립 평가인 '괜찮았어요'는 가중치를 높이거나 낮추지 않는다.
6. 개인화 정보가 없더라도 안전성, 수행 가능성, 카테고리 다양성 규칙은 그대로 지킨다.
7. recommendationReason에는 내부 점수나 '싫어해서 제외했다'는 표현을 노출하지 말고, 목표와 취향에 맞는 긍정적 이유만 자연스럽게 쓴다.

[어디서나 가능 미션 참고 예시]
${flexibleMissionExamplesPrompt}

[참고 예시 사용 규칙]
1. 위 예시는 '어디서나 가능' 미션의 구체성, 난이도, 문장 흐름을 참고하기 위한 자료다.
2. 예시의 제목, 설명, 문장을 그대로 복사하거나 단어만 조금 바꿔 재사용하지 않는다.
3. 새 미션은 특정 상점, 시설, 행사, 타인의 반응이 없어도 사용자가 스스로 시작하고 완료할 수 있어야 한다.
4. 완료 여부가 분명한 관찰, 기록, 사진, 짧은 이동, 선택, 감상 같은 행동을 우선한다.
5. 사용자의 현재 위치가 실내이거나 실외여도 무리 없이 수행 가능한 미션을 우선한다.
6. 예시와 같은 자연스러운 높임말 두 문장 구조를 따르되, 미션마다 새로운 소재와 행동을 사용한다.
7. 위 예시는 모두 place_name을 '어디서나 가능', is_flexible을 true, requires_place를 false로 작성해야 하는 유형이다.

[응답 형식]
반드시 설명이나 마크다운 없이 아래 모양의 JSON 객체 하나만 반환한다.
{
  "missions": [
    {
      "category": "산책",
      "title": "미션 제목",
      "description": "높임말 한 줄 설명",
      "instructions": "높임말 정확히 2문장의 자연스러운 미션 상세 소개",
      "recommendationReason": "높임말 한 문장의 짧고 구체적인 추천 이유",
      "durationText": "30분",
      "costText": "무료",
      "place_name": "실제 장소 이름, 내 방 또는 어디서나 가능",
      "is_at_home": false,
      "is_flexible": false,
      "requires_place": true,
      "environment": "any",
      "required_items": ["휴대폰"]
    }
  ]
}
`;

    const userPrompt = `
추천 조건:
- 카테고리: ${categoryText}
- 비용: ${body.cost ?? "무료/유료"}
- 예상 시간: ${body.time ?? body.estimatedDuration ?? "상관없음"}
- 장소 유형: ${body.locationType ?? "실제 장소, 내 방 또는 어디서나 가능"}
- 지역: ${body.district ?? body.gu ?? "현재 위치 주변"}
- 추천 반경: ${body.radiusKm ?? body.radius_km ?? "기본 반경"}km

개인화 정보:
- 이번 여정의 목표: ${journeyGoal || "없음"}
- 최초 관심 카테고리: ${initialInterests.length > 0 ? initialInterests.join(", ") : "없음"}
- 현재 우선 카테고리: ${preferredCategories.length > 0 ? preferredCategories.join(", ") : "없음"}
- 최근 선호 카테고리: ${likedCategories.length > 0 ? likedCategories.join(", ") : "없음"}
- 최근 비선호 카테고리: ${dislikedCategories.length > 0 ? dislikedCategories.join(", ") : "없음"}
- 최근 좋아한 미션: ${likedMissionExamples.length > 0 ? likedMissionExamples.join(" | ") : "없음"}
- 최근 피하고 싶은 미션: ${dislikedMissionExamples.length > 0 ? dislikedMissionExamples.join(" | ") : "없음"}

개인화 적용 순서:
1. 이번 여정의 목표
2. 최근 미션 호불호
3. 최초 관심 카테고리
4. 새로운 경험을 위한 다양성

직전 추천에서 제외할 제목:
${
  excludedTitles.length > 0
    ? excludedTitles.map((title) => `- ${title}`).join("\n")
    : "- 없음"
}

사용 가능한 실제 장소:
${placePrompt}

추가 지시:
${body.generationInstruction ?? "조건에 맞는 서로 다른 미션을 추천해줘."}
이번 응답에는 Solar가 새로 만든 '어디서나 가능' 미션을 최소 ${minimumFlexibleMissionCount}개 포함하세요. 해당 미션은 place_name='어디서나 가능', is_flexible=true, requires_place=false로 작성하세요.
실제 장소 미션은 장소 카테고리와 수행 행동을 반드시 일치시키세요. 특히 카페에서 명상·요가·운동을 하게 하거나 음식점에서 독서·명상을 하게 하는 조합은 금지합니다.
${body.recommendationReasonInstruction ?? ""}
`;

    let aiMissions: AiMission[] = [];
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const generatedMissions = await callUpstage({
          apiKey: upstageApiKey,
          systemPrompt,
          userPrompt,
          attempt,
        });
        const generatedFlexibleCount =
          generatedMissions.filter(isAiFlexibleMission).length;

        if (
          generatedFlexibleCount <
          minimumFlexibleMissionCount
        ) {
          throw new Error(
            `어디서나 가능 미션이 ${generatedFlexibleCount}개만 생성되었습니다. 최소 ${minimumFlexibleMissionCount}개가 필요합니다.`,
          );
        }

        aiMissions = generatedMissions;
        break;
      } catch (error) {
        lastError = error;
        console.error(`AI 생성 ${attempt}차 시도 실패:`, error);
      }
    }

    if (aiMissions.length === 0) {
      throw lastError instanceof Error
        ? lastError
        : new Error("AI가 미션을 생성하지 못했습니다.");
    }

    console.log("AI가 만든 미션 개수:", aiMissions.length);

    const { data: categoryRows, error: categoryError } =
      await supabaseClient
        .from("mission_categories")
        .select("id, name");

    if (categoryError) {
      throw new Error(
        `카테고리 조회 실패: ${categoryError.message}`,
      );
    }

    const categoryIdByName = new Map<string, string>();
    for (const row of categoryRows ?? []) {
      categoryIdByName.set(String(row.name), String(row.id));
    }

    const fallbackCategoryId =
      categoryIdByName.get("기타") ??
      (categoryRows?.[0]?.id
        ? String(categoryRows[0].id)
        : null);

    if (!fallbackCategoryId) {
      throw new Error(
        "mission_categories 테이블에 데이터가 없습니다.",
      );
    }

    const usedPlaceNames = new Set<string>();
    let homeMissionCount = 0;
    let flexibleMissionCount = 0;

    const missionsToInsert = aiMissions
      .slice(0, missionCount)
      .map((mission) => {
        const title = String(mission.title ?? "").trim();
        const description =
          normalizeShortDescription(
            mission.description,
          );
        const rawInstructions = String(
          mission.instructions ?? description,
        ).trim();

        if (!title || !/[가-힣]/.test(title)) {
          return null;
        }

        if (
          isBlockedMissionText(
            `${title} ${description} ${rawInstructions}`,
          )
        ) {
          console.warn(
            "차단된 미션을 저장하지 않습니다:",
            title,
          );
          return null;
        }

        const aiCategory = normalizeCategory(
          mission.category,
          `${title} ${description} ${rawInstructions}`,
        );
        const normalizedPlaceName = normalizeComparableText(
          mission.place_name,
        );
        const requestedAtHome =
          mission.is_at_home === true ||
          normalizedPlaceName === "내방" ||
          /(내 방|집에서|방에서|자택)/.test(
            `${title} ${description} ${rawInstructions}`,
          );
        const isAtHome =
          requestedAtHome && homeMissionCount < homeMissionLimit;

        const requestedFlexible =
          !isAtHome &&
          (mission.is_flexible === true ||
            mission.requires_place === false ||
            normalizedPlaceName === "어디서나가능");
        const isFlexible =
          requestedFlexible &&
          flexibleMissionCount < flexibleMissionLimit;

        const missionText =
          `${title} ${description} ${rawInstructions}`.trim();
        let matchedPlace: NormalizedPlace | null = null;

        if (!isAtHome && !isFlexible) {
          matchedPlace = findMatchingPlace(
            mission.place_name,
            places,
          );

          if (
            matchedPlace &&
            !isMissionTextCompatibleWithPlace(
              matchedPlace.category,
              matchedPlace,
              missionText,
            )
          ) {
            console.warn(
              "카카오 상세 카테고리와 미션 내용이 맞지 않아 제외합니다:",
              title,
              matchedPlace.name,
              matchedPlace.kakaoCategoryName,
              matchedPlace.category,
            );
            matchedPlace = null;
          }

          if (!matchedPlace) {
            matchedPlace = chooseFallbackPlace(
              aiCategory,
              missionText,
              places,
              usedPlaceNames,
            );
          }
        }

        if (isAtHome) {
          homeMissionCount += 1;
        } else if (isFlexible) {
          flexibleMissionCount += 1;
        } else if (matchedPlace) {
          usedPlaceNames.add(
            normalizeComparableText(matchedPlace.name),
          );
        } else {
          return null;
        }

        const resolvedPlaceName = isAtHome
          ? "내 방"
          : isFlexible
            ? "어디서나 가능"
            : matchedPlace?.name ?? null;
        const resolvedCategory: AppCategory =
          !isAtHome && !isFlexible && matchedPlace
            ? matchedPlace.category
            : aiCategory as AppCategory;

        const instructions = cleanAiInstructions(
          rawInstructions,
        );

        // instructions가 비어 있으면 임의 문장을 붙이지 않고 해당 결과를 제외한다.
        if (!instructions) {
          return null;
        }

        return {
          category_id:
            categoryIdByName.get(resolvedCategory) ??
            fallbackCategoryId,
          title,
          short_description:
            normalizeShortDescription(description) ||
            "일상에 작은 변화를 더해보세요.",
          instructions,
          recommendation_reason: normalizeRecommendationReason(
            mission.recommendationReason ??
              mission.recommendation_reason,
          ),
          estimated_duration_min: parseDurationMinutes(
            mission.durationText,
          ),
          estimated_cost: parseEstimatedCost(
            mission.costText,
          ),
          environment: isAtHome
            ? "indoor"
            : String(mission.environment ?? "").toLowerCase() ===
                "outdoor"
              ? "outdoor"
              : String(mission.environment ?? "").toLowerCase() ===
                  "indoor"
                ? "indoor"
                : body.locationType === "실외"
                  ? "outdoor"
                  : body.locationType === "실내"
                    ? "indoor"
                    : "any",
          companion_type: "any",
          requires_place: !isAtHome && !isFlexible && Boolean(matchedPlace),
          required_items: Array.isArray(
            mission.required_items,
          )
            ? mission.required_items
                .map(String)
                .map((item) => item.trim())
                .filter(Boolean)
                .slice(0, 5)
            : [],
          unlock_count: 0,
          // 카테고리와 뱃지는 별개다. AI 추천 미션에는 뱃지를 자동 배정하지 않는다.
          badge_ids: [],
          is_active: true,
          place_name: resolvedPlaceName,
          place_lat: isAtHome || isFlexible
            ? null
            : matchedPlace?.lat ?? null,
          place_lng: isAtHome || isFlexible
            ? null
            : matchedPlace?.lng ?? null,
        };
      })
      .filter((mission) => mission !== null);

    if (missionsToInsert.length === 0) {
      throw new Error(
        "AI 응답은 받았지만 저장 가능한 미션이 없었습니다.",
      );
    }

    console.log(
      "INSERT 시도 데이터:",
      JSON.stringify(missionsToInsert),
    );

    const { data: insertedMissions, error: insertError } =
      await supabaseClient
        .from("missions")
        .insert(missionsToInsert)
        .select(`
          id,
          title,
          short_description,
          instructions,
          recommendation_reason,
          estimated_duration_min,
          estimated_cost,
          required_items,
          requires_place,
          place_lat,
          place_lng,
          place_name,
          badge_ids,
          category:mission_categories ( id, name, icon_name )
        `);

    if (insertError) {
      console.error("INSERT 실패:", JSON.stringify(insertError));
      throw new Error(`DB Insert Error: ${insertError.message}`);
    }

    if (!insertedMissions || insertedMissions.length === 0) {
      throw new Error("DB에 저장된 미션을 확인하지 못했습니다.");
    }

    console.log("저장된 미션 개수:", insertedMissions.length);

    return jsonResponse({
      status: "success",
      missions: insertedMissions,
    });
  } catch (error) {
    console.error("함수 전체 에러:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
      },
      500,
    );
  }
});