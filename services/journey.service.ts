import { supabase } from "../lib/supabase";

export type JourneyStatus =
  | "active"
  | "completed"
  | "cancelled";

export type DurationDays = 7 | 14 | 30;

export type Journey = {
  id: string;
  user_id: string;
  title: string;
  duration_days: DurationDays;
  target_record_count: number;
  start_date: string;
  end_date: string;
  status: JourneyStatus;
  created_at: string;
};

export type CreateJourneyInput = {
  durationDays: DurationDays;
  startDate?: Date;
};

const TARGET_RECORD_COUNT: Record<
  DurationDays,
  number
> = {
  7: 4,
  14: 7,
  30: 15,
};

/**
 * Date를 사용자의 현지 날짜 기준 YYYY-MM-DD로 변환한다.
 * toISOString()을 사용하면 한국 시간에서 날짜가 하루 달라질 수 있다.
 */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");
  const day = String(date.getDate()).padStart(
    2,
    "0",
  );

  return `${year}-${month}-${day}`;
}

/**
 * 현재 로그인한 사용자의 ID를 반환한다.
 */
async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  return user.id;
}

/**
 * 새로운 활동 여정을 생성한다.
 */
export async function createJourney({
  durationDays,
  startDate = new Date(),
}: CreateJourneyInput): Promise<Journey> {
  const userId = await getCurrentUserId();

  const activeJourney =
    await getActiveJourney();

  if (activeJourney) {
    throw new Error(
      "이미 진행 중인 여정이 있습니다.",
    );
  }

  const start = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
  );

  const end = new Date(start);
  end.setDate(
    end.getDate() + durationDays - 1,
  );

  const newJourney = {
    user_id: userId,
    title: `${durationDays}일의 여정`,
    duration_days: durationDays,
    target_record_count:
      TARGET_RECORD_COUNT[durationDays],
    start_date: formatLocalDate(start),
    end_date: formatLocalDate(end),
    status: "active" as const,
  };

  const { data, error } = await supabase
    .from("journeys")
    .insert(newJourney)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Journey;
}

/**
 * 현재 로그인 사용자의 진행 중인 여정을 조회한다.
 */
export async function getActiveJourney(): Promise<
  Journey | null
> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("journeys")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as Journey | null;
}

/**
 * 현재 로그인 사용자의 전체 여정을 조회한다.
 */
export async function getMyJourneys(): Promise<
  Journey[]
> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("journeys")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as Journey[];
}

/**
 * 선택한 여정을 완료 상태로 변경한다.
 */
export async function completeJourney(
  journeyId: string,
): Promise<Journey> {
  const userId = await getCurrentUserId();

  if (!journeyId.trim()) {
    throw new Error("여정 ID가 필요합니다.");
  }

  const { data, error } = await supabase
    .from("journeys")
    .update({
      status: "completed",
    })
    .eq("id", journeyId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Journey;
}
