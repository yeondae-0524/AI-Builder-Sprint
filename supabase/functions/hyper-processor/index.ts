type EssayStyle = "plain" | "balanced" | "emotional";
type EssayRequestType = "taste-report" | "sns-feed";
type PostcardFormat = "story" | "square";

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
  type?: unknown;
  nickname?: unknown;
  journeyTitle?: unknown;
  durationDays?: unknown;
  style?: unknown;
  postcardFormat?: unknown;
  records?: unknown;
};

type NormalizedEssayAiRequest = {
  type: EssayRequestType;
  nickname: string;
  journeyTitle: string;
  durationDays: number;
  style: EssayStyle;
  postcardFormat: PostcardFormat;
  records: EssayRecordInput[];
};

type TasteReportResult = {
  title: string;
  content: string;
  summary: string;
  insights: Array<{
    keyword: string;
    description: string;
  }>;
  aiRecommendation: string;
};

type PostcardSlide = {
  recordIndex: number;
  text: string;
};

type PostcardResult = {
  titleCardText: string;
  slides: PostcardSlide[];
  hashtags: string[];
  themeColor: string;
  accentColor: string;
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
  return new Response(
    JSON.stringify(payload),
    {
      status,
      headers: JSON_HEADERS,
    },
  );
}

function getErrorMessage(
  error: unknown,
  fallback = "알 수 없는 오류가 발생했습니다.",
) {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    const message = String(
      (error as { message?: unknown }).message ?? "",
    ).trim();

    if (message) {
      return message;
    }
  }

  return fallback;
}

function toCleanString(
  value: unknown,
  fallback = "",
) {
  const text = String(value ?? "")
    .replace(/\u0000/g, "")
    .trim();

  return text || fallback;
}

function toNullableString(
  value: unknown,
) {
  const text = toCleanString(value);
  return text || null;
}

function normalizeStyle(
  value: unknown,
): EssayStyle {
  if (
    value === "plain" ||
    value === "emotional"
  ) {
    return value;
  }

  return "balanced";
}

function normalizeRequestType(
  value: unknown,
): EssayRequestType {
  return value === "sns-feed"
    ? "sns-feed"
    : "taste-report";
}

function normalizePostcardFormat(
  value: unknown,
): PostcardFormat {
  return value === "square"
    ? "square"
    : "story";
}

