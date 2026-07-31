import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// ==========================================
// ⚙️ 생성할 기록(n)의 개수를 여기서 설정하세요!
const TARGET_RECORD_COUNT = 3;
// ==========================================

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`backend/.env에 ${name} 값이 없습니다.`);
  }
  return value;
}

function throwIfError(label, error) {
  if (!error) return;
  console.error(`\n❌ ${label}`);
  console.error(error);
  throw new Error(`${label}: ${error.message ?? "알 수 없는 오류"}`);
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

const supabaseUrl = getRequiredEnv("SUPABASE_URL");
// Service Role Key가 있으면 우선 사용하고, 없으면 일반 키 사용
const supabaseKey = 
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 
  process.env.SUPABASE_PUBLISHABLE_KEY ?? 
  process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  throw new Error(
    "backend/.env에 SUPABASE_SERVICE_ROLE_KEY 또는 SUPABASE_PUBLISHABLE_KEY가 필요합니다.",
  );
}

const testEmail = getRequiredEnv("TEST_USER_EMAIL");
const testPassword = getRequiredEnv("TEST_USER_PASSWORD");

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

async function ensureProfile(user) {
  const { data: profile, error: profileSelectError } = await supabase
    .from("profiles")
    .select("id, nickname")
    .eq("id", user.id)
    .maybeSingle();

  throwIfError("프로필 조회 실패", profileSelectError);

  if (profile) {
    console.log("✅ 프로필 조회 성공");
    return profile;
  }

  const { data: createdProfile, error: profileInsertError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      nickname: `backend-test-${user.id.slice(0, 8)}`,
    })
    .select("id, nickname")
    .single();

  throwIfError("프로필 생성 실패", profileInsertError);

  console.log("✅ 테스트 프로필 생성 성공");
  return createdProfile;
}

async function getOrCreateActiveJourney(user, targetCount) {
  const { data: activeJourney, error: journeySelectError } = await supabase
    .from("journeys")
    .select(`id, title, status, duration_days, target_record_count`)
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  throwIfError("진행 중인 Journey 조회 실패", journeySelectError);

  if (activeJourney) {
    console.log(`✅ 기존 Journey 사용: ${activeJourney.title}`);
    
    // 🌟 추가된 로직: 이 Journey에 이미 작성된 '기존 기록 개수'를 파악합니다.
    const { count, error: countError } = await supabase
      .from("records")
      .select("*", { count: "exact", head: true })
      .eq("journey_id", activeJourney.id);
      
    throwIfError("기존 기록 개수 확인 실패", countError);

    const existingCount = count || 0;
    const newTargetCount = existingCount + targetCount; // 기존 기록 + 새로 작성할 테스트 개수

    if (activeJourney.target_record_count !== newTargetCount) {
      await supabase
        .from("journeys")
        .update({ target_record_count: newTargetCount })
        .eq("id", activeJourney.id);
      
      activeJourney.target_record_count = newTargetCount;
      console.log(`🔄 Journey 목표 기록 수를 ${newTargetCount}개 (기존 ${existingCount}개 + 새 테스트 ${targetCount}개)로 업데이트했습니다.`);
    }
    return activeJourney;
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 6);

  const { data: createdJourney, error: journeyInsertError } = await supabase
    .from("journeys")
    .insert({
      user_id: user.id,
      title: "백엔드 통합 테스트 Journey",
      duration_days: 7,
      target_record_count: targetCount,
      start_date: toDateString(startDate),
      end_date: toDateString(endDate),
      status: "active",
    })
    .select(`id, title, status, duration_days, target_record_count`)
    .single();

  throwIfError("Journey 생성 실패", journeyInsertError);

  console.log(`✅ 테스트 Journey 생성 성공 (목표 기록: ${targetCount}개)`);
  return createdJourney;
}

