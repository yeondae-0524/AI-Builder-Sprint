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
};

type RequestBody = {
  category?: string;
  categories?: string[];
  preferredCategories?: string[];
  interests?: string[];
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

type NormalizedPlace = {
  id?: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance?: number;
  district?: string;
  category?: string;
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

const CATEGORY_GROUP_CODE: Record<string, string> = {
  "카페 및 디저트": "CE7",
  음식: "FD6",
  산책: "AT4",
  휴식: "CE7",
  활동: "AT4",
  감상: "CT1",
  배움: "CT1",
  기타: "CE7",
};

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
  if (/(독서|책|공부|배우|학습|강의|도서관|서점)/.test(normalized)) {
    return "배움";
  }
  if (/(음악|영화|공연|전시|버스킹|미술관|박물관|감상|사진)/.test(normalized)) {
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

function normalizeRecommendationReason(value: unknown) {
  const fallback =
    "지금의 취향과 상황에 잘 맞는 경험이라 추천드려요.";

  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/(?:\.{3,}|…+)/g, "")
    .replace(/[.!?。！？]+$/g, "")
    .trim();

  if (!normalized) {
    return fallback;
  }

  const polished = normalized
    .replace(/하기\s*좋음$/u, "하기 좋아요")
    .replace(/하기\s*좋다$/u, "하기 좋아요")
    .replace(/에\s*적합함$/u, "에 잘 맞아요")
    .replace(/에\s*적합하다$/u, "에 잘 맞아요")
    .replace(/도움이\s*됨$/u, "도움이 돼요")
    .replace(/도움이\s*된다$/u, "도움이 돼요")
    .replace(/추천함$/u, "추천드려요")
    .replace(/추천한다$/u, "추천드려요");

  if (
    /(요|죠|세요|까요|니다|예요|이에요|드려요|좋아요|맞아요|돼요)$/u.test(
      polished,
    )
  ) {
    return `${polished}.`;
  }

  return `${polished}. 이런 점에서 이 미션을 추천드려요.`;
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

function normalizeInstructionText(
  value: unknown,
  description: string,
) {
  let text = String(value ?? "")
    .replace(/\r/g, "")
    .replace(
      /^\s*(?:미션\s*)?(?:수행\s*)?(?:방법|안내)\s*[:：-]?\s*/i,
      "",
    )
    .replace(
      /(?:^|\n|\s)(?:\d{1,2}\s*[.)]|[-•▪◦])\s*/g,
      " ",
    )
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    text =
      "준비물을 챙긴 뒤 안내된 장소에서 주변의 분위기와 자신의 느낌을 천천히 살피며 미션을 수행해보세요";
  }

  text = text.replace(/[.!?。]+$/g, "").trim();

  if (text.length < 38) {
    const descriptionText = description
      .replace(/[.!?。]+$/g, "")
      .trim();

    text = [
      text,
      descriptionText
        ? "주변의 분위기와 자신의 느낌도 함께 살피며"
        : "서두르지 말고 주변의 분위기와 자신의 느낌을 살피며",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (/해\s*보세요$/u.test(text)) {
    return `${text.replace(/해\s*보세요$/u, "해보세요")}.`;
  }

  if (/해\s*주세요$/u.test(text)) {
    return `${text.replace(/해\s*주세요$/u, "해보세요")}.`;
  }

  if (/하세요$/u.test(text)) {
    return `${text.replace(/하세요$/u, "해보세요")}.`;
  }

  if (/합니다$/u.test(text)) {
    return `${text.replace(/합니다$/u, "해보세요")}.`;
  }

  if (/해요$/u.test(text)) {
    return `${text.replace(/해요$/u, "해보세요")}.`;
  }

  if (/보세요$/u.test(text)) {
    return `${text}.`;
  }

  return `${text} 천천히 시도해보세요.`;
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
      category: place.category
        ? normalizeCategory(place.category, name)
        : undefined,
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
        .map((category) => CATEGORY_GROUP_CODE[category])
        .filter(Boolean),
    ),
  ).slice(0, 4);

  if (categoryCodes.length === 0) {
    categoryCodes.push("CE7", "FD6", "AT4", "CT1");
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
      name: place.place_name,
      address: place.road_address_name || place.address_name,
      latitude: Number.parseFloat(place.y),
      longitude: Number.parseFloat(place.x),
      distance: Number.parseFloat(place.distance),
      category: place.category_group_code === "CE7"
        ? "카페 및 디저트"
        : place.category_group_code === "FD6"
          ? "음식"
          : place.category_group_code === "AT4"
            ? "산책"
            : place.category_group_code === "CT1"
              ? "감상"
              : "기타",
    })),
  ).slice(0, 40);
}

