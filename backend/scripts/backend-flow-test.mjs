import {
  TEST_DURATION_DAYS,
  TEST_LABEL,
  TEST_TARGET_RECORD_COUNT,
  ensureProfile,
  getOrCreateTestJourney,
  getSingleRelation,
  supabase,
  testEmail,
  testPassword,
  throwIfError,
} from "./backend-flow-test-config.mjs";

import {
  buildRecordJourney,
} from "./backend-flow-test-mission.mjs";

import {
  createEssayDraftAndVerify,
  verifyFinalResults,
} from "./backend-flow-test-essay.mjs";

function parseEssayAiResult(rawAnswer) {
  const cleaned = rawAnswer
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace < firstBrace
  ) {
    throw new Error(
      "AI 응답에서 JSON을 찾을 수 없습니다.",
    );
  }

  const originalJsonText = cleaned.slice(
    firstBrace,
    lastBrace + 1,
  );

  /*
   * AI가 아래처럼 불필요한 bridge 래퍼를 넣는 경우 복구한다.
   *
   * {
   *   "bridge": {
   *     "recordIndex": 1,
   *     "bridgeText": "..."
   *   }
   * }
   */
  const repairedJsonText =
    originalJsonText.replace(
      /{\s*"bridge"\s*:\s*{/g,
      "{",
    );

  const parseCandidates = [
    originalJsonText,
    repairedJsonText,
  ];

  let parsed = null;
  let lastParseError = null;

  for (const candidate of parseCandidates) {
    try {
      parsed = JSON.parse(candidate);
      break;
    } catch (error) {
      lastParseError = error;
    }
  }

  if (!parsed) {
    throw new Error(
      [
        "AI 응답 JSON 변환 실패:",
        rawAnswer,
        "",
        `파싱 오류: ${
          lastParseError?.message ??
          "알 수 없는 오류"
        }`,
      ].join("\n"),
    );
  }

  if (
    typeof parsed.title !== "string" ||
    !parsed.title.trim()
  ) {
    throw new Error(
      "AI 응답에 제목이 없습니다.",
    );
  }

  if (!Array.isArray(parsed.bridges)) {
    throw new Error(
      "AI 응답에 bridges 배열이 없습니다.",
    );
  }

  if (
    parsed.bridges.length !==
    TEST_TARGET_RECORD_COUNT
  ) {
    throw new Error(
      [
        "AI 응답의 bridges 개수가 잘못됐습니다.",
        `예상: ${TEST_TARGET_RECORD_COUNT}`,
        `실제: ${parsed.bridges.length}`,
      ].join("\n"),
    );
  }

  const bridges = parsed.bridges.map(
    (item, index) => {
      /*
       * 새 형식:
       * "연결 문장"
       *
       * 기존 형식:
       * {
       *   "recordIndex": 0,
       *   "bridgeText": "연결 문장"
       * }
       *
       * 중첩 형식도 호환:
       * {
       *   "bridge": {
       *     "bridgeText": "연결 문장"
       *   }
       * }
       */
      const candidate =
        item?.bridge ?? item;

      const bridgeText =
        typeof candidate === "string"
          ? candidate.trim()
          : typeof candidate?.bridgeText ===
              "string"
            ? candidate.bridgeText.trim()
            : "";

      if (!bridgeText) {
        throw new Error(
          [
            `${index + 1}번째 연결 문장이 비어 있거나 형식이 잘못됐습니다.`,
            `실제 값: ${JSON.stringify(item)}`,
          ].join("\n"),
        );
      }

      /*
       * recordIndex는 AI 응답을 믿지 않고
       * 배열 순서에 따라 코드에서 자동 지정한다.
       */
      return {
        recordIndex: index,
        bridgeText,
      };
    },
  );

  return {
    title: parsed.title.trim(),
    bridges,
  };
}

async function invokeUpstage(message) {
  const {
    data,
    error,
  } = await supabase.functions.invoke(
    "upstage-test",
    {
      body: {
        message,
      },
    },
  );

  throwIfError(
    "Upstage Edge Function 호출 실패",
    error,
  );

  if (
    typeof data?.answer !== "string" ||
    !data.answer.trim()
  ) {
    throw new Error(
      "Upstage 응답에 유효한 answer가 없습니다.",
    );
  }

  return data.answer.trim();
}

async function generateEssayWithUpstageAndVerify(
  essayId,
) {
  const {
    data: essay,
    error: essayError,
  } = await supabase
    .from("essays")
    .select(`
      id,
      journey_id,
      essay_items (
        id,
        sort_order,
        records (
          id,
          recorded_at,
          emotion,
          content,
          mission_attempts (
            missions (
              title
            )
          ),
          places (
            name
          )
        )
      )
    `)
    .eq("id", essayId)
    .single();

  throwIfError(
    "AI 입력용 에세이 조회 실패",
    essayError,
  );

  const items = [
    ...(essay.essay_items ?? []),
  ].sort(
    (a, b) =>
      a.sort_order - b.sort_order,
  );

  if (
    items.length !==
    TEST_TARGET_RECORD_COUNT
  ) {
    throw new Error(
      `AI에 전달할 기록이 ${TEST_TARGET_RECORD_COUNT}개가 아닙니다: ${items.length}개`,
    );
  }

  const recordsText = items
    .map((item, index) => {
      const record =
        getSingleRelation(
          item.records,
        );

      if (!record) {
        throw new Error(
          `${index + 1}번째 essay_item에 연결된 기록이 없습니다.`,
        );
      }

      const missionAttempt =
        getSingleRelation(
          record.mission_attempts,
        );

      const mission =
        getSingleRelation(
          missionAttempt?.missions,
        );

      const place =
        getSingleRelation(
          record.places,
        );

      return [
        `[기록 ${index + 1}]`,
        `날짜: ${record.recorded_at}`,
        `미션: ${
          mission?.title ??
          "미션 정보 없음"
        }`,
        `장소: ${
          place?.name ??
          "장소 정보 없음"
        }`,
        `감정: ${record.emotion}`,
        `내용: ${record.content}`,
      ].join("\n");
    })
    .join("\n\n");

  const expectedIndexes = Array.from(
    { length: items.length },
    (_, index) => index,
  );

  const bridgeExample = expectedIndexes
  .map(
    (recordIndex) =>
      `    "${recordIndex + 1}번째 기록을 자연스럽게 이어주는 문장"`,
  )
  .join(",\n");

  const prompt = `
다음은 한 사용자가 ${TEST_DURATION_DAYS}일 Journey 동안 작성한 실제 경험 기록 ${items.length}개입니다.

${recordsText}

위 기록만을 바탕으로 자연스러운 한국어 에세이를 구성하세요.

규칙:
- 기록에 없는 사실을 만들지 마세요.
- 사용자의 감정과 경험을 중심으로 작성하세요.
- ${items.length}개의 기록을 시간 순서대로 자연스럽게 이어주세요.
- 각 기록을 소개하거나 이어주는 연결 문장을 하나씩 작성하세요.
- 반드시 JSON만 반환하세요.
- bridges 개수는 반드시 ${items.length}개여야 합니다.
- bridgeText는 빈 문자열이면 안 됩니다.
- 모든 객체의 구조를 동일하게 작성하세요.
- JSON 마지막 항목에도 bridgeText를 반드시 포함하세요.
- bridges는 객체 배열이 아니라 문자열 배열로 작성하세요.
- bridges에는 기록 순서대로 연결 문장만 넣으세요.
- bridges 개수는 반드시 ${items.length}개여야 합니다.
- 각 연결 문장은 빈 문자열이면 안 됩니다.
- bridges 안에 recordIndex, bridgeText, bridge 같은 속성을 만들지 마세요.

{
  "title": "에세이 제목",
  "bridges": [
${bridgeExample}
  ]
}
`.trim();

  const MAX_AI_ATTEMPTS = 3;

let rawAnswer =
  await invokeUpstage(prompt);

let aiResult = null;
let lastParseError = null;

for (
  let attemptNumber = 1;
  attemptNumber <= MAX_AI_ATTEMPTS;
  attemptNumber += 1
) {
  console.log(
    `✅ Upstage AI 응답 수신: ${attemptNumber}/${MAX_AI_ATTEMPTS}`,
  );

  console.log(
    `AI 응답 ${attemptNumber}:`,
    rawAnswer,
  );

  try {
    aiResult =
      parseEssayAiResult(rawAnswer);

    console.log(
      `✅ AI 응답 검증 성공: 연결 문장 ${aiResult.bridges.length}개`,
    );

    break;
  } catch (error) {
    lastParseError = error;

    console.warn(
      `⚠️ AI 응답 검증 실패: ${error.message}`,
    );

    if (
      attemptNumber ===
      MAX_AI_ATTEMPTS
    ) {
      break;
    }

    const repairPrompt = `
이전 응답의 JSON 형식 또는 배열 개수가 잘못되었습니다.

반드시 전체 응답을 처음부터 다시 작성하세요.

필수 조건:
- JSON 이외의 설명을 작성하지 마세요.
- title은 빈 문자열이면 안 됩니다.
- bridges는 반드시 문자열 배열이어야 합니다.
- bridges 배열의 항목은 반드시 ${items.length}개여야 합니다.
- 기록 1번부터 ${items.length}번까지 순서대로 정확히 하나씩 작성하세요.
- 항목을 합치거나 생략하지 마세요.
- bridge, recordIndex, bridgeText 등의 객체를 만들지 마세요.
- 각 배열 항목은 연결 문장 문자열 하나여야 합니다.
- 마지막 ${items.length}번째 문장까지 반드시 작성하세요.

기록:
${recordsText}

잘못된 이전 응답:
${rawAnswer}

반드시 다음 구조로만 반환하세요.

{
  "title": "에세이 제목",
  "bridges": [
${bridgeExample}
  ]
}
`.trim();

    console.log(
      `🔄 AI 응답 재생성 요청: ${attemptNumber + 1}/${MAX_AI_ATTEMPTS}`,
    );

    rawAnswer =
      await invokeUpstage(
        repairPrompt,
      );
  }
}

if (!aiResult) {
  throw new Error(
    [
      `AI 응답을 ${MAX_AI_ATTEMPTS}번 생성했지만 올바른 결과를 받지 못했습니다.`,
      lastParseError?.message ??
        "알 수 없는 파싱 오류",
    ].join("\n"),
  );
}

  if (
    aiResult.bridges.length !==
    items.length
  ) {
    throw new Error(
      `AI 연결 문장 개수가 기록 개수와 다릅니다. 기록: ${items.length}, 연결 문장: ${aiResult.bridges.length}`,
    );
  }

  const {
    data: savedEssayId,
    error: saveError,
  } = await supabase.rpc(
    "save_essay_ai_result",
    {
      p_essay_id: essayId,
      p_title: aiResult.title,
      p_bridges: aiResult.bridges,
    },
  );

  throwIfError(
    "AI 에세이 결과 저장 실패",
    saveError,
  );

  if (!savedEssayId) {
    throw new Error(
      "save_essay_ai_result RPC가 에세이 ID를 반환하지 않았습니다.",
    );
  }

  const {
    data: savedEssay,
    error: verifyError,
  } = await supabase
    .from("essays")
    .select(`
      id,
      title,
      status,
      essay_items (
        id,
        sort_order,
        ai_bridge_text
      )
    `)
    .eq("id", savedEssayId)
    .single();

  throwIfError(
    "저장된 AI 에세이 확인 실패",
    verifyError,
  );

  const savedItems = [
    ...(savedEssay.essay_items ?? []),
  ].sort(
    (a, b) =>
      a.sort_order - b.sort_order,
  );

  if (
    savedItems.length !==
    TEST_TARGET_RECORD_COUNT
  ) {
    throw new Error(
      `저장된 essay_items 수가 ${TEST_TARGET_RECORD_COUNT}개가 아닙니다: ${savedItems.length}개`,
    );
  }

  if (
    savedItems.some(
      (item) =>
        !item.ai_bridge_text,
    )
  ) {
    throw new Error(
      "저장되지 않은 AI 연결 문장이 있습니다.",
    );
  }

  console.log(
    `✅ AI 에세이 제목 저장 성공: ${savedEssay.title}`,
  );

  console.log(
    `✅ AI 연결 문장 저장 성공: ${savedItems.length}개`,
  );

  return {
    ...savedEssay,
    essay_items: savedItems,
  };
}

async function main() {
  console.log(
    `\n🚀 ${TEST_LABEL} 백엔드 통합 테스트 시작\n`,
  );

  const {
    data: loginData,
    error: loginError,
  } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  throwIfError(
    "테스트 계정 로그인 실패",
    loginError,
  );

  const user = loginData.user;

  if (!user) {
    throw new Error(
      "로그인했지만 사용자 정보가 없습니다.",
    );
  }

  console.log(
    `✅ 로그인 성공: ${user.email}`,
  );

  await ensureProfile(user);

  const journey =
    await getOrCreateTestJourney(user);

  await buildRecordJourney(
    user,
    journey,
  );

  const finalResult =
    await verifyFinalResults(
      user,
      journey.id,
    );

  const essayResult =
    await createEssayDraftAndVerify(
      user,
      journey.id,
    );

  console.log(
    "에세이:",
    essayResult.essay,
  );

  console.log(
    "에세이 기록:",
    essayResult.essayItems,
  );

  const aiEssay =
    await generateEssayWithUpstageAndVerify(
      essayResult.essay.id,
    );

  console.log(
    "AI 에세이 결과:",
    aiEssay,
  );

  console.log(
    "\n==============================",
  );

  console.log(
    `🎉 ${TEST_LABEL} Journey 에세이 통합 테스트 최종 성공`,
  );

  console.log(
    "==============================",
  );

  console.log(
    `Journey 기록 수: ${finalResult.records.length}`,
  );

  console.log(
    `에세이 연결 기록 수: ${essayResult.essayItems.length}`,
  );

  console.log(
    `AI 연결 문장 수: ${aiEssay.essay_items.length}`,
  );

  await supabase.auth.signOut({
    scope: "local",
  });
}

main().catch(async (error) => {
  console.error(
    "\n==============================",
  );

  console.error(
    `❌ ${TEST_LABEL} 백엔드 통합 테스트 실패`,
  );

  console.error(
    "==============================",
  );

  console.error(error);

  try {
    await supabase.auth.signOut({
      scope: "local",
    });
  } catch {
    // 로그아웃 오류는 무시
  }

  process.exitCode = 1;
});