async function findMissionAndPlace(attemptIndex) {
  let { data: missions, error: missionError } = await supabase
    .from("missions")
    .select(`id, title, requires_place, badge_ids`)
    .eq("is_active", true)
    .eq("requires_place", false)
    .order("unlock_count", { ascending: true });

  throwIfError("장소 불필요 미션 조회 실패", missionError);

  if (!missions || missions.length === 0) {
    const result = await supabase
      .from("missions")
      .select(`id, title, requires_place, badge_ids`)
      .eq("is_active", true)
      .order("unlock_count", { ascending: true });

    throwIfError("활성 미션 조회 실패", result.error);
    missions = result.data;
  }

  if (!missions || missions.length === 0) {
    throw new Error("missions 테이블에 활성 미션이 없습니다.");
  }

  const mission = missions[attemptIndex % missions.length];

  let placeId = null;
  if (mission.requires_place) {
    const { data: place, error: placeError } = await supabase
      .from("places")
      .select("id, name")
      .limit(1)
      .maybeSingle();

    throwIfError("장소 조회 실패", placeError);
    if (!place) throw new Error("선택한 미션은 장소가 필요하지만 places 데이터가 없습니다.");
    placeId = place.id;
    console.log(`✅ 테스트 장소 선택: ${place.name}`);
  }

  console.log(`✅ 테스트 미션 선택: ${mission.title}`);
  return { mission, placeId };
}

async function getOrCreateMissionAttempt(user, journey, attemptIndex) {
  // 1. 현재 사용자에게 '진행 중'인 찌꺼기 미션이 있는지 전체 검사
  const { data: activeAttempts, error: activeError } = await supabase
    .from("mission_attempts")
    .select(`id, journey_id, status`)
    .eq("user_id", user.id)
    .in("status", ["selected", "started"]);

  if (activeError) throwIfError("진행 중인 미션 조회 실패", activeError);

  if (activeAttempts && activeAttempts.length > 0) {
    for (const active of activeAttempts) {
      if (active.journey_id === journey.id) {
        console.log(`✅ 현재 Journey의 기존 미션 시도 사용: ${active.id}`);
        const { data } = await supabase
          .from("mission_attempts")
          .select(`id, user_id, journey_id, mission_id, place_id, status`)
          .eq("id", active.id)
          .single();
        return data;
      } else {
        console.log(`🧹 다른 Journey의 찌꺼기 미션(${active.id})을 강제 청소합니다...`);
        const { error: cancelError } = await supabase.rpc("cancel_mission", { p_mission_attempt_id: active.id });
        if (cancelError) {
          await supabase.from("mission_attempts").delete().eq("id", active.id);
        }
      }
    }
  }

  // 2. 방해물이 사라졌으므로 안전하게 새 미션 선택
  const { mission, placeId } = await findMissionAndPlace(attemptIndex);

  const { data: missionAttemptId, error: selectMissionError } = await supabase.rpc("select_mission", {
    p_journey_id: journey.id,
    p_mission_id: mission.id,
    p_place_id: placeId,
  });

  throwIfError("select_mission RPC 실패", selectMissionError);

  const { data: createdAttempt, error: createdAttemptError } = await supabase
    .from("mission_attempts")
    .select(`id, user_id, journey_id, mission_id, place_id, status`)
    .eq("id", missionAttemptId)
    .single();

  throwIfError("생성된 미션 시도 조회 실패", createdAttemptError);

  console.log("✅ 새 미션 선택 성공");
  return createdAttempt;
}

async function startAttempt(attempt) {
  if (attempt.status === "started") {
    console.log("✅ 미션이 이미 started 상태입니다.");
    return attempt.id;
  }

  const { data: missionAttemptId, error: startError } = await supabase.rpc("start_mission", {
    p_mission_attempt_id: attempt.id,
  });

  throwIfError("start_mission RPC 실패", startError);
  console.log("✅ 미션 시작 성공");
  return missionAttemptId;
}

