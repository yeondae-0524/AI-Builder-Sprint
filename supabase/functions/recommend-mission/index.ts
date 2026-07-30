import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@1";

interface FilterOptions {
  category: string;
  cost?: "무료" | "유료" | "무료/유료";
  locationType?: "실내" | "실외" | "실내/실외";
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default {
  fetch: withSupabase(
    { auth: ["publishable", "secret"] },
    async (req) => {
      if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
      }

      try {
        const upstageApiKey = Deno.env.get("UPSTAGE_API_KEY");
        if (!upstageApiKey) {
          return Response.json(
            { error: "UPSTAGE_API_KEY가 등록되지 않았습니다." },
            { status: 500, headers: corsHeaders }
          );
        }

        const filters: FilterOptions = await req.json().catch(() => ({ category: "기타" }));

        // 💡 AI에게 제공할 백엔드 뱃지 ID 목록 안내
        const systemPrompt = `
너는 사용자의 바쁜 일상 속에서 오롯이 나와 대면하고 영감을 찾을 수 있도록 돕는 챌린지 AI 큐레이터야.
사용자가 선택한 [카테고리] 안에서, 오늘 원하는 [비용, 실내외] 조건에 맞춰 미션 4가지를 추천해줘.

[뱃지 ID 참고 목록]
- badge_walk: 산책, 걷기, 골목 탐방 관련
- badge_animal: 동물, 새, 길고양이 관찰 관련
- badge_cafe: 카페, 디저트, 음료, 맛 관련
- badge_sound: 음악, 소리, 자연의 소리 관련
- badge_book: 서점, 독서, 글귀 관련
- badge_photo: 사진 촬영, 풍경 수집 관련
- badge_rest: 휴식, 명상, 아무것도 안 하기 관련

[미션 추천 가이드라인]
1. 미션마다 연관된 뱃지 ID들을 \`badge_ids\` 배열 형태로 1~3개 부여해줘.
   (예: 온천천 산책하며 수달 사진 찍기 -> ["badge_walk", "badge_animal", "badge_photo"])
2. 스펙/효율성보다는 나와 로컬 공간, 감각에 오롯이 집중할 수 있는 따뜻한 톤앤매너로 작성해줘.
3. costText는 "무료" 또는 예산 금액(예: "약 6,000원")으로 기재해줘.

[응답 포맷]
반드시 다른 설명 없이 아래 JSON 형식으로만 응답해줘:
{
  "missions": [
    {
      "id": "m1",
      "badge_ids": ["badge_walk", "badge_animal"],
      "title": "온천천 산책하면서 수달 사진 찍기",
      "description": "온천천을 거닐며 귀여운 수달이나 새들을 찾아 사진으로 담아봅니다.",
      "durationText": "30분",
      "costText": "무료"
    }
  ]
}
`;

        const userPrompt = `
사용자가 진행 중인 카테고리: [${filters.category}]
오늘의 조건:
- 지정 카테고리: ${filters.category}
- 비용: ${filters.cost || "무료/유료"}
- 장소(실내/실외): ${filters.locationType || "실내/실외"}

위 조건에 맞는 4가지 미션을 생성해줘.
`;

        const response = await fetch(
          "https://api.upstage.ai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${upstageApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "solar-pro",
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              temperature: 0.7,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          return Response.json(
            { error: "Upstage API 호출 실패", details: data },
            { status: response.status, headers: corsHeaders }
          );
        }

        const rawContent = data.choices?.[0]?.message?.content ?? "{}";
        const parsedData = JSON.parse(rawContent);

        return Response.json(
          {
            status: "success",
            missions: parsedData.missions ?? [],
          },
          { headers: corsHeaders }
        );

      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다." },
          { status: 500, headers: corsHeaders }
        );
      }
    }
  ),
};
