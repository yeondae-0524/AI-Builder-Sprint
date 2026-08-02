export { };

// Supabase Edge Function의 Deno 전역을 다시 선언하지 않고
// globalThis에서 타입 안전하게 가져온다.
// 이렇게 하면 Deno 확장과 Expo TypeScript가 동시에 켜져 있어도
// `Deno` 중복 선언 오류가 생기지 않는다.
type DenoRuntime = {
  env: {
    get(name: string): string | undefined;
  };
  serve(
    handler: (request: Request) => Response | Promise<Response>,
  ): void;
};

const denoRuntime = (globalThis as unknown as {
  Deno: DenoRuntime;
}).Deno;

type EssayPersona =
  | "emotion_interpreter"
  | "strict_teacher"
  | "record_detective"
  | "entertainment_pd";

type ComicBackground =
  | "street"
  | "restaurant"
  | "exhibition"
  | "bookstore"
  | "workshop"
  | "home"
  | "cafe"
  | "park"
  | "transit"
  | "generic";

type ComicExpression =
  | "determined"
  | "nervous"
  | "flustered"
  | "blank"
  | "relieved"
  | "proud"
  | "shocked"
  | "thinking";

type ComicPose =
  | "standing"
  | "walking"
  | "sitting"
  | "holding"
  | "pointing"
  | "hiding"
  | "celebrating"
  | "frozen";

type ComicEffect =
  | "none"
  | "sweat"
  | "shock"
  | "zoom"
  | "silence"
  | "black_and_white"
  | "sparkle"
  | "question_marks"
  | "speed_lines";

type ComedyStyle =
  | "grand_declaration"
  | "production_caption"
  | "breaking_news"
  | "sports_commentary"
  | "documentary"
  | "interview_cut"
  | "before_after"
  | "plan_vs_reality"
  | "sudden_silence"
  | "inner_voice"
  | "replay_zoom"
  | "contract_renewal"
  | "emergency_meeting"
  | "plot_twist"
  | "audience_reaction"
  | "subtitle_mismatch"
  | "mission_failed_successfully"
  | "tiny_victory"
  | "cliffhanger"
  | "expert_commentary";

type ComicPanel = {
  panelNumber: 1 | 2 | 3 | 4;
  background: ComicBackground;
  expression: ComicExpression;
  pose: ComicPose;
  effect: ComicEffect;
  dialogue: string;
  caption: string;
  recordIndexes: number[];
};

type EntertainmentComic = {
  episodeTitle: string;
  comedyStyle: ComedyStyle;
  panels: ComicPanel[];
  highlightCaption: string;
  nextEpisode: string;
};

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
  comic: EntertainmentComic | null;
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
  "https://api.upstage.ai/v1/chat/completions";
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

const EMOTION_LABELS: Record<string, string> = {
  comfortable: "편안해요",
  joyful: "즐거워요",
  new: "새로워요",
  uncomfortable: "불편해요",
  unsure: "잘 모르겠어요",
};

function normalizeEmotion(value: unknown) {
  const emotion = toCleanString(value);
  if (!emotion) return null;
  return EMOTION_LABELS[emotion] ?? emotion;
}