function normalizeDurationDays(
  value: unknown,
) {
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

function normalizePhotoUrls(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => toCleanString(item))
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeRecord(
  value: unknown,
  index: number,
): EssayRecordInput {
  const raw =
    value &&
    typeof value === "object"
      ? value as Record<string, unknown>
      : {};

  const userContent =
    toCleanString(raw.userContent)
      .slice(
        0,
        MAX_RECORD_CONTENT_LENGTH,
      );

  if (!userContent) {
    throw new Error(
      `${index + 1}번째 기록의 내용이 비어 있습니다.`,
    );
  }

  return {
    missionTitle:
      toCleanString(
        raw.missionTitle,
        `기록 ${index + 1}`,
      ),

    missionDescription:
      toCleanString(
        raw.missionDescription,
      ),

    category:
      toNullableString(raw.category),

    recordedAt:
      toCleanString(
        raw.recordedAt,
        "날짜 정보 없음",
      ),

    userContent,

    emotion:
      toNullableString(raw.emotion),

    placeName:
      toNullableString(raw.placeName),

    photoUrls:
      normalizePhotoUrls(
        raw.photoUrls,
      ),
  };
}

function normalizeRequest(
  rawBody: EssayAiRequest,
): NormalizedEssayAiRequest {
  const rawRecords =
    Array.isArray(rawBody.records)
      ? rawBody.records
      : [];

  if (rawRecords.length === 0) {
    throw new Error(
      "에세이를 만들 기록이 없습니다.",
    );
  }

  if (
    rawRecords.length > MAX_RECORDS
  ) {
    throw new Error(
      `한 번에 최대 ${MAX_RECORDS}개의 기록만 처리할 수 있습니다.`,
    );
  }

  const records =
    rawRecords.map(
      normalizeRecord,
    );

  return {
    type:
      normalizeRequestType(
        rawBody.type,
      ),

    nickname:
      toCleanString(
        rawBody.nickname,
        "사용자",
      ),

    journeyTitle:
      toCleanString(
        rawBody.journeyTitle,
        "나의 여정",
      ),

    durationDays:
      normalizeDurationDays(
        rawBody.durationDays,
      ),

    style:
      normalizeStyle(
        rawBody.style,
      ),

    postcardFormat:
      normalizePostcardFormat(
        rawBody.postcardFormat,
      ),

    records,
  };
}

function getStyleInstruction(
  style: EssayStyle,
) {
  switch (style) {
    case "plain":
      return [
        "문체는 담백하고 차분하게 작성하세요.",
        "과장된 비유와 감탄 표현을 줄이고 실제 경험을 중심으로 쓰세요.",
      ].join("\n");

    case "emotional":
      return [
        "문체는 감성적으로 작성하되 기록에 없는 감정을 새로 만들지 마세요.",
        "사용자가 실제로 적은 감정과 분위기를 섬세하게 연결하세요.",
      ].join("\n");

    case "balanced":
    default:
      return [
        "문체는 사실과 감정을 균형 있게 작성하세요.",
        "자연스러운 블로그 에세이처럼 읽히도록 구성하세요.",
      ].join("\n");
  }
}

function formatRecords(
  records: EssayRecordInput[],
) {
  return records
    .map(
      (record, index) => {
        const lines = [
          `[기록 ${index + 1}]`,
          `recordIndex: ${index}`,
          `날짜: ${record.recordedAt}`,
          `미션: ${record.missionTitle}`,
        ];

        if (record.missionDescription) {
          lines.push(
            `미션 설명: ${record.missionDescription}`,
          );
        }

        if (record.category) {
          lines.push(
            `카테고리: ${record.category}`,
          );
        }

        if (record.placeName) {
          lines.push(
            `장소: ${record.placeName}`,
          );
        }

        if (record.emotion) {
          lines.push(
            `감정: ${record.emotion}`,
          );
        }

        lines.push(
          `사용자 기록: ${record.userContent}`,
        );

        if (
          record.photoUrls.length > 0
        ) {
          lines.push(
            `사진 수: ${record.photoUrls.length}`,
          );
        }

        return lines.join("\n");
      },
    )
    .join("\n\n");
}

function buildTasteReportPrompt(
  body: NormalizedEssayAiRequest,
) {
  const systemPrompt = `
당신은 사용자의 실제 여정 기록을 바탕으로 한 편의 완성된 한국어 에세이와 취향 인사이트를 작성하는 편집자입니다.

가장 중요한 원칙:
- 사용자가 기록하지 않은 사건, 장소, 행동, 관계, 감정을 만들지 마세요.
- 기록에 있는 정보만 활용하세요.
- 사용자의 1인칭 시점으로 작성하세요.
- 기록을 항목별로 단순 나열하지 말고 시간과 감정의 흐름이 느껴지는 하나의 글로 연결하세요.
- 기록 수와 상관없이 서론, 본론, 마무리가 있는 완결된 에세이를 작성하세요.
- 기록의 부정적인 감정도 억지로 긍정적으로 바꾸지 마세요.
- ${getStyleInstruction(body.style)}

출력 규칙:
- 반드시 유효한 JSON 객체 하나만 출력하세요.
- 마크다운, 코드 블록, 설명, 주석을 절대 추가하지 마세요.
- JSON 문자열 안의 줄바꿈은 \\n\\n으로 표현하세요.
- title과 content는 빈 문자열이면 안 됩니다.
- content는 충분히 구체적인 완성된 본문이어야 합니다.
- insights는 2~4개 작성하세요.
- insights의 keyword와 description은 모두 빈 문자열이면 안 됩니다.
- aiRecommendation은 다음 여정에서 시도할 수 있는 부담 없는 제안 1개로 작성하세요.

반환 형식:
{
  "title": "에세이 제목",
  "content": "완성된 1인칭 에세이 본문",
  "summary": "에세이 전체를 한두 문장으로 요약한 내용",
  "insights": [
    {
      "keyword": "취향 키워드",
      "description": "기록에서 이 취향이 드러난 이유"
    }
  ],
  "aiRecommendation": "다음 여정에서 시도할 수 있는 작은 제안"
}
`.trim();

  const userPrompt = `
닉네임: ${body.nickname}
여정 제목: ${body.journeyTitle}
여정 기간: ${body.durationDays}일
기록 수: ${body.records.length}개
선택 문체: ${body.style}

[실제 여정 기록]
${formatRecords(body.records)}

위 기록 전체를 빠짐없이 참고해 하나의 완성된 에세이로 작성하세요.
`.trim();

  return {
    systemPrompt,
    userPrompt,
  };
}

function buildPostcardPrompt(
  body: NormalizedEssayAiRequest,
) {
  const formatLabel =
    body.postcardFormat === "square"
      ? "인스타그램 게시물용 1:1 다중 이미지 카드뉴스"
      : "인스타그램 스토리용 9:16 다중 이미지 카드뉴스";

  const systemPrompt = `
당신은 사용자의 실제 여정 기록을 SNS 카드뉴스 형식으로 편집하는 한국어 카피라이터입니다.

첫 장에는 전체 여정을 나타내는 제목을 작성하세요.
그다음 장에는 각 기록에 대응하는 짧은 문구를 한 개씩 작성하세요.

작성 규칙:
- 사용자가 기록하지 않은 사건, 장소, 감정을 만들지 마세요.
- 기록의 순서와 recordIndex를 그대로 유지하세요.
- slides 배열은 반드시 기록 수와 동일한 ${body.records.length}개여야 합니다.
- recordIndex는 0부터 ${Math.max(
    body.records.length - 1,
    0,
  )}까지 한 번씩만 사용하세요.
- 각 슬라이드 문구는 짧은 한국어 1~2문장으로 작성하세요.
- 해시태그는 3~6개 작성하세요.
- 색상은 반드시 #RRGGBB 형식의 HEX 코드로 작성하세요.
- 마크다운과 코드 블록을 사용하지 마세요.
- JSON 앞뒤에 설명을 작성하지 마세요.
- JSON 주석을 작성하지 마세요.
- 반드시 유효한 JSON 객체 하나만 반환하세요.

${getStyleInstruction(body.style)}

반환 형식:
{
  "titleCardText": "여정 전체를 표현하는 제목",
  "slides": [
    {
      "recordIndex": 0,
      "text": "첫 번째 기록에 대응하는 문구"
    }
  ],
  "hashtags": [
    "#태그1",
    "#태그2",
    "#태그3"
  ],
  "themeColor": "#F4F1EA",
  "accentColor": "#3D5AFE"
}
`.trim();

  const userPrompt = `
닉네임: ${body.nickname}
여정 제목: ${body.journeyTitle}
제작 형식: ${formatLabel}
기록 수: ${body.records.length}개

[이번 여정의 기록]
${formatRecords(body.records)}

위 기록 ${body.records.length}개에 대응하는 slides를 정확히 ${body.records.length}개 작성하세요.
`.trim();

  return {
    systemPrompt,
    userPrompt,
  };
}

function extractJsonObject(
  rawContent: string,
) {
  const cleaned = rawContent
    .trim()
    .replace(
      /^```(?:json)?\s*/i,
      "",
    )
    .replace(
      /\s*```$/i,
      "",
    )
    .trim();

  const firstBrace =
    cleaned.indexOf("{");

  const lastBrace =
    cleaned.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace < firstBrace
  ) {
    throw new Error(
      "AI 응답에서 JSON 객체를 찾지 못했습니다.",
    );
  }

  const jsonText =
    cleaned.slice(
      firstBrace,
      lastBrace + 1,
    );

  try {
    return JSON.parse(
      jsonText,
    ) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `AI 응답 JSON 변환 실패: ${getErrorMessage(error)}`,
    );
  }
}