function buildPlacesPrompt(places: NormalizedPlace[]) {
  if (places.length === 0) {
    return "사용 가능한 실제 장소가 없습니다. 이 경우 모든 미션을 '내 방'에서 수행 가능한 미션으로 만들어주세요.";
  }

  return places
    .slice(0, 30)
    .map((place, index) => {
      const parts = [
        `${index + 1}. ${place.name}`,
        place.category ? `카테고리: ${place.category}` : "",
        place.address ? `주소: ${place.address}` : "",
        place.district ? `지역: ${place.district}` : "",
      ].filter(Boolean);

      return parts.join(" | ");
    })
    .join("\n");
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
  places: NormalizedPlace[],
  usedPlaceNames: Set<string>,
) {
  return (
    places.find(
      (place) =>
        !usedPlaceNames.has(normalizeComparableText(place.name)) &&
        place.category === category,
    ) ??
    places.find(
      (place) =>
        !usedPlaceNames.has(normalizeComparableText(place.name)),
    ) ??
    places[0] ??
    null
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
      : "\n\n이전 응답을 사용할 수 없었습니다. 반드시 missions 배열을 포함한 유효한 JSON 객체만 반환하세요. 마크다운 코드블록과 설명은 절대 쓰지 마세요.";

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

    const requestedCategories = Array.from(
      new Set(
        [
          ...normalizeStringArray(body.categories),
          ...normalizeStringArray(body.preferredCategories),
          ...normalizeStringArray(body.interests),
        ]
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

    console.log("요청 카테고리:", categories.join(", "));
    console.log("요청 좌표:", latitude, longitude);
    console.log("사용 가능한 장소 수:", places.length);

    const excludedTitles = normalizeStringArray(body.excludeTitles);
    const categoryText = categories.join(", ");
    const placePrompt = buildPlacesPrompt(places);

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
7. 가짜 장소, '자유 장소', '지역 내 어디서나', '현재 위치 주변의 편한 장소' 같은 표현
   단, 특정 장소가 필요 없는 미션은 place_name을 정확히 '어디서나 가능'으로 쓸 수 있다.

[생성 규칙]
1. 총 ${missionCount}개의 서로 다른 미션을 만든다.
2. 허용 카테고리는 다음뿐이다: ${categoryText}
3. 카테고리가 여러 개라면 최소 4개 카테고리를 섞고, 같은 카테고리는 최대 2개까지만 사용한다.
4. 특정 장소 미션은 아래 실제 장소 목록의 이름을 정확히 그대로 place_name에 넣고 requires_place를 true로 한다.
5. 집에서 하는 미션은 place_name을 정확히 '내 방'으로 쓰고 is_at_home을 true, requires_place를 false로 한다.
6. 특정 장소가 필요 없는 미션은 place_name을 정확히 '어디서나 가능'으로 쓰고 is_flexible을 true, requires_place를 false로 한다.
7. 집 미션은 최대 ${homeMissionLimit}개, 어디서나 가능 미션은 최대 ${flexibleMissionLimit}개다.
8. '어디서나 가능' 외에 자유 장소를 뜻하는 다른 표현은 절대 쓰지 않는다.
9. 제목, 설명, 수행 안내, 추천 이유를 모두 자연스러운 한국어로 작성한다.
10. instructions는 준비·행동·관찰이 자연스럽게 이어지는 45~100자 길이의 한 문장으로 쓴다.
11. instructions에는 1, 2, 3 같은 번호, 불릿, 줄바꿈, '수행 방법:' 같은 머리말을 절대 넣지 않는다.
12. instructions는 반드시 존댓말 권유형으로 쓰고 문장 끝을 정확히 '해보세요.'로 마무리한다.
13. description은 20~45자 정도의 자연스러운 한 문장으로 쓴다.
14. recommendationReason은 가능하면 한 줄 분량의 짧은 한 문장으로 쓰고, 반드시 '~해요.', '~좋아요.', '~추천드려요.'처럼 높임말 완결형으로 끝낸다. 말줄임표나 미완성 표현은 절대 쓰지 않는다.
15. durationText는 '15분', '30분', '1시간'처럼 쓴다.
16. costText는 '무료' 또는 '약 6,000원'처럼 쓴다.
17. 각 미션은 사용자가 마음만 먹으면 100% 수행할 수 있어야 한다.

[응답 형식]
반드시 설명이나 마크다운 없이 아래 모양의 JSON 객체 하나만 반환한다.
{
  "missions": [
    {
      "category": "산책",
      "title": "미션 제목",
      "description": "한 줄 설명",
      "instructions": "구체적인 수행 방법",
      "recommendationReason": "짧은 추천 이유",
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
${body.recommendationReasonInstruction ?? ""}
`;

    let aiMissions: AiMission[] = [];
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        aiMissions = await callUpstage({
          apiKey: upstageApiKey,
          systemPrompt,
          userPrompt,
          attempt,
        });
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
        const description = String(
          mission.description ?? "",
        ).trim();
        const rawInstructions = String(
          mission.instructions ?? description,
        ).trim();
        const instructions = normalizeInstructionText(
          rawInstructions,
          description,
        );

        if (!title || !/[가-힣]/.test(title)) {
          return null;
        }

        const category = normalizeCategory(
          mission.category,
          `${title} ${description} ${instructions}`,
        );
        const normalizedPlaceName = normalizeComparableText(
          mission.place_name,
        );
        const requestedAtHome =
          mission.is_at_home === true ||
          normalizedPlaceName === "내방" ||
          /(내 방|집에서|방에서|자택)/.test(
            `${title} ${description} ${instructions}`,
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

        let matchedPlace: NormalizedPlace | null = null;

        if (!isAtHome && !isFlexible) {
          matchedPlace = findMatchingPlace(
            mission.place_name,
            places,
          );

          if (!matchedPlace) {
            matchedPlace = chooseFallbackPlace(
              category,
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

        return {
          category_id:
            categoryIdByName.get(category) ??
            fallbackCategoryId,
          title,
          short_description:
            description || "일상에 작은 변화를 더해보세요.",
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
          place_name: isAtHome
            ? "내 방"
            : isFlexible
              ? "어디서나 가능"
              : matchedPlace?.name ?? null,
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