async function completeAttempt(attempt, attemptIndex) {
  const emotions = ["joyful", "comfortable", "new", "uncomfortable", "unsure"];
  const emotion = emotions[attemptIndex % emotions.length];

  const { data: recordId, error: completeError } = await supabase.rpc(
    "complete_mission_with_record",
    {
      p_mission_attempt_id: attempt.id,
      p_emotion: emotion,
      p_content: `백엔드 통합 테스트로 생성한 ${attemptIndex + 1}번째 기록입니다.`,
      p_visibility: "private",
      p_place_id: attempt.place_id,
    },
  );

  throwIfError("complete_mission_with_record RPC 실패", completeError);
  console.log(`✅ 기록 생성 성공: ${recordId} (감정: ${emotion})`);
  return recordId;
}

async function uploadTestPhoto(user, recordId) {
  const existingPhotoResult = await supabase
    .from("record_photos")
    .select("id, storage_path")
    .eq("record_id", recordId)
    .limit(1)
    .maybeSingle();

  throwIfError("기존 사진 조회 실패", existingPhotoResult.error);

  if (existingPhotoResult.data) {
    console.log("✅ 이미 사진이 있어 업로드 테스트를 건너뜁니다.");
    return existingPhotoResult.data.storage_path;
  }

  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const pngBuffer = Buffer.from(pngBase64, "base64");
  const imageArrayBuffer = pngBuffer.buffer.slice(
    pngBuffer.byteOffset,
    pngBuffer.byteOffset + pngBuffer.byteLength,
  );

  const storagePath = `${user.id}/${recordId}/backend-flow-${Date.now()}.png`;

  const { data: uploadedFile, error: uploadError } = await supabase.storage
    .from("record-photos")
    .upload(storagePath, imageArrayBuffer, {
      contentType: "image/png",
      cacheControl: "3600",
      upsert: false,
    });

  throwIfError("Storage 사진 업로드 실패", uploadError);

  const { error: photoInsertError } = await supabase
    .from("record_photos")
    .insert({
      record_id: recordId,
      storage_path: uploadedFile.path,
      sort_order: 0,
      is_cover: true,
    });

  if (photoInsertError) {
    await supabase.storage.from("record-photos").remove([uploadedFile.path]);
    throwIfError("record_photos 저장 실패", photoInsertError);
  }

  console.log("✅ 사진 업로드 및 DB 저장 성공");
  return uploadedFile.path;
}

async function verifyResults(user, journeyId, missionAttemptId, recordId, isLastRecord) {
  const [recordResult, attemptResult, journeyResult, badgeResult, photoResult] = await Promise.all([
    supabase.from("records").select(`id, emotion, content`).eq("id", recordId).single(),
    supabase.from("mission_attempts").select(`id, status`).eq("id", missionAttemptId).single(),
    supabase.from("journeys").select(`id, status, target_record_count`).eq("id", journeyId).single(),
    supabase.from("user_badges").select(`badge_id, points, tier`).eq("user_id", user.id),
    supabase.from("record_photos").select(`id, storage_path`).eq("record_id", recordId),
  ]);

  throwIfError("최종 기록 검증 실패", recordResult.error);
  throwIfError("최종 미션 상태 검증 실패", attemptResult.error);
  throwIfError("최종 Journey 상태 검증 실패", journeyResult.error);
  
  if (attemptResult.data.status !== "completed") {
    throw new Error(`미션 상태가 completed가 아닙니다: ${attemptResult.data.status}`);
  }

  const expectedJourneyStatus = isLastRecord ? "completed" : "active";
  if (journeyResult.data.status !== expectedJourneyStatus) {
    throw new Error(`Journey 상태가 ${expectedJourneyStatus}가 아닙니다: ${journeyResult.data.status}`);
  }
}