function normalizeHexColor(
  value: unknown,
  fallback: string,
) {
  const candidate =
    toCleanString(value);

  return /^#[0-9a-f]{6}$/i.test(
    candidate,
  )
    ? candidate.toUpperCase()
    : fallback;
}

function normalizeHashtags(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((tag) =>
          toCleanString(tag)
            .replace(/\s+/g, ""),
        )
        .filter(Boolean)
        .map((tag) =>
          tag.startsWith("#")
            ? tag
            : `#${tag}`,
        ),
    ),
  ).slice(0, 6);
}

function normalizeTasteReportResult(
  raw: Record<string, unknown>,
): TasteReportResult {
  const title =
    toCleanString(raw.title);

  const content =
    toCleanString(
      raw.content ??
      raw.summary,
    );

  const summary =
    toCleanString(
      raw.summary,
      content.slice(0, 160),
    );

  if (!title) {
    throw new Error(
      "AI 응답에 에세이 제목이 없습니다.",
    );
  }

  if (!content) {
    throw new Error(
      "AI 응답에 에세이 본문이 없습니다.",
    );
  }

  const rawInsights =
    Array.isArray(raw.insights)
      ? raw.insights
      : [];

  const insights =
    rawInsights
      .map((item) => {
        if (
          !item ||
          typeof item !== "object"
        ) {
          return null;
        }

        const record =
          item as Record<string, unknown>;

        const keyword =
          toCleanString(
            record.keyword,
          );

        const description =
          toCleanString(
            record.description,
          );

        if (
          !keyword ||
          !description
        ) {
          return null;
        }

        return {
          keyword,
          description,
        };
      })
      .filter(
        (
          item,
        ): item is {
          keyword: string;
          description: string;
        } => item !== null,
      )
      .slice(0, 4);

  const aiRecommendation =
    toCleanString(
      raw.aiRecommendation,
      "다음 여정에서도 마음에 남는 순간을 짧게 기록해보세요.",
    );

  return {
    title,
    content,
    summary,
    insights,
    aiRecommendation,
  };
}

