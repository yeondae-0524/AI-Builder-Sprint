import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type EssayPersona =
  | "taste_profiler"
  | "strict_teacher"
  | "record_detective"
  | "performance_reviewer";

type EssayRecordInput = {
  missionTitle: string;
  missionDescription: string;
  category: string | null;
  recordedAt: string;
  userContent: string;
  emotion: string | null;
  placeName: string | null;
  photoUrls: string[];
};

type EssayAiRequest = {
  persona?: unknown;
  nickname?: unknown;
  journeyTitle?: unknown;
  durationDays?: unknown;
  records?: unknown;
};

type NormalizedEssayAiRequest = {
  persona: EssayPersona;
  nickname: string;
  journeyTitle: string;
  durationDays: number;
  records: EssayRecordInput[];
};

type EssayAiResult = {
  persona: EssayPersona;
  title: string;
  content: string;
  summary: string;
  verdict: string;
  insights: Array<{
    keyword: string;
    description: string;
  }>;
  aiRecommendation: string;
};

type UpstageChatResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  error?: {
    message?: unknown;
  };
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JSON_HEADERS = {
  ...CORS_HEADERS,
  "Content-Type": "application/json; charset=utf-8",
};

const UPSTAGE_API_URL =
  "https://api.upstage.ai/v1/solar/chat/completions";
const UPSTAGE_TIMEOUT_MS = 90_000;
const MAX_RECORDS = 40;
const MAX_RECORD_CONTENT_LENGTH = 2_000;
const MAX_PROMPT_LENGTH = 80_000;

function jsonResponse(
  payload: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function getErrorMessage(
  error: unknown,
  fallback = "알 수 없는 오류가 발생했습니다.",
) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = String(
      (error as { message?: unknown }).message ?? "",
    ).trim();

    if (message) return message;
  }

  return fallback;
}

function toCleanString(value: unknown, fallback = "") {
  const text = String(value ?? "")
    .replace(/\u0000/g, "")
    .trim();

  return text || fallback;
}

function toNullableString(value: unknown) {
  const text = toCleanString(value);
  return text || null;
}

function normalizePersona(value: unknown): EssayPersona {
  return value === "strict_teacher" ||
      value === "record_detective" ||
      value === "performance_reviewer"
    ? value
    : "taste_profiler";
}

function normalizeDurationDays(value: unknown) {
  const parsed = Number(value);

  if (
    Number.isFinite(parsed) &&
    parsed >= 1 &&
    parsed <= 365
  ) {
    return Math.round(parsed);
  }

  return 7;
}

function normalizePhotoUrls(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => toCleanString(item))
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeRecord(
  value: unknown,
  index: number,
): EssayRecordInput {
  const raw = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};

  const userContent = toCleanString(raw.userContent).slice(
    0,
    MAX_RECORD_CONTENT_LENGTH,
  );

  if (!userContent) {
    throw new Error(
      `${index + 1}번째 기록의 내용이 비어 있습니다.`,
    );
  }

  return {
    missionTitle: toCleanString(
      raw.missionTitle,
      `기록 ${index + 1}`,
    ),
    missionDescription: toCleanString(raw.missionDescription),
    category: toNullableString(raw.category),
    recordedAt: toCleanString(raw.recordedAt, "날짜 정보 없음"),
    userContent,
    emotion: toNullableString(raw.emotion),
    placeName: toNullableString(raw.placeName),
    photoUrls: normalizePhotoUrls(raw.photoUrls),
  };
}