async function main() {
  console.log(`\n🚀 백엔드 통합 테스트 시작 (목표 기록 수: ${TARGET_RECORD_COUNT}개)\n`);

  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  throwIfError("테스트 계정 로그인 실패", loginError);
  const user = loginData.user;
  if (!user) throw new Error("로그인했지만 사용자 정보가 없습니다.");

  console.log(`✅ 로그인 성공: ${user.email}`);
  await ensureProfile(user);

  const journey = await getOrCreateActiveJourney(user, TARGET_RECORD_COUNT);

  for (let i = 0; i < TARGET_RECORD_COUNT; i++) {
    console.log(`\n--- 📝 [${i + 1}/${TARGET_RECORD_COUNT}] 번째 기록 사이클 시작 ---`);
    
    const attempt = await getOrCreateMissionAttempt(user, journey, i);
    await startAttempt(attempt);
    const recordId = await completeAttempt(attempt, i);
    await uploadTestPhoto(user, recordId);
    
    const isLastRecord = (i + 1 === TARGET_RECORD_COUNT);
    await verifyResults(user, journey.id, attempt.id, recordId, isLastRecord);
  }

  console.log("\n==============================");
  console.log("🎉 미션 및 기록 작성 통합 테스트 성공");
  console.log("==============================\n");

  console.log("🤖 AI 에세이 초안 생성 및 작성 시작...");
  const essayResult = await createEssayDraftAndVerify(user, journey.id);

  console.log("에세이 기본정보:", essayResult.essay);
  console.log(`에세이 연결 기록 개수: ${essayResult.essayItems.length}개`);

  const aiEssay = await generateEssayWithUpstageAndVerify(essayResult.essay.id);
  console.log("\n✨ AI 에세이 최종 결과:", aiEssay);

  await supabase.auth.signOut({ scope: "local" });
}

main().catch(async (error) => {
  console.error("\n==============================");
  console.error("❌ 백엔드 통합 테스트 실패");
  console.error("==============================");
  console.error(error);
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {}
  process.exitCode = 1;
});

async function createEssayDraftAndVerify(user, journeyId) {
  const { data: essayId, error: createEssayError } = await supabase.rpc("create_essay_draft", {
    p_journey_id: journeyId,
    p_title: "백엔드 통합 테스트 에세이",
  });
  throwIfError("create_essay_draft RPC 실패", createEssayError);
  if (!essayId) throw new Error("에세이 ID가 반환되지 않았습니다.");

  console.log(`✅ 에세이 초안 생성 성공: ${essayId}`);

  const { data: essay, error: essayError } = await supabase
    .from("essays")
    .select(`id, user_id, journey_id, title, cover_photo_path, visibility, status, created_at, updated_at`)
    .eq("id", essayId)
    .eq("user_id", user.id)
    .single();
  throwIfError("생성된 에세이 조회 실패", essayError);

  const { data: essayItems, error: essayItemsError } = await supabase
    .from("essay_items")
    .select(`id, essay_id, record_id, ai_bridge_text, sort_order, created_at`)
    .eq("essay_id", essayId)
    .order("sort_order", { ascending: true });
  throwIfError("에세이 기록 연결 조회 실패", essayItemsError);
  if (!essayItems || essayItems.length === 0) throw new Error("에세이에 연결된 기록이 없습니다.");
  if (essay.status !== "draft") throw new Error(`에세이 상태가 draft가 아닙니다: ${essay.status}`);

  return { essay, essayItems };
}

function getSingleRelation(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseEssayAiResult(rawAnswer) {
  const cleaned = rawAnswer.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) throw new Error("AI 응답에서 JSON을 찾을 수 없습니다.");

  let parsed;
  try {
    parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
  } catch {
    throw new Error(`AI 응답 JSON 변환 실패:\n${rawAnswer}`);
  }

  if (typeof parsed.title !== "string" || !parsed.title.trim()) throw new Error("AI 응답에 제목이 없습니다.");
  if (!Array.isArray(parsed.bridges)) throw new Error("AI 응답에 bridges 배열이 없습니다.");

  const bridges = parsed.bridges.map((bridge, index) => {
    if (!Number.isInteger(bridge.recordIndex) || typeof bridge.bridgeText !== "string" || !bridge.bridgeText.trim()) {
      throw new Error(`${index + 1}번째 연결 문장 형식이 잘못됐습니다.`);
    }
    return { recordIndex: bridge.recordIndex, bridgeText: bridge.bridgeText.trim() };
  });
  return { title: parsed.title.trim(), bridges };
}