function normalizePostcardResult(
  raw: Record<string, unknown>,
  recordCount: number,
): PostcardResult {
  const titleCardText =
    toCleanString(
      raw.titleCardText,
    );

  if (!titleCardText) {
    throw new Error(
      "AI 응답에 카드뉴스 제목이 없습니다.",
    );
  }

  const rawSlides =
    Array.isArray(raw.slides)
      ? raw.slides
      : [];

  const slideMap =
    new Map<number, string>();

  for (const item of rawSlides) {
    if (
      !item ||
      typeof item !== "object"
    ) {
      continue;
    }

    const record =
      item as Record<string, unknown>;

    const recordIndex =
      Number(record.recordIndex);

    const text =
      toCleanString(record.text);

    if (
      Number.isInteger(recordIndex) &&
      recordIndex >= 0 &&
      recordIndex < recordCount &&
      text &&
      !slideMap.has(recordIndex)
    ) {
      slideMap.set(
        recordIndex,
        text,
      );
    }
  }

  const slides =
    Array.from(
      {
        length: recordCount,
      },
      (_, recordIndex) => ({
        recordIndex,
        text:
          slideMap.get(
            recordIndex,
          ) ?? "",
      }),
    );

  const missingIndexes =
    slides
      .filter(
        (slide) =>
          !slide.text,
      )
      .map(
        (slide) =>
          slide.recordIndex,
      );

  if (
    missingIndexes.length > 0
  ) {
    throw new Error(
      `AI 카드뉴스 응답에서 다음 기록의 문구가 누락됐습니다: ${missingIndexes.join(", ")}`,
    );
  }

  const hashtags =
    normalizeHashtags(
      raw.hashtags,
    );

  return {
    titleCardText,
    slides,
    hashtags:
      hashtags.length > 0
        ? hashtags
        : ["#나의여정", "#일상기록", "#작은발견"],

    themeColor:
      normalizeHexColor(
        raw.themeColor,
        "#F4F1EA",
      ),

    accentColor:
      normalizeHexColor(
        raw.accentColor,
        "#3D5AFE",
      ),
  };
}

async function callUpstage(
  systemPrompt: string,
  userPrompt: string,
  requestId: string,
) {
  const apiKey =
    toCleanString(
      Deno.env.get(
        "UPSTAGE_API_KEY",
      ),
    );

  if (!apiKey) {
    throw new Error(
      "UPSTAGE_API_KEY가 설정되지 않았습니다.",
    );
  }

  const model =
    toCleanString(
      Deno.env.get(
        "UPSTAGE_MODEL",
      ),
      "solar-pro2",
    );

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () => {
        controller.abort();
      },
      UPSTAGE_TIMEOUT_MS,
    );

  const startedAt =
    Date.now();

  console.log(
    `[hyper-processor][${requestId}] Upstage 요청 시작`,
    {
      model,
      systemPromptLength:
        systemPrompt.length,
      userPromptLength:
        userPrompt.length,
    },
  );

  try {
    const response =
      await fetch(
        UPSTAGE_API_URL,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              model,

              messages: [
                {
                  role: "system",
                  content:
                    systemPrompt,
                },
                {
                  role: "user",
                  content:
                    userPrompt,
                },
              ],

              temperature: 0.65,
              max_tokens: 4_096,
            }),

          signal:
            controller.signal,
        },
      );

    const rawResponse =
      await response.text();

    console.log(
      `[hyper-processor][${requestId}] Upstage 응답 수신`,
      {
        status:
          response.status,

        elapsedMs:
          Date.now() -
          startedAt,

        bodyLength:
          rawResponse.length,
      },
    );

    if (!response.ok) {
      console.error(
        `[hyper-processor][${requestId}] Upstage 오류 응답`,
        rawResponse.slice(
          0,
          1_500,
        ),
      );

      throw new Error(
        `Upstage API 오류 ${response.status}: ${rawResponse.slice(0, 500)}`,
      );
    }

    let parsedResponse:
      UpstageChatResponse;

    try {
      parsedResponse =
        JSON.parse(
          rawResponse,
        ) as UpstageChatResponse;
    } catch (error) {
      throw new Error(
        `Upstage 응답 본문 JSON 변환 실패: ${getErrorMessage(error)}`,
      );
    }

    const apiError =
      toCleanString(
        parsedResponse.error?.message,
      );

    if (apiError) {
      throw new Error(
        `Upstage API 오류: ${apiError}`,
      );
    }

    const content =
      toCleanString(
        parsedResponse
          .choices?.[0]
          ?.message?.content,
      );

    if (!content) {
      throw new Error(
        "Upstage 응답에 생성된 내용이 없습니다.",
      );
    }

    return content;
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "Upstage가 90초 안에 응답하지 않았습니다.",
      );
    }

    throw error;
  } finally {
    clearTimeout(
      timeoutId,
    );
  }
}