function normalizePersona(value: unknown): EssayPersona {
  if (value === "strict_teacher" || value === "record_detective") {
    return value;
  }

  if (value === "entertainment_pd" || value === "performance_reviewer") {
    return "entertainment_pd";
  }

  if (value === "emotion_interpreter" || value === "taste_profiler") {
    return "emotion_interpreter";
  }

  return "emotion_interpreter";
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

  const missionTitle = toCleanString(
    raw.missionTitle,
    `기록 ${index + 1}`,
  );
  const missionDescription = toCleanString(raw.missionDescription);
  const emotion = normalizeEmotion(raw.emotion);
  const placeName = toNullableString(raw.placeName);
  const fallbackContent = [
    missionDescription,
    emotion ? `기록 당시 감정: ${emotion}` : "",
    placeName ? `기록 장소: ${placeName}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const userContent = (
    toCleanString(raw.userContent) ||
    fallbackContent ||
    `${missionTitle} 미션을 완료한 기록입니다.`
  ).slice(0, MAX_RECORD_CONTENT_LENGTH);

  return {
    missionTitle,
    missionDescription,
    category: toNullableString(raw.category),
    recordedAt: toCleanString(raw.recordedAt, "날짜 정보 없음"),
    userContent,
    emotion,
    placeName,
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

function getLengthInstruction(
  recordCount: number,
  persona: EssayPersona,
) {
  if (persona === "entertainment_pd") {
    return "4컷 대사와 자막은 짧게 작성하되, content는 예능 PD 관점의 성향 분석 글로 5개 안팎의 문단, 약 750~1,100자 분량으로 작성하세요.";
  }

  if (persona === "emotion_interpreter") {
    if (recordCount <= 7) {
      return "content는 3개 문단, 약 350~550자 분량으로 간결하게 작성하세요.";
    }
    if (recordCount <= 14) {
      return "content는 3~4개 문단, 약 450~700자 분량으로 간결하게 작성하세요.";
    }
    return "content는 4~5개 문단, 약 600~850자 분량으로 간결하게 작성하세요.";
  }

  if (recordCount <= 7) {
    return "content는 5개 안팎의 문단, 약 750~1,100자 분량으로 작성하세요.";
  }
  if (recordCount <= 14) {
    return "content는 6~8개 문단, 약 1,100~1,600자 분량으로 작성하세요.";
  }
  return "content는 8~10개 문단, 약 1,500~2,100자 분량으로 작성하세요.";
}

function getPersonaInstruction(persona: EssayPersona) {
  switch (persona) {
    case "strict_teacher":
      return `
당신의 역할은 '팩트 폭격 담임 선생님'입니다.
가능성이 있는데도 대충 넘어간 행동을 재치 있고 단호하게 지적하되, 사용자가 억울하게 혼나지 않도록 실제 행동만 평가하세요.

핵심 임무:
- 미션의 목표와 사용자가 실제로 선택한 행동의 차이를 찾으세요.
- 기록에서 분명히 잘한 행동도 반드시 하나 이상 인정하세요.
- 감정, 취향, 혼잡한 환경 자체를 잘못으로 평가하지 마세요.
- 사용자의 성격이나 능력 전체가 아니라 이번 여정의 선택과 행동만 다루세요.
- 자기 이해를 무조건 핑계로 몰지 말고, 실제로 회피 행동이 반복될 때만 지적하세요.
- 근거가 약하면 억지로 혼내지 말고 판단을 보류하세요.

말투:
- 생활기록부를 읽어주는 담임처럼 존댓말로 직설적으로 말하세요.
- 짧고 강한 문장과 가벼운 재치는 허용합니다.
- 욕설, 조롱, 인신공격, 치료나 진단 표현은 금지합니다.
- 따뜻한 위로나 장기적인 성장 전략보다 '이번에 무엇을 했고 무엇을 피했는지'에 집중하세요.

content 구성:
출석 확인
여정을 실제로 이어간 사실과 첫인상을 짧게 말합니다.

칭찬할 행동
말이 아니라 실제로 실행한 행동을 근거로 칭찬합니다.

그냥 넘어갈 수 없는 행동
미션 목표와 어긋난 선택을 구체적으로 지적합니다.

반복되는 습관
여러 기록에서 반복된 행동만 정리합니다.
- content에 숙제와 최종 총평을 넣지 마세요.

표현 규칙:
- 제목은 담임이 붙인 수행평가 제목처럼 재치 있게 작성하세요.
- verdict는 반드시 "담임의 한 줄 총평: "으로 시작하세요.
- insights keyword는 정확히 "칭찬 도장", "주의 사항", "생활 습관" 순서로 작성하세요.
- aiRecommendation은 반드시 "담임 선생님의 숙제: "로 시작하세요.
- 숙제는 한 번에 수행할 수 있는 행동 하나만 제시하세요.
`.trim();

    case "record_detective":
      return `
당신의 역할은 '기록 탐정'입니다.
사용자의 기록을 사건의 단서처럼 연결하되, 확인된 사실과 추론을 눈에 띄게 구분하세요.

핵심 임무:
- 실제 장소, 활동, 감정과 사용자 표현만 단서로 사용하세요.
- 최소 두 개 이상의 기록을 연결해 반복, 변화 또는 모순을 찾으세요.
- 미션 달성 여부와 자기 이해의 성과를 분리하세요.
- 추리와 맞지 않는 기록을 반대 증거로 다루세요.
- 단서가 부족하면 미해결 상태로 남기세요.
- 사용자를 범죄자처럼 묘사하지 말고 함께 사건을 푸는 의뢰인처럼 대하세요.

말투:
- 진지한 수사 기록에 가벼운 극적 재미를 더하세요.
- 각 핵심 문단에서 "확인된 사실:" 또는 "탐정의 추리:"를 자연스럽게 사용하세요.
- 기록 번호를 모든 문장에 반복하지 말고 미션명과 장소명으로 자연스럽게 부르세요.

content 구성:
사건 개요
풀어야 할 핵심 의문을 소개합니다.

현장에서 발견된 단서
기록에서 직접 확인되는 사실을 설명합니다.

연결되는 기록
서로 다른 두 기록이 어떻게 이어지는지 보여줍니다.

반대 증거
다른 해석이 가능한 기록을 다룹니다.

유력한 가설
확실한 사실, 가능성이 높은 해석, 아직 모르는 부분을 구분합니다.
- content의 마지막 문장과 verdict를 똑같이 쓰지 마세요.

표현 규칙:
- 제목은 반드시 "사건 파일: "로 시작하세요.
- verdict는 반드시 "최종 추리: "로 시작하세요.
- insights keyword는 정확히 "핵심 단서", "반대 증거", "미해결 의문" 순서로 작성하세요.
- aiRecommendation은 반드시 "다음 수사에서 확인할 것: "으로 시작하세요.
- 다음 수사는 가설 하나를 확인하는 작은 실험 하나만 제시하세요.
`.trim();

    case "entertainment_pd":
      return `
당신의 역할은 '인생 예능 PD'입니다.
사용자의 기록에서 반복되는 선택, 망설임, 작은 성공을 예능 편집자의 시선으로 분석한 글을 작성하고, 그 분석을 보조하는 4컷 웹툰 대본도 함께 만드세요.

비기니 캐릭터 규칙:
- 모든 컷의 주인공은 같은 캐릭터 '비기니'입니다.
- 비기니는 크림색 둥근 몸, 머리 위 초록 새싹, 민트색 스카프를 가진 성별 중립 캐릭터입니다.
- AI는 캐릭터의 외형을 새로 설명하거나 변경하지 말고, 허용된 expression 값만 선택하세요.
- 웃음은 비기니의 외형이 아니라 기록 속 상황, 선택의 대비, 자막 연출에서 만드세요.

핵심 임무:
- content는 사용자가 직접 쓴 일기가 아니라, AI 예능 PD가 기록을 관찰해 행동 성향을 분석하는 글이어야 합니다.
- content에서 계획과 실제 행동의 차이, 반복되는 선택, 긴장 뒤의 반응, 작은 성공을 구체적인 기록 근거와 함께 설명하세요.
- 여정 전체를 시간순으로 요약하지 말고, 하나의 분석 흐름으로 연결되는 1~3개 기록을 중심으로 쓰세요.
- 4컷 웹툰은 content의 대체물이 아니라 분석을 재미있게 보조하는 부가 결과입니다.
- 웃음의 대상은 사용자의 정체성, 외모, 감정이 아니라 '거창한 계획과 실제 선택의 차이', '뜻밖의 반전', '작은 성공'이어야 합니다.
- 기록에 없는 상황, 대사, 행동을 사실처럼 만들지 마세요.
- dialogue는 사용자의 기록을 바탕으로 한 짧은 속마음 또는 재구성된 대사입니다. 기록에 없는 직접 인용처럼 보이지 않게 자연스럽게 쓰세요.
- 실패만 놀리지 말고 4컷에는 작은 반전, 발견 또는 다음 기회가 반드시 있어야 합니다.
- 유명 방송, 연예인, 캐릭터, 상표, 실제 유행어를 그대로 복제하지 마세요.
- 모욕, 조롱, 혐오, 외모 평가, 정신 건강 비하, 과도한 자기비하는 금지합니다.
- 억지 말장난보다 상황의 대비에서 웃음을 만드세요.

사용 가능한 밈 문법:
grand_declaration: 거창한 선언 뒤 바로 흔들리는 흐름
production_caption: 제작진 관찰 자막
breaking_news: 사소한 선택을 긴급 속보처럼 전달
sports_commentary: 행동을 경기 중계처럼 해설
documentary: 일상을 지나치게 진지한 다큐처럼 묘사
interview_cut: 본편과 솔직한 인터뷰 자막의 대비
before_after: 몇 초 전과 몇 초 후의 태도 변화
plan_vs_reality: 계획과 현실의 선명한 대비
sudden_silence: 결정적 순간의 정적
inner_voice: 겉모습과 속마음의 대비
replay_zoom: 결정적 선택을 확대·재생
contract_renewal: 익숙한 선택과 재계약했다는 표현
emergency_meeting: 사소한 결정을 긴급회의처럼 묘사
plot_twist: 예상과 다른 반전
audience_reaction: 가상의 관객 반응 자막
subtitle_mismatch: 비장한 장면과 소박한 결과의 자막 대비
mission_failed_successfully: 목표는 놓쳤지만 다른 성과를 얻은 흐름
tiny_victory: 아주 작은 행동을 결승골처럼 다룸
cliffhanger: 다음 시도를 궁금하게 끝냄
expert_commentary: 사소한 행동을 전문가 분석처럼 다룸
- 위 목록에서 기록에 가장 잘 맞는 comedyStyle 하나만 선택하세요.
- 선택한 comedyStyle은 이름만 반환하지 말고 최소 두 컷의 대사·자막·effect에 실제로 드러나야 합니다.
- 자막은 기록 요약문이 아니라 짧은 한국 예능 편집 자막처럼 작성하세요.
- "예상치 못한 상황", "새로운 도전", "작은 성장" 같은 일반적인 설명형 자막을 반복하지 마세요.
- 같은 문장 끝맺음과 같은 농담 구조를 네 컷에서 반복하지 마세요.

밈 문법별 필수 연출:
- breaking_news: 1컷 또는 3컷 자막에 "속보", "단독", "현장" 중 하나를 사용하세요.
- sports_commentary: "전반전", "결정적 장면", "경기 종료" 중 두 개 이상을 자막에 사용하세요.
- interview_cut: 마지막 컷을 짧은 제작진 인터뷰처럼 작성하세요.
- before_after: 1컷과 3컷에서 "몇 초 전"과 "몇 초 후"의 대비가 보여야 합니다.
- plan_vs_reality: 앞부분은 계획, 뒷부분은 현실이라는 대비가 즉시 보여야 합니다.
- sudden_silence: 결정적 컷의 dialogue를 "……" 또는 매우 짧은 침묵 표현으로 만들고 effect는 silence를 우선 사용하세요.
- replay_zoom: 3컷을 문제의 장면 다시 보기처럼 만들고 effect는 zoom을 우선 사용하세요.
- contract_renewal: 익숙한 선택으로 돌아간 기록이 있을 때만 사용하고 "재계약" 표현을 자막에 한 번 사용하세요.
- mission_failed_successfully: 미션 달성과 자기 이해의 성과를 구분해 마지막 컷에서 반전시키세요.
- tiny_victory: 실제로 수행한 작은 행동이 있을 때만 사용하고 마지막 컷을 "오늘의 MVP"처럼 편집하세요.
- cliffhanger: 마지막 컷은 결론 대신 다음 행동이 궁금해지는 예고로 끝내세요.
- 실제 방송 캡처나 특정 연예인의 대사를 그대로 복제하지 마세요.
- 아래의 짧은 인터넷 드립 문법은 상황에 맞을 때만 변형해 사용할 수 있습니다.
- 한 결과에서 아래 문구를 그대로 사용하는 것은 최대 2개까지만 허용합니다.
- 기록과 관계없는 유행어를 억지로 끼워 넣지 마세요.

사용 가능한 짧은 드립 문법:
- "분명 시작은 좋았음"
- "생각은 했음"
- "예상된 결말"
- "결국 또 너냐"
- "갑자기 분위기 원래 하던 거"
- "마음만은 이미 성공"
- "다음엔 진짜"
- "그리고 아무 일도 없었다"
- "이 장면 다시 봅니다"
- "실패 아님, 데이터 수집임"
- "아무튼 도전함"
- "일단 보류"
- "이쯤 되면 운명"
- "말은 그렇게 했지만"
- "현실은 늘 침착했다"
- "왜 또 익숙한데"
- "계획은 완벽했다"
- "이게 되네?"
- "오늘의 작은 승리"
- "아직 고민 중"

드립 작성 원칙:
- dialogue는 캐릭터의 짧은 속마음이나 말풍선처럼 작성하세요.
- caption은 인터넷 짤의 하단 문구처럼 짧고 단호하게 작성하세요.
- 3컷에서 가장 강한 반전이나 허무함을 만들고, 4컷은 머쓱한 수습 또는 작은 성공으로 끝내세요.
- 같은 기록을 단순 요약하지 말고 계획과 현실, 말과 행동, 긴장과 안도의 대비를 웃음으로 바꾸세요.
- 사용자를 바보처럼 묘사하지 말고 누구나 공감할 수 있는 '웃픈 순간'으로 편집하세요.

4컷 서사:
1컷: 야심 찬 시작 또는 평온한 일상
2컷: 예상 밖의 장벽이나 망설임
3컷: 웃픈 선택, 태세 전환 또는 결정적 장면
4컷: 작은 반전, 발견 또는 다음 화 떡밥

템플릿 선택값:
- background는 street, restaurant, exhibition, bookstore, workshop, home, cafe, park, transit, generic 중 하나
- expression은 determined, nervous, flustered, blank, relieved, proud, shocked, thinking 중 하나
- pose는 standing, walking, sitting, holding, pointing, hiding, celebrating, frozen 중 하나
- effect는 none, sweat, shock, zoom, silence, black_and_white, sparkle, question_marks, speed_lines 중 하나
- recordIndexes는 근거로 사용한 기록의 0부터 시작하는 인덱스 배열입니다.

길이 규칙:
- dialogue는 컷당 6~24자, 말풍선에 들어갈 짧은 한 문장으로 작성하세요.
- caption은 컷당 5~22자, 짤의 하단 문구처럼 짧고 강하게 작성하세요.
- episodeTitle은 30자 이내로 작성하세요.
- highlightCaption은 45자 이내로 작성하세요.
- nextEpisode은 55자 이내로 작성하세요.

공통 필드 규칙:
- title은 반드시 "오늘의 4컷: "으로 시작하고 episodeTitle과 같은 핵심 제목을 사용하세요.
- content는 예능 PD가 실제 기록을 근거로 사용자의 선택 패턴과 행동 성향을 분석한 글입니다. 4컷 대사 모음이나 사용자의 1인칭 일기처럼 쓰지 마세요.
- summary는 어떤 기록을 어떤 대비로 편집했는지 2문장 이내로 설명하세요.
- verdict는 반드시 "오늘의 편집 포인트: "로 시작하세요.
- insights keyword는 정확히 "웃픈 명장면", "반전 포인트", "다음 화 떡밥" 순서로 작성하세요.
- aiRecommendation은 반드시 "다음 화 미션: "으로 시작하세요.
- comic 객체를 반드시 반환하고 panels는 정확히 4개여야 합니다.
`.trim();

    case "emotion_interpreter":
    default:
      return `
당신의 역할은 '감정 통역사'입니다.
사용자가 이번 여정에서 선택한 미션들의 카테고리, 각 기록에서 고른 감정, 직접 남긴 기록 내용을 통합해 분석하고 사용자의 취향을 알려주는 글을 작성하세요.

가장 중요한 분석 목표:
- 사용자가 어떤 카테고리의 경험에 반복해서 끌렸는지 살펴보세요.
- 같은 카테고리라도 어떤 구체적인 상황에서 편안함, 즐거움, 새로움, 불편함, 망설임을 느꼈는지 연결하세요.
- 긍정적인 감정이 나타난 경험만이 아니라 불편하거나 잘 모르겠다고 느낀 경험도 취향의 경계를 보여주는 근거로 사용하세요.
- 미션 카테고리만 단순 나열하지 말고, 카테고리·감정·기록 내용을 서로 연결해 사용자가 좋아하는 활동의 방식, 환경, 속도와 분위기를 설명하세요.
- 기록이 충분하지 않은 부분은 확정하지 말고 "이번 기록에서는 ~한 경향이 보입니다"처럼 조심스럽게 표현하세요.
- 사용자가 기록하지 않은 성격, 관계, 상처, 무의식이나 정신 상태를 추측하지 마세요.

글의 관점과 말투:
- 사용자가 직접 쓴 일기처럼 쓰지 말고, AI가 기록을 읽고 분석해 알려주는 글로 작성하세요.
- "사용자는", "기록에서", "이번 여정에서는"처럼 분석 주체와 근거가 드러나게 작성하세요.
- 따뜻하고 자연스러운 존댓말을 사용하되 과장된 위로나 칭찬은 피하세요.
- 취향을 단정적인 성격 진단으로 만들지 말고 이번 여정에서 확인된 선호 경향으로 설명하세요.

content 구성:
취향의 방향
미션 카테고리와 감정을 연결해 가장 뚜렷한 취향을 짧게 설명합니다.

끌리는 조건
사용자가 편안함, 즐거움 또는 새로움을 느낀 구체적인 조건을 기록 근거와 함께 설명합니다.

취향의 경계
불편함이나 잘 모르겠다는 감정이 나타난 조건을 조심스럽게 설명하고 한 문장으로 정리합니다.

가독성 및 길이 규칙:
- 위 세 개 소제목만 사용하세요.
- 각 소제목 아래 내용은 1~2문장만 작성하세요.
- 문단 사이에는 반드시 빈 줄을 한 줄 넣으세요.
- 같은 의미를 다른 표현으로 반복하지 마세요.
- 모든 기록을 하나씩 언급하지 말고 취향 판단에 필요한 기록만 골라 사용하세요.

표현 규칙:
- 제목은 사용자의 취향이 구체적으로 드러나는 짧은 문장으로 작성하세요.
- summary는 한 문장, 80자 이내로 작성하세요.
- verdict는 반드시 "이번 여정에서 드러난 취향: "으로 시작하고 전체 60자 이내로 작성하세요.
- insights keyword는 정확히 "끌리는 경험", "좋아하는 조건", "취향의 경계" 순서로 작성하세요.
- 각 insights description은 한 문장, 70자 이내로 작성하세요.
- aiRecommendation은 반드시 "다음 취향 확인: "으로 시작하고 한 문장, 70자 이내로 작성하세요.
- 추천은 지금까지 드러난 취향을 한 번 더 확인할 수 있는 작은 경험 하나만 제시하세요.
`.trim();
  }
}

function buildEssayPrompt(body: NormalizedEssayAiRequest) {
  const isComic = body.persona === "entertainment_pd";

  const outputSchema = isComic
    ? `
{
  "persona": "entertainment_pd",
  "title": "오늘의 4컷: 에피소드 제목",
  "content": "예능 PD 관점에서 실제 기록을 근거로 선택 패턴과 행동 성향을 분석한 글",
  "summary": "편집한 기록과 대비를 설명한 두 문장 이내 요약",
  "verdict": "오늘의 편집 포인트: 한 줄",
  "insights": [
    {
      "keyword": "웃픈 명장면",
      "description": "실제 기록에 근거한 설명"
    },
    {
      "keyword": "반전 포인트",
      "description": "실제 기록에 근거한 설명"
    },
    {
      "keyword": "다음 화 떡밥",
      "description": "실제 기록에 근거한 설명"
    }
  ],
  "aiRecommendation": "다음 화 미션: 실행 가능한 행동 하나",
  "comic": {
    "episodeTitle": "30자 이내 제목",
    "comedyStyle": "허용된 밈 문법 중 하나",
    "panels": [
      {
        "panelNumber": 1,
        "background": "허용된 배경 중 하나",
        "expression": "허용된 표정 중 하나",
        "pose": "허용된 자세 중 하나",
        "effect": "허용된 효과 중 하나",
        "dialogue": "28자 이내 한 문장",
        "caption": "36자 이내 예능 자막",
        "recordIndexes": [0]
      },
      {
        "panelNumber": 2,
        "background": "허용된 배경 중 하나",
        "expression": "허용된 표정 중 하나",
        "pose": "허용된 자세 중 하나",
        "effect": "허용된 효과 중 하나",
        "dialogue": "28자 이내 한 문장",
        "caption": "36자 이내 예능 자막",
        "recordIndexes": [0]
      },
      {
        "panelNumber": 3,
        "background": "허용된 배경 중 하나",
        "expression": "허용된 표정 중 하나",
        "pose": "허용된 자세 중 하나",
        "effect": "허용된 효과 중 하나",
        "dialogue": "28자 이내 한 문장",
        "caption": "36자 이내 예능 자막",
        "recordIndexes": [0]
      },
      {
        "panelNumber": 4,
        "background": "허용된 배경 중 하나",
        "expression": "허용된 표정 중 하나",
        "pose": "허용된 자세 중 하나",
        "effect": "허용된 효과 중 하나",
        "dialogue": "28자 이내 한 문장",
        "caption": "36자 이내 예능 자막",
        "recordIndexes": [0]
      }
    ],
    "highlightCaption": "45자 이내 대표 자막",
    "nextEpisode": "55자 이내 다음 화 예고"
  }
}
`.trim()
    : `
{
  "persona": "${body.persona}",
  "title": "선택한 역할에 맞는 제목",
  "content": "선택한 AI가 실제 기록을 근거로 사용자의 감정·행동·선택 성향을 분석한 글",
  "summary": "핵심 판단을 두 문장 이내로 압축한 요약",
  "verdict": "선택한 역할에 맞는 최종 한 줄",
  "insights": [
    {
      "keyword": "역할별 첫 번째 고정 항목",
      "description": "실제 기록을 근거로 한 설명"
    },
    {
      "keyword": "역할별 두 번째 고정 항목",
      "description": "실제 기록을 근거로 한 설명"
    },
    {
      "keyword": "역할별 세 번째 고정 항목",
      "description": "실제 기록을 근거로 한 설명"
    }
  ],
  "aiRecommendation": "역할별 접두어로 시작하는 행동 하나",
  "comic": null
}
`.trim();

  const systemPrompt = `
당신은 사용자의 실제 여정 기록을 읽고 성향을 분석하는 AI 편집자입니다.
역할마다 분석 관점과 말투는 달라야 하지만, 모든 역할의 content는 사용자가 직접 쓴 일기가 아니라 AI가 기록을 근거로 해석한 분석 글이어야 합니다.

가장 중요한 공통 원칙:
- 글의 화자는 항상 AI 분석자입니다. 사용자의 목소리를 흉내 내거나 사용자를 대신해 1인칭 일기를 쓰지 마세요.
- content에서 "나는", "내가", "나의"를 화자의 표현으로 사용하지 마세요. 기록 속 문장을 짧게 인용해야 할 때만 인용 표시와 함께 제한적으로 사용하세요.
- "기록에서 드러난 점", "이번 여정에서 확인되는 경향", "사용자는 ~한 상황에서"처럼 관찰과 근거가 드러나는 분석 문장으로 작성하세요.
- 성향을 단정적인 성격 진단으로 만들지 말고, 이번 기록에서 반복되거나 대비된 행동·감정·선택의 경향으로 설명하세요.
- 사용자가 기록하지 않은 사건, 장소, 행동, 관계, 감정, 사람 수, 분위기, 심리 상태를 만들지 마세요.
- 기록에 있는 정보만 근거로 사용하세요.
- 특정 기록을 언급할 때 미션 목표와 사용자의 실제 행동을 왜곡하지 마세요.
- 미션 목표 달성과 자기 이해의 성과를 구분하세요.
- 감정 자체는 성공이나 실패가 아닙니다.
- 사용자가 통제할 수 없는 환경이나 타인의 행동을 사용자의 잘못으로 평가하지 마세요.
- 기록 전체를 시간순으로 다시 쓰거나 사용자의 하루를 일기처럼 재현하지 마세요.
- 기록에서 검증하지 않은 횟수, 비율, 점수, 순위, 통계를 만들지 마세요.
- 근거가 부족한 해석은 가능성 또는 판단 보류로 표현하세요.
- 사용자를 심리 진단하거나 치료가 필요한 사람으로 단정하지 마세요.
- 한국어로만 작성하세요.
- content와 verdict에 같은 문장을 반복하지 마세요.
- aiRecommendation에는 행동 하나만 넣으세요.
- ${getLengthInstruction(body.records.length, body.persona)}
- content는 짧은 소제목과 여러 문단으로 나누고, 문단 사이에는 반드시 빈 줄을 한 줄 넣으세요.
- 한 문단은 2~4문장 정도로 유지하고 하나의 긴 문단으로 몰아쓰지 마세요.

${getPersonaInstruction(body.persona)}

출력 전 자체 점검:
1. 중요한 주장과 농담에 실제 기록 근거가 있는가?
2. 기록에 없는 숫자, 상황, 직접 대사를 사실처럼 만들지 않았는가?
3. 불편한 감정 자체를 잘못으로 평가하지 않았는가?
4. content가 사용자의 1인칭 일기가 아니라 AI의 근거 기반 성향 분석 글인가?
5. 선택한 역할의 구조가 다른 역할과 분명히 구분되는가?
6. content와 verdict가 중복되지 않는가?
7. aiRecommendation이 행동 하나인가?
${isComic ? "8. comic.panels가 정확히 4개이고 모든 선택값이 허용 목록에 있는가?" : "8. comic 값이 null인가?"}
하나라도 어기면 출력 전에 수정하세요.

출력 규칙:
- 반드시 유효한 JSON 객체 하나만 출력하세요.
- 마크다운 코드 블록, JSON 바깥 설명, 주석을 추가하지 마세요.
- 문자열 안의 줄바꿈은 \n을 사용하세요.
- 이스케이프되지 않은 실제 줄바꿈, 탭, 제어문자를 JSON 문자열에 넣지 마세요.
- title, content, summary, verdict, aiRecommendation은 빈 문자열이면 안 됩니다.
- insights는 정확히 3개 작성하세요.
- persona는 반드시 "${body.persona}" 그대로 반환하세요.

반환 형식:
${outputSchema}
`.trim();

  const userPrompt = `
[분석 대상]
닉네임: ${body.nickname}
여정 제목: ${body.journeyTitle}
여정 기간: ${body.durationDays}일
기록 수: ${body.records.length}개
선택한 AI 역할: ${body.persona}

[실제 여정 기록]
${formatRecords(body.records)}

[작성 요청]
- 기록 전체를 읽은 뒤 선택한 역할의 관점으로 사용자의 감정, 행동, 선택 성향을 분석하세요.
${body.persona === "emotion_interpreter"
    ? "- 감정 통역사는 사용자가 선택한 미션 카테고리, 각 기록의 한글 감정, 기록 내용을 통합해 사용자의 취향을 구체적으로 알려주세요."
    : ""}
- 사용자가 직접 쓴 듯한 1인칭 일기나 회고문으로 작성하지 마세요.
- 중요한 해석마다 어떤 기록에서 근거를 얻었는지 자연스럽게 드러내세요.
- 기록을 전부 한 번씩 언급하려 하지 마세요.
- 일부 기록만 보고 사용자의 성격 전체를 단정하지 마세요.
- 미션 목표와 실제 행동을 비교하세요.
- 선택한 역할의 고정 구조와 접두어를 정확히 지키세요.
- 다른 역할의 말투와 형식을 섞지 마세요.
${isComic
    ? "- 하나의 에피소드가 되도록 1~3개 기록을 연결하고, 4컷의 기승전결과 기록 근거를 명확히 하세요."
    : "- 서로 다른 기록을 최소 두 개 연결해 감정, 행동 또는 패턴을 설명하세요."}
`.trim();

  return { systemPrompt, userPrompt };
}

function escapeControlCharactersInsideJsonStrings(
  jsonText: string,
) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < jsonText.length; index += 1) {
    const character = jsonText[index];

    if (!inString) {
      result += character;

      if (character === '"') {
        inString = true;
      }

      continue;
    }

    if (escaped) {
      result += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      result += character;
      escaped = true;
      continue;
    }

    if (character === '"') {
      result += character;
      inString = false;
      continue;
    }

    if (character === "\n") {
      result += "\\n";
      continue;
    }

    if (character === "\r") {
      result += "\\r";
      continue;
    }

    if (character === "\t") {
      result += "\\t";
      continue;
    }

    const code = character.charCodeAt(0);

    if (code >= 0 && code < 32) {
      result += `\\u${code.toString(16).padStart(4, "0")}`;
      continue;
    }

    result += character;
  }

  return result;
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

  const jsonText = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(jsonText) as Record<string, unknown>;
  } catch (firstError) {
    const repairedJsonText =
      escapeControlCharactersInsideJsonStrings(jsonText);

    try {
      return JSON.parse(repairedJsonText) as Record<string, unknown>;
    } catch (secondError) {
      console.error("AI 원본 JSON 파싱 실패:", {
        firstError: getErrorMessage(firstError),
        secondError: getErrorMessage(secondError),
        rawPreview: jsonText.slice(0, 1_500),
        repairedPreview: repairedJsonText.slice(0, 1_500),
      });

      throw new Error(
        `AI 응답 JSON 변환 실패: ${getErrorMessage(secondError)}`,
      );
    }
  }
}

const COMIC_BACKGROUNDS: ComicBackground[] = [
  "street",
  "restaurant",
  "exhibition",
  "bookstore",
  "workshop",
  "home",
  "cafe",
  "park",
  "transit",
  "generic",
];

const COMIC_EXPRESSIONS: ComicExpression[] = [
  "determined",
  "nervous",
  "flustered",
  "blank",
  "relieved",
  "proud",
  "shocked",
  "thinking",
];

const COMIC_POSES: ComicPose[] = [
  "standing",
  "walking",
  "sitting",
  "holding",
  "pointing",
  "hiding",
  "celebrating",
  "frozen",
];

const COMIC_EFFECTS: ComicEffect[] = [
  "none",
  "sweat",
  "shock",
  "zoom",
  "silence",
  "black_and_white",
  "sparkle",
  "question_marks",
  "speed_lines",
];

const COMEDY_STYLES: ComedyStyle[] = [
  "grand_declaration",
  "production_caption",
  "breaking_news",
  "sports_commentary",
  "documentary",
  "interview_cut",
  "before_after",
  "plan_vs_reality",
  "sudden_silence",
  "inner_voice",
  "replay_zoom",
  "contract_renewal",
  "emergency_meeting",
  "plot_twist",
  "audience_reaction",
  "subtitle_mismatch",
  "mission_failed_successfully",
  "tiny_victory",
  "cliffhanger",
  "expert_commentary",
];

function normalizeEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  const text = toCleanString(value) as T;
  return allowed.includes(text) ? text : fallback;
}

function normalizeRecordIndexes(
  value: unknown,
  recordCount: number,
) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter(
          (item) =>
            Number.isInteger(item) &&
            item >= 0 &&
            item < recordCount,
        ),
    ),
  ).slice(0, 3);
}

function normalizeEntertainmentComic(
  value: unknown,
  recordCount: number,
): EntertainmentComic {
  const raw = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};

  const rawPanels = Array.isArray(raw.panels) ? raw.panels : [];
  const panels = rawPanels
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const panel = item as Record<string, unknown>;
      const panelNumber = index + 1 as 1 | 2 | 3 | 4;
      const dialogue = toCleanString(panel.dialogue).slice(0, 80);
      const caption = toCleanString(panel.caption).slice(0, 100);

      if (!dialogue || !caption) return null;

      return {
        panelNumber,
        background: normalizeEnumValue(
          panel.background,
          COMIC_BACKGROUNDS,
          "generic",
        ),
        expression: normalizeEnumValue(
          panel.expression,
          COMIC_EXPRESSIONS,
          "thinking",
        ),
        pose: normalizeEnumValue(
          panel.pose,
          COMIC_POSES,
          "standing",
        ),
        effect: normalizeEnumValue(
          panel.effect,
          COMIC_EFFECTS,
          "none",
        ),
        dialogue,
        caption,
        recordIndexes: normalizeRecordIndexes(
          panel.recordIndexes,
          recordCount,
        ),
      } satisfies ComicPanel;
    })
    .filter((item): item is ComicPanel => item !== null)
    .slice(0, 4);

  if (panels.length !== 4) {
    throw new Error("예능 PD 응답의 웹툰 컷은 정확히 4개여야 합니다.");
  }

  return {
    episodeTitle: toCleanString(
      raw.episodeTitle,
      "예상과 현실 사이",
    ).slice(0, 80),
    comedyStyle: normalizeEnumValue(
      raw.comedyStyle,
      COMEDY_STYLES,
      "plan_vs_reality",
    ),
    panels,
    highlightCaption: toCleanString(
      raw.highlightCaption,
      panels[2].caption,
    ).slice(0, 120),
    nextEpisode: toCleanString(
      raw.nextEpisode,
      "다음 화에서는 아주 작은 선택 하나를 바꿔봅니다.",
    ).slice(0, 140),
  };
}

function comicToFallbackContent(comic: EntertainmentComic) {
  return comic.panels
    .map(
      (panel) =>
        `${panel.panelNumber}컷\n${panel.dialogue}\n자막: ${panel.caption}`,
    )
    .join("\n\n");
}

function formatEssayContentForReadability(value: unknown) {
  const normalized = toCleanString(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return "";

  const existingParagraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (existingParagraphs.length >= 3) {
    return existingParagraphs.join("\n\n");
  }

  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length >= 3) {
    return lines.join("\n\n");
  }

  const sentences = (
    normalized.match(/[^.!?。！？]+[.!?。！？]+|[^.!?。！？]+$/g) ?? []
  )
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 3) return normalized;

  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length; index += 2) {
    paragraphs.push(sentences.slice(index, index + 2).join(" "));
  }

  return paragraphs.join("\n\n");
}

function normalizeEssayResult(
  raw: Record<string, unknown>,
  requestedPersona: EssayPersona,
  recordCount: number,
): EssayAiResult {
  const comic = requestedPersona === "entertainment_pd"
    ? normalizeEntertainmentComic(raw.comic, recordCount)
    : null;

  const title = toCleanString(
    raw.title,
    comic ? `오늘의 4컷: ${comic.episodeTitle}` : "",
  );
  const content = formatEssayContentForReadability(
    raw.content ?? raw.summary ?? (comic ? comicToFallbackContent(comic) : ""),
  );
  const summary = toCleanString(raw.summary, content.slice(0, 180));
  const verdict = toCleanString(
    raw.verdict,
    comic ? `오늘의 편집 포인트: ${comic.highlightCaption}` : "",
  );
  const aiRecommendation = toCleanString(
    raw.aiRecommendation,
    comic ? `다음 화 미션: ${comic.nextEpisode}` : "",
  );

  if (!title) throw new Error("AI 응답에 제목이 없습니다.");
  if (!content) throw new Error("AI 응답에 본문이 없습니다.");
  if (!verdict) throw new Error("AI 응답에 최종 한 줄이 없습니다.");
  if (!aiRecommendation) {
    throw new Error("AI 응답에 다음 행동 제안이 없습니다.");
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
    .slice(0, 3);

  if (insights.length !== 3) {
    throw new Error("AI 응답의 핵심 항목은 정확히 3개여야 합니다.");
  }

  return {
    persona: requestedPersona,
    title,
    content,
    summary,
    verdict,
    insights,
    aiRecommendation,
    comic,
  };
}

function looksLikeFirstPersonDiary(content: string) {
  const normalized = content
    .replace(/[“”‘’]/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  const diarySentenceCount = (
    normalized.match(
      /(?:^|[.!?。！？]\s+)(?:나는|내가|나의|나에게|내 마음은|오늘 나는|이번에 나는)\b/g,
    ) ?? []
  ).length;
  const analysisMarkerCount = (
    normalized.match(
      /사용자는|기록에서|이번 여정에서|기록을 보면|드러난 경향|선택 패턴|행동 패턴|감정의 조건|확인되는 점/g,
    ) ?? []
  ).length;

  return (
    diarySentenceCount >= 2 ||
    (diarySentenceCount >= 1 && analysisMarkerCount === 0)
  );
}

async function callUpstage(
  systemPrompt: string,
  userPrompt: string,
  requestId: string,
  persona: EssayPersona,
) {
  const apiKey = toCleanString(denoRuntime.env.get("UPSTAGE_API_KEY"));
  if (!apiKey) {
    throw new Error("UPSTAGE_API_KEY가 설정되지 않았습니다.");
  }

  // 해커톤 권장 기술인 Upstage Solar Pro를 항상 사용한다.
  // 환경변수에 다른 모델명이 남아 있어도 다른 회사/계열 모델로 바뀌지 않게 고정한다.
  const model = "solar-pro3";

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    UPSTAGE_TIMEOUT_MS,
  );
  const startedAt = Date.now();

  console.log(`[generate-essay][${requestId}] Upstage 요청 시작`, {
    model,
    endpoint: UPSTAGE_API_URL,
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
        temperature: persona === "entertainment_pd" ? 0.68 : 0.45,
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
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error("Upstage가 90초 안에 응답하지 않았습니다.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

denoRuntime.serve(async (req) => {
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
      body.persona,
    );
    const parsed = extractJsonObject(rawAiContent);
    let result = normalizeEssayResult(
      parsed,
      body.persona,
      body.records.length,
    );

    if (looksLikeFirstPersonDiary(result.content)) {
      console.warn(`[generate-essay][${requestId}] 1인칭 일기형 응답 감지, 재작성 요청`);

      const rewriteSystemPrompt = `${systemPrompt}

[재작성 최우선 규칙]
이전 생성 결과가 사용자가 직접 쓴 듯한 1인칭 일기 형식이었습니다. 이번 응답의 content는 반드시 AI 분석자가 사용자의 기록을 관찰해 쓴 성향 분석문이어야 합니다. 문단마다 '기록에서', '사용자는', '이번 여정에서 확인되는 경향'처럼 분석 주체와 근거가 드러나야 합니다. 화자로서 '나는', '내가', '나의'를 사용하지 마세요. 기록 속 표현을 인용할 때만 따옴표 안에서 제한적으로 허용합니다.`;
      const rewriteUserPrompt = `${userPrompt}

[반드시 재작성]
시간순 일기나 감상문이 아니라, 기록 간 공통점과 대비를 근거로 사용자의 감정·행동·선택 성향을 분석하세요.`;
      const rewrittenRaw = await callUpstage(
        rewriteSystemPrompt,
        rewriteUserPrompt,
        `${requestId}-rewrite`,
        body.persona,
      );
      const rewrittenParsed = extractJsonObject(rewrittenRaw);
      result = normalizeEssayResult(
        rewrittenParsed,
        body.persona,
        body.records.length,
      );

      if (looksLikeFirstPersonDiary(result.content)) {
        throw new Error(
          "AI가 분석형 문체 규칙을 지키지 못했습니다. 잠시 후 다시 시도해주세요.",
        );
      }
    }

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