async function generateEssayWithUpstageAndVerify(essayId) {
  const { data: essay, error: essayError } = await supabase
    .from("essays")
    .select(`
      id, journey_id, 
      essay_items (
        id, sort_order, records (
          id, recorded_at, emotion, content,
          mission_attempts ( missions ( title ) ),
          places ( name )
        )
      )
    `)
    .eq("id", essayId)
    .single();
  throwIfError("AI 입력용 에세이 조회 실패", essayError);

  const items = [...(essay.essay_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  if (items.length === 0) throw new Error("AI에 전달할 기록이 없습니다.");

  const recordsText = items
    .map((item, index) => {
      const record = getSingleRelation(item.records);
      if (!record) return null;
      const missionAttempt = getSingleRelation(record.mission_attempts);
      const mission = getSingleRelation(missionAttempt?.missions);
      const place = getSingleRelation(record.places);

      return [
        `[기록 ${index + 1}]`,
        `날짜: ${record.recorded_at}`,
        `미션: ${mission?.title ?? "미션 정보 없음"}`,
        `장소: ${place?.name ?? "장소 정보 없음"}`,
        `감정: ${record.emotion}`,
        `내용: ${record.content}`,
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  const prompt = `
다음은 한 사용자가 Journey 동안 작성한 실제 경험 기록입니다.

${recordsText}

위 기록만을 바탕으로 자연스러운 한국어 에세이를 구성하세요.

규칙:
- 기록에 없는 사실을 만들지 마세요.
- 사용자의 감정과 경험을 중심으로 작성하세요.
- 각 기록을 소개하거나 이어주는 연결 문장을 작성하세요.
- 반드시 JSON만 반환하세요.
- bridges 개수는 기록 개수와 같아야 합니다.
- recordIndex는 0부터 시작합니다.

{
  "title": "에세이 제목",
  "bridges": [
    {
      "recordIndex": 0,
      "bridgeText": "기록을 자연스럽게 소개하는 문장"
    }
  ]
}
`.trim();

  const { data: upstageData, error: upstageError } = await supabase.functions.invoke("upstage-test", {
    body: { message: prompt },
  });
  throwIfError("Upstage Edge Function 호출 실패", upstageError);
  if (!upstageData?.answer) throw new Error("Upstage 응답에 answer가 없습니다.");

  console.log("✅ Upstage AI 응답 수신 성공");
  const aiResult = parseEssayAiResult(upstageData.answer);

  if (aiResult.bridges.length !== items.length) {
    throw new Error(`AI 연결 문장 개수가 기록 개수와 다릅니다. 기록: ${items.length}, 연결 문장: ${aiResult.bridges.length}`);
  }

  const { data: savedEssayId, error: saveError } = await supabase.rpc("save_essay_ai_result", {
    p_essay_id: essayId,
    p_title: aiResult.title,
    p_bridges: aiResult.bridges,
  });
  throwIfError("AI 에세이 결과 저장 실패", saveError);

  const { data: savedEssay, error: verifyError } = await supabase
    .from("essays")
    .select(`id, title, status, essay_items ( id, sort_order, ai_bridge_text )`)
    .eq("id", savedEssayId)
    .single();
  throwIfError("저장된 AI 에세이 확인 실패", verifyError);

  const savedItems = savedEssay.essay_items ?? [];
  if (savedItems.some((item) => !item.ai_bridge_text)) throw new Error("저장되지 않은 AI 연결 문장이 있습니다.");

  console.log(`✅ AI 에세이 제목 저장 성공: ${savedEssay.title}`);
  return savedEssay;
}