Deno.serve(
  async (req) => {
    const requestId =
      crypto.randomUUID()
        .slice(0, 8);

    const startedAt =
      Date.now();

    if (
      req.method === "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            CORS_HEADERS,
        },
      );
    }

    if (
      req.method !== "POST"
    ) {
      return jsonResponse(
        {
          error:
            "POST 요청만 지원합니다.",
          requestId,
        },
        405,
      );
    }

    try {
      console.log(
        `[hyper-processor][${requestId}] 요청 수신`,
      );

      const contentType =
        req.headers.get(
          "content-type",
        ) ?? "";

      if (
        !contentType
          .toLowerCase()
          .includes(
            "application/json",
          )
      ) {
        throw new Error(
          "Content-Type은 application/json이어야 합니다.",
        );
      }

      let rawBody:
        EssayAiRequest;

      try {
        rawBody =
          await req.json() as EssayAiRequest;
      } catch {
        throw new Error(
          "요청 본문이 올바른 JSON이 아닙니다.",
        );
      }

      const body =
        normalizeRequest(
          rawBody,
        );

      console.log(
        `[hyper-processor][${requestId}] 요청 검증 완료`,
        {
          type:
            body.type,

          style:
            body.style,

          recordCount:
            body.records.length,

          durationDays:
            body.durationDays,
        },
      );

      const {
        systemPrompt,
        userPrompt,
      } =
        body.type ===
          "sns-feed"
          ? buildPostcardPrompt(
              body,
            )
          : buildTasteReportPrompt(
              body,
            );

      if (
        systemPrompt.length +
          userPrompt.length >
        MAX_PROMPT_LENGTH
      ) {
        throw new Error(
          "기록 내용이 너무 길어 AI 요청 한도를 초과했습니다.",
        );
      }

      const rawAiContent =
        await callUpstage(
          systemPrompt,
          userPrompt,
          requestId,
        );

      console.log(
        `[hyper-processor][${requestId}] AI 내용 파싱 시작`,
        {
          contentLength:
            rawAiContent.length,
        },
      );

      const parsed =
        extractJsonObject(
          rawAiContent,
        );

      const result =
        body.type ===
          "sns-feed"
          ? normalizePostcardResult(
              parsed,
              body.records.length,
            )
          : normalizeTasteReportResult(
              parsed,
            );

      console.log(
        `[hyper-processor][${requestId}] 생성 성공`,
        {
          type:
            body.type,

          elapsedMs:
            Date.now() -
            startedAt,
        },
      );

      return jsonResponse({
        ...result,
        requestId,
      });
    } catch (error) {
      const message =
        getErrorMessage(
          error,
          "에세이 생성 중 오류가 발생했습니다.",
        );

      console.error(
        `[hyper-processor][${requestId}] 최종 오류`,
        {
          message,
          elapsedMs:
            Date.now() -
            startedAt,

          stack:
            error instanceof Error
              ? error.stack
              : null,
        },
      );

      return jsonResponse(
        {
          error:
            message,
          requestId,
        },
        500,
      );
    }
  },
);