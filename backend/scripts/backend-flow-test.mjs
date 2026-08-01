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

const TEST_STYLES = [
  "balanced",
  "plain",
  "emotional",
  "balanced",
];

function parseAiJson(raw) {
  const cleaned = String(raw ?? "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (
    start < 0 ||
    end < start
  ) {
    throw new Error(
      "AI 응답에서 JSON을 찾을 수 없습니다.",
    );
  }

  let parsed;

  try {
    parsed = JSON.parse(
      cleaned.slice(
        start,
        end + 1,
      ),
    );
  } catch (error) {
    throw new Error(
      `AI 응답 JSON 변환 실패: ${error.message}`,
    );
  }

  const title =
    typeof parsed?.title === "string"
      ? parsed.title.trim()
      : "";

  const content =
    typeof parsed?.content === "string"
      ? parsed.content.trim()
      : "";

  if (!title) {
    throw new Error(
      "AI 응답에 title이 없습니다.",
    );
  }

  if (!content) {
    throw new Error(
      "AI 응답에 content가 없습니다.",
    );
  }

  return {
    title,
    content,
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

function styleInstruction(style) {
  if (style === "plain") {
    return "과장 없이 경험과 사실 중심으로 담백하고 차분하게 작성하세요.";
  }

  if (style === "emotional") {
    return "기록의 감정과 분위기를 더 선명하게 살리되 과장하지 마세요.";
  }

  return "사실과 감정을 균형 있게 담아 자연스러운 블로그 에세이처럼 작성하세요.";
}

async function loadEssayInput(
  essayId,
) {
  const {
    data: essay,
    error,
  } = await supabase
    .from("essays")
    .select(`
      id,
      selected_version_no,
      essay_items (
        sort_order,
        records (
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
    error,
  );

  if (
    essay.selected_version_no !==
    null
  ) {
    throw new Error(
      "최종 버전이 이미 선택된 에세이입니다.",
    );
  }

  const items = [
    ...(essay.essay_items ?? []),
  ].sort(
    (a, b) =>
      Number(a.sort_order) -
      Number(b.sort_order),
  );

  if (
    items.length !==
    TEST_TARGET_RECORD_COUNT
  ) {
    throw new Error(
      `AI 입력 기록 수가 잘못됐습니다. 예상: ${TEST_TARGET_RECORD_COUNT}, 실제: ${items.length}`,
    );
  }

  const recordsText = items
    .map(
      (
        item,
        index,
      ) => {
        const record =
          getSingleRelation(
            item.records,
          );

        if (!record) {
          throw new Error(
            `${index + 1}번째 기록을 찾을 수 없습니다.`,
          );
        }

        const attempt =
          getSingleRelation(
            record.mission_attempts,
          );

        const mission =
          getSingleRelation(
            attempt?.missions,
          );

        const place =
          getSingleRelation(
            record.places,
          );

        return [
          `[기록 ${index + 1}]`,
          `날짜: ${record.recorded_at}`,
          `미션: ${mission?.title ?? "정보 없음"}`,
          `장소: ${place?.name ?? "정보 없음"}`,
          `감정: ${record.emotion ?? "정보 없음"}`,
          `내용: ${record.content ?? ""}`,
        ].join("\n");
      },
    )
    .join("\n\n");

  return {
    items,
    recordsText,
  };
}

async function generateAiEssay(
  recordsText,
  recordCount,
  style,
) {
  const prompt = `
다음은 한 사용자가 ${TEST_DURATION_DAYS}일 Journey 동안 작성한 실제 경험 기록 ${recordCount}개입니다.

${recordsText}

위 기록만을 바탕으로 하나의 완성된 한국어 에세이를 작성하세요.

규칙:
- 기록에 없는 사실을 만들지 마세요.
- 1인칭 시점으로 작성하세요.
- 기록을 단순 나열하지 말고 자연스럽게 연결하세요.
- ${styleInstruction(style)}
- 반드시 JSON만 반환하세요.
- bridges, bridgeText, recordIndex를 만들지 마세요.

{
  "title": "에세이 제목",
  "content": "완성된 에세이 본문"
}
`.trim();

  let raw =
    await invokeUpstage(
      prompt,
    );

  let lastError;

  for (
    let attempt = 1;
    attempt <= 3;
    attempt += 1
  ) {
    console.log(
      `✅ Upstage 응답 수신 ${attempt}/3 · ${style}`,
    );

    try {
      return parseAiJson(
        raw,
      );
    } catch (error) {
      lastError = error;

      console.warn(
        `⚠️ AI 응답 검증 실패: ${error.message}`,
      );

      if (attempt < 3) {
        raw =
          await invokeUpstage(`
이전 응답이 올바른 JSON 형식이 아닙니다.

기록:
${recordsText}

반드시 아래 구조의 JSON만 반환하세요.

{
  "title": "에세이 제목",
  "content": "완성된 에세이 본문"
}

잘못된 이전 응답:
${raw}
`.trim());
      }
    }
  }

  throw new Error(
    `AI 응답 검증 최종 실패: ${lastError?.message}`,
  );
}

async function saveVersion(
  essayId,
  style,
  aiResult,
) {
  const {
    data: before,
    error: beforeError,
  } = await supabase
    .from("essay_versions")
    .select(
      "id, version_no",
    )
    .eq(
      "essay_id",
      essayId,
    )
    .order(
      "version_no",
    );

  throwIfError(
    "기존 버전 조회 실패",
    beforeError,
  );

  const previousIds =
    new Set(
      (before ?? []).map(
        (row) =>
          row.id,
      ),
    );

  const nextVersionNo =
    (before ?? []).reduce(
      (
        max,
        row,
      ) =>
        Math.max(
          max,
          Number(
            row.version_no,
          ) || 0,
        ),
      0,
    ) + 1;

  const {
    data: essayBefore,
    error: countError,
  } = await supabase
    .from("essays")
    .select(
      "generation_count",
    )
    .eq(
      "id",
      essayId,
    )
    .single();

  throwIfError(
    "generation_count 조회 실패",
    countError,
  );

  const oldCount =
    Number(
      essayBefore
        .generation_count ?? 0,
    );

  const {
    error: startError,
  } = await supabase
    .from("essays")
    .update({
      generation_state:
        "generating",

      generation_started_at:
        new Date()
          .toISOString(),
    })
    .eq(
      "id",
      essayId,
    );

  throwIfError(
    "생성 상태 시작 처리 실패",
    startError,
  );

  try {
    const {
      data: inserted,
      error: insertError,
    } = await supabase
      .from("essay_versions")
      .insert({
        essay_id: essayId,

        version_no:
          nextVersionNo,

        style,

        essay_type:
          "taste_report",

        postcard_format:
          null,

        title:
          aiResult.title,

        content:
          aiResult.content,

        payload: {},
      })
      .select(`
        id,
        essay_id,
        version_no,
        style,
        title,
        content
      `)
      .single();

    throwIfError(
      "에세이 버전 저장 실패",
      insertError,
    );

    const {
      error: finishError,
    } = await supabase
      .from("essays")
      .update({
        generation_count:
          oldCount + 1,

        generation_state:
          "idle",

        generation_started_at:
          null,
      })
      .eq(
        "id",
        essayId,
      );

    throwIfError(
      "생성 완료 상태 저장 실패",
      finishError,
    );

    const {
      data: after,
      error: afterError,
    } = await supabase
      .from("essay_versions")
      .select(
        "id, version_no, style",
      )
      .eq(
        "essay_id",
        essayId,
      )
      .order(
        "version_no",
      );

    throwIfError(
      "저장 후 버전 검증 실패",
      afterError,
    );

    const afterIds =
      new Set(
        (after ?? []).map(
          (row) =>
            row.id,
        ),
      );

    for (
      const id
      of previousIds
    ) {
      if (
        !afterIds.has(id)
      ) {
        throw new Error(
          `기존 버전 ${id}이 삭제됐습니다.`,
        );
      }
    }

    const saved =
      (after ?? []).find(
        (row) =>
          Number(
            row.version_no,
          ) ===
          nextVersionNo,
      );

    if (!saved) {
      throw new Error(
        `버전 ${nextVersionNo}을 찾을 수 없습니다.`,
      );
    }

    if (
      saved.style !==
      style
    ) {
      throw new Error(
        `style 불일치. 예상: ${style}, 실제: ${saved.style}`,
      );
    }

    const {
      data: essayAfter,
      error: stateError,
    } = await supabase
      .from("essays")
      .select(
        "generation_count, generation_state",
      )
      .eq(
        "id",
        essayId,
      )
      .single();

    throwIfError(
      "생성 후 상태 검증 실패",
      stateError,
    );

    if (
      Number(
        essayAfter
          .generation_count,
      ) !==
      oldCount + 1
    ) {
      throw new Error(
        "generation_count가 1 증가하지 않았습니다.",
      );
    }

    if (
      essayAfter
        .generation_state !==
      "idle"
    ) {
      throw new Error(
        `generation_state가 idle이 아닙니다: ${essayAfter.generation_state}`,
      );
    }

    console.log(
      `✅ 버전 ${nextVersionNo} 저장 · style=${style} · 기존 버전 보존`,
    );

    return inserted;
  } catch (error) {
    await supabase
      .from("essays")
      .update({
        generation_state:
          "error",

        generation_started_at:
          null,
      })
      .eq(
        "id",
        essayId,
      );

    throw error;
  }
}

async function generateFourVersions(
  essayId,
) {
  const {
    items,
    recordsText,
  } =
    await loadEssayInput(
      essayId,
    );

  const generated = [];

  for (
    const style
    of TEST_STYLES
  ) {
    const aiResult =
      await generateAiEssay(
        recordsText,
        items.length,
        style,
      );

    generated.push(
      await saveVersion(
        essayId,
        style,
        aiResult,
      ),
    );
  }

  const {
    data: allVersions,
    error,
  } = await supabase
    .from("essay_versions")
    .select(
      "id, version_no, style, title",
    )
    .eq(
      "essay_id",
      essayId,
    )
    .order(
      "version_no",
    );

  throwIfError(
    "최종 버전 목록 조회 실패",
    error,
  );

  const versionNumbers =
    (allVersions ?? []).map(
      (row) =>
        Number(
          row.version_no,
        ),
    );

  if (
    versionNumbers.length < 4 ||
    Math.max(
      ...versionNumbers,
    ) < 4
  ) {
    throw new Error(
      `버전 4까지 생성되지 않았습니다: ${versionNumbers.join(", ")}`,
    );
  }

  console.log(
    `✅ 무제한 버전 검증 성공: ${versionNumbers.join(", ")}`,
  );

  return {
    generated,
    allVersions,
  };
}

async function main() {
  console.log(
    `\n🚀 ${TEST_LABEL} 백엔드 통합 테스트 시작\n`,
  );

  const {
    data: loginData,
    error: loginError,
  } =
    await supabase.auth
      .signInWithPassword({
        email:
          testEmail,

        password:
          testPassword,
      });

  throwIfError(
    "테스트 계정 로그인 실패",
    loginError,
  );

  const user =
    loginData.user;

  if (!user) {
    throw new Error(
      "로그인 사용자 정보가 없습니다.",
    );
  }

  console.log(
    `✅ 로그인 성공: ${user.email}`,
  );

  await ensureProfile(
    user,
  );

  const journey =
    await getOrCreateTestJourney(
      user,
    );

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

  const aiResult =
    await generateFourVersions(
      essayResult.essay.id,
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
    `이번 테스트 생성 버전 수: ${aiResult.generated.length}`,
  );

  console.log(
    `전체 보존 버전 수: ${aiResult.allVersions.length}`,
  );

  await supabase.auth.signOut({
    scope: "local",
  });
}

main().catch(
  async (error) => {
    console.error(
      "\n==============================",
    );

    console.error(
      `❌ ${TEST_LABEL} 백엔드 통합 테스트 실패`,
    );

    console.error(
      "==============================",
    );

    console.error(
      error,
    );

    try {
      await supabase.auth.signOut({
        scope: "local",
      });
    } catch {
      // 로그아웃 오류는 무시한다.
    }

    process.exitCode = 1;
  },
);