function normalizeRequest(
  rawBody: EssayAiRequest,
): NormalizedEssayAiRequest {
  const rawRecords = Array.isArray(rawBody.records)
    ? rawBody.records
    : [];

  if (rawRecords.length === 0) {
    throw new Error("에세이를 만들 기록이 없습니다.");
  }

  if (rawRecords.length > MAX_RECORDS) {
    throw new Error(
      `한 번에 최대 ${MAX_RECORDS}개의 기록만 처리할 수 있습니다.`,
    );
  }

  return {
    persona: normalizePersona(rawBody.persona),
    nickname: toCleanString(rawBody.nickname, "사용자"),
    journeyTitle: toCleanString(rawBody.journeyTitle, "나의 여정"),
    durationDays: normalizeDurationDays(rawBody.durationDays),
    records: rawRecords.map(normalizeRecord),
  };
}

function formatRecords(records: EssayRecordInput[]) {
  return records
    .map((record, index) => {
      const lines = [
        `[기록 ${index + 1}]`,
        `recordIndex: ${index}`,
        `날짜: ${record.recordedAt}`,
        `미션: ${record.missionTitle}`,
      ];

      if (record.missionDescription) {
        lines.push(`미션 설명: ${record.missionDescription}`);
      }
      if (record.category) lines.push(`카테고리: ${record.category}`);
      if (record.placeName) lines.push(`장소: ${record.placeName}`);
      if (record.emotion) lines.push(`감정: ${record.emotion}`);

      lines.push(`사용자 기록: ${record.userContent}`);

      if (record.photoUrls.length > 0) {
        lines.push(`사진 수: ${record.photoUrls.length}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

function getLengthInstruction(recordCount: number) {
  if (recordCount <= 7) {
    return "content는 5~7개 문단, 약 900~1,300자 분량으로 작성하세요.";
  }
  if (recordCount <= 14) {
    return "content는 7~9개 문단, 약 1,300~1,800자 분량으로 작성하세요.";
  }
  return "content는 9~12개 문단, 약 1,700~2,400자 분량으로 작성하세요.";
}

function getPersonaInstruction(persona: EssayPersona) {
  switch (persona) {
    case "strict_teacher":
      return `
당신의 역할은 '팩트 폭격 담임 선생님'입니다.
학생의 가능성을 믿지만 대충 넘어가는 태도는 봐주지 않는 담임처럼 작성하세요.

분석 목표:
- 기록에서 실제로 확인되는 회피, 핑계, 반복되는 안전한 선택, 성찰 부족을 찾으세요.
- 사용자가 끝까지 해낸 점이나 솔직하게 기록한 점도 최소 한 가지 인정하세요.
- 성격이나 능력 자체를 비난하지 말고 오직 기록에 나타난 행동과 선택만 지적하세요.
- 욕설, 조롱, 모욕, 비꼬기, 수치심을 유발하는 표현은 금지합니다.
- 우울함, 불안, 지침 같은 감정 자체를 게으름으로 단정하지 마세요.
- 근거가 부족한 부분은 억지로 혼내지 말고 '기록만으로는 판단하기 어렵다'고 쓰세요.

글의 방식:
- 첫 문단은 이번 여정을 한 문장으로 냉정하게 평가하세요.
- 중간에는 구체적인 기록을 근거로 잘한 점과 아쉬운 점을 함께 설명하세요.
- 마지막에는 다음 여정에서 반드시 수행할 현실적인 숙제 한 가지를 주세요.
- verdict는 '담임의 한 줄 총평: ...' 형식으로 작성하세요.
- insights의 keyword는 '잘한 점', '회피한 부분', '고쳐야 할 습관'처럼 작성할 수 있습니다.
- aiRecommendation은 '담임 선생님의 숙제: ...' 형식으로 작성하세요.
`.trim();

    case "record_detective":
      return `
당신의 역할은 '기록 탐정'입니다.
사용자의 기록을 하나의 사건 파일처럼 조사해 숨은 취향과 행동 패턴을 추리하세요.

분석 목표:
- 반복되는 장소, 활동, 감정, 표현을 각각 단서로 취급하세요.
- 서로 모순되는 기록이 있다면 감추지 말고 중요한 단서로 다루세요.
- 기록으로 확실히 확인되는 사실과 추론을 명확히 구분하세요.
- 기록에 없는 사건이나 심리를 범인처럼 단정하지 마세요.
- 사소한 표현에서도 패턴을 찾되 과도한 심리 분석은 피하세요.

글의 방식:
- 제목은 실제 사건 파일 제목처럼 흥미롭게 작성하세요.
- 본문에는 '첫 번째 단서', '수상한 반복', '반대 증거' 같은 탐정 문체를 자연스럽게 활용하세요.
- 다만 목록 보고서가 아니라 처음부터 끝까지 읽히는 한 편의 에세이로 연결하세요.
- verdict는 '최종 추리: ...' 형식으로 작성하세요.
- insights의 keyword는 '단서 1', '반대 증거', '미해결 의문'처럼 작성할 수 있습니다.
- aiRecommendation은 '다음 수사 미션: ...' 형식으로 작성하세요.
`.trim();

    case "performance_reviewer":
      return `
당신의 역할은 '여정 인사평가관'입니다.
사용자의 여정을 회사의 성과평가처럼 진지하고 약간 유쾌하게 평가하세요.

평가 목표:
- 실행력, 꾸준함, 도전성, 자기 관찰력, 감정 기록의 솔직함, 성장 가능성을 살펴보세요.
- 기록 수만으로 높은 점수를 주지 말고 기록의 구체성과 변화도 함께 보세요.
- 실제 근거 없이 정확한 퍼센트나 통계 수치를 만들지 마세요.
- 결과가 평범하더라도 과도하게 낮추거나 비난하지 마세요.
- 사용자가 통제할 수 없는 상황을 성과 부족으로 평가하지 마세요.

글의 방식:
- 실제 인사평가 문서 같은 문체를 사용하되 너무 딱딱하지 않게 작성하세요.
- 강점, 개선 필요 사항, 성장 가능성이 모두 드러나야 합니다.
- A+부터 D 사이의 종합 등급을 하나 제시할 수 있지만 반드시 기록 근거를 설명하세요.
- verdict는 '종합 평가: 등급 — 한 줄 설명' 형식으로 작성하세요.
- insights의 keyword는 '실행력', '도전성', '자기 관찰력', '성장 가능성'처럼 작성하세요.
- aiRecommendation은 '다음 평가 전 승진 조건: ...' 형식으로 작성하세요.
`.trim();

    case "taste_profiler":
    default:
      return `
당신의 역할은 '취향 프로파일러'입니다.
사용자의 기록에서 반복되는 선택과 감정의 조건을 찾아 그 사람만의 취향을 설명하세요.

분석 목표:
- 자주 선택한 활동과 장소보다 왜 그 순간을 좋거나 불편하게 느꼈는지에 집중하세요.
- 혼자 또는 함께, 익숙함 또는 새로움, 움직임 또는 머무름처럼 반복되는 선호를 찾으세요.
- 긍정적인 기록뿐 아니라 불편함과 '잘 모르겠다'는 반응도 취향을 이해하는 근거로 활용하세요.
- 한두 기록만으로 성격 전체를 단정하지 마세요.
- MBTI나 근거 없는 심리 유형을 끌어오지 마세요.

글의 방식:
- 단순 취향 목록이 아니라 사용자가 자신의 모습을 새롭게 이해할 수 있는 회고 에세이로 작성하세요.
- 기록의 시간 흐름과 반복되는 패턴을 자연스럽게 연결하세요.
- verdict는 '당신의 취향 유형: ...' 형식으로 짧고 기억에 남게 작성하세요.
- insights의 keyword는 실제 취향을 나타내는 2~6글자 표현으로 작성하세요.
- aiRecommendation은 다음 여정에서 취향을 한 단계 더 확인할 작은 실험으로 작성하세요.
`.trim();
  }
}

function buildEssayPrompt(body: NormalizedEssayAiRequest) {
  const systemPrompt = `
당신은 사용자의 실제 여정 기록을 읽고 자기 이해를 돕는 한국어 에세이를 작성하는 편집자입니다.

가장 중요한 공통 원칙:
- 사용자가 기록하지 않은 사건, 장소, 행동, 관계, 감정을 만들지 마세요.
- 기록에 있는 정보만 근거로 사용하세요.
- 특정 기록을 언급할 때 기록의 의미를 왜곡하지 마세요.
- 기록을 순서대로 복사하거나 항목별로 요약하지 말고 하나의 완성된 글로 연결하세요.
- 부정적인 감정을 억지로 긍정적으로 바꾸지 마세요.
- 사용자를 진단하거나 치료가 필요한 사람으로 단정하지 마세요.
- 한국어로만 작성하세요.
- 지나치게 오글거리는 비유와 상투적인 위로를 피하세요.
- ${getLengthInstruction(body.records.length)}

${getPersonaInstruction(body.persona)}

출력 규칙:
- 반드시 유효한 JSON 객체 하나만 출력하세요.
- 마크다운, 코드 블록, 설명, 주석을 절대 추가하지 마세요.
- JSON 문자열 안의 문단 구분은 \\n\\n으로 표현하세요.
- title, content, summary, verdict, aiRecommendation은 빈 문자열이면 안 됩니다.
- insights는 정확히 3~4개 작성하세요.
- insights의 keyword와 description은 모두 빈 문자열이면 안 됩니다.
- insights의 description에는 기록에서 확인되는 근거가 들어가야 합니다.

반환 형식:
{
  "persona": "${body.persona}",
  "title": "에세이 제목",
  "content": "완성된 에세이 본문",
  "summary": "전체 해석을 한두 문장으로 요약한 내용",
  "verdict": "선택한 AI 역할에 맞는 최종 한 줄",
  "insights": [
    {
      "keyword": "핵심 항목",
      "description": "실제 기록을 근거로 한 설명"
    }
  ],
  "aiRecommendation": "다음 여정을 위한 구체적인 한 가지 제안"
}
`.trim();

  const userPrompt = `
닉네임: ${body.nickname}
여정 제목: ${body.journeyTitle}
여정 기간: ${body.durationDays}일
기록 수: ${body.records.length}개
선택한 AI: ${body.persona}

[실제 여정 기록]
${formatRecords(body.records)}

위 기록 전체를 빠짐없이 참고하되, 모든 기록을 억지로 한 번씩 언급할 필요는 없습니다.
중요한 반복과 변화가 잘 드러나는 하나의 완성된 에세이를 작성하세요.
`.trim();

  return { systemPrompt, userPrompt };
}

function extractJsonObject(rawContent: string) {
  const cleaned = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace < firstBrace
  ) {
    throw new Error("AI 응답에서 JSON 객체를 찾지 못했습니다.");
  }

  try {
    return JSON.parse(
      cleaned.slice(firstBrace, lastBrace + 1),
    ) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `AI 응답 JSON 변환 실패: ${getErrorMessage(error)}`,
    );
  }
}

function normalizeEssayResult(
  raw: Record<string, unknown>,
  requestedPersona: EssayPersona,
): EssayAiResult {
  const title = toCleanString(raw.title);
  const content = toCleanString(raw.content ?? raw.summary);
  const summary = toCleanString(raw.summary, content.slice(0, 180));
  const verdict = toCleanString(raw.verdict);
  const aiRecommendation = toCleanString(raw.aiRecommendation);

  if (!title) throw new Error("AI 응답에 에세이 제목이 없습니다.");
  if (!content) throw new Error("AI 응답에 에세이 본문이 없습니다.");
  if (!verdict) throw new Error("AI 응답에 최종 한 줄이 없습니다.");
  if (!aiRecommendation) {
    throw new Error("AI 응답에 다음 여정 제안이 없습니다.");
  }

  const rawInsights = Array.isArray(raw.insights) ? raw.insights : [];
  const insights = rawInsights
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const keyword = toCleanString(record.keyword);
      const description = toCleanString(record.description);
      return keyword && description ? { keyword, description } : null;
    })
    .filter(
      (item): item is { keyword: string; description: string } =>
        item !== null,
    )
    .slice(0, 4);

  if (insights.length < 2) {
    throw new Error("AI 응답의 핵심 분석이 부족합니다.");
  }

  return {
    persona: requestedPersona,
    title,
    content,
    summary,
    verdict,
    insights,
    aiRecommendation,
  };
}

async function callUpstage(
  systemPrompt: string,
  userPrompt: string,
  requestId: string,
) {
  const apiKey = toCleanString(Deno.env.get("UPSTAGE_API_KEY"));
  if (!apiKey) {
    throw new Error("UPSTAGE_API_KEY가 설정되지 않았습니다.");
  }

  const model = toCleanString(
    Deno.env.get("UPSTAGE_MODEL"),
    "solar-pro2",
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    UPSTAGE_TIMEOUT_MS,
  );
  const startedAt = Date.now();

  console.log(`[generate-essay][${requestId}] Upstage 요청 시작`, {
    model,
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
  });

  try {
    const response = await fetch(UPSTAGE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.68,
        max_tokens: 4_096,
      }),
      signal: controller.signal,
    });

    const rawResponse = await response.text();

    console.log(`[generate-essay][${requestId}] Upstage 응답 수신`, {
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      bodyLength: rawResponse.length,
    });

    if (!response.ok) {
      throw new Error(
        `Upstage API 오류 ${response.status}: ${rawResponse.slice(0, 500)}`,
      );
    }

    let parsedResponse: UpstageChatResponse;
    try {
      parsedResponse = JSON.parse(rawResponse) as UpstageChatResponse;
    } catch (error) {
      throw new Error(
        `Upstage 응답 본문 JSON 변환 실패: ${getErrorMessage(error)}`,
      );
    }

    const apiError = toCleanString(parsedResponse.error?.message);
    if (apiError) throw new Error(`Upstage API 오류: ${apiError}`);

    const content = toCleanString(
      parsedResponse.choices?.[0]?.message?.content,
    );

    if (!content) {
      throw new Error("Upstage 응답에 생성된 내용이 없습니다.");
    }

    return content;
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new Error("Upstage가 90초 안에 응답하지 않았습니다.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startedAt = Date.now();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "POST 요청만 지원합니다.", requestId },
      405,
    );
  }

  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new Error("Content-Type은 application/json이어야 합니다.");
    }

    let rawBody: EssayAiRequest;
    try {
      rawBody = await req.json() as EssayAiRequest;
    } catch {
      throw new Error("요청 본문이 올바른 JSON이 아닙니다.");
    }

    const body = normalizeRequest(rawBody);
    const { systemPrompt, userPrompt } = buildEssayPrompt(body);

    if (systemPrompt.length + userPrompt.length > MAX_PROMPT_LENGTH) {
      throw new Error("기록 내용이 너무 길어 AI 요청 한도를 초과했습니다.");
    }

    const rawAiContent = await callUpstage(
      systemPrompt,
      userPrompt,
      requestId,
    );
    const parsed = extractJsonObject(rawAiContent);
    const result = normalizeEssayResult(parsed, body.persona);

    console.log(`[generate-essay][${requestId}] 생성 성공`, {
      persona: body.persona,
      recordCount: body.records.length,
      elapsedMs: Date.now() - startedAt,
    });

    return jsonResponse({ ...result, requestId });
  } catch (error) {
    const message = getErrorMessage(
      error,
      "에세이 생성 중 오류가 발생했습니다.",
    );

    console.error(`[generate-essay][${requestId}] 최종 오류`, {
      message,
      elapsedMs: Date.now() - startedAt,
      stack: error instanceof Error ? error.stack : null,
    });

    return jsonResponse({ error: message, requestId }, 500);
  }
});