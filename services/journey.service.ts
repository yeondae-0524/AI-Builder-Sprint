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

export type ActiveJourneyProgress = {
  journey: Journey | null;
  recordCount: number;
};

type JourneyConfig = {
  title: string;
  targetRecordCount: number;
};

const JOURNEY_CONFIG: Record<
  DurationDays,
  JourneyConfig
> = {
  7: {
    title: "1주의 여정",
    targetRecordCount: 4,
  },
  14: {
    title: "2주의 여정",
    targetRecordCount: 7,
  },
  30: {
    title: "한 달의 여정",
    targetRecordCount: 15,
  },
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
 * 기간에 따른 Journey 제목을 반환한다.
 */
export function getJourneyTitle(
  durationDays: DurationDays,
): string {
  return JOURNEY_CONFIG[durationDays].title;
}

/**
 * 기간에 따른 목표 기록 수를 반환한다.
 */
export function getJourneyTargetRecordCount(
  durationDays: DurationDays,
): number {
  return JOURNEY_CONFIG[durationDays]
    .targetRecordCount;
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

  const config = JOURNEY_CONFIG[durationDays];

  const newJourney = {
    user_id: userId,
    title: config.title,
    duration_days: durationDays,
    target_record_count:
      config.targetRecordCount,
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
 * 진행 중인 여정과 해당 여정의 기록 수를 함께 조회한다.
 */
export async function getActiveJourneyProgress(): Promise<
  ActiveJourneyProgress
> {
  const userId = await getCurrentUserId();

  const { data: journeyData, error: journeyError } =
    await supabase
      .from("journeys")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (journeyError) {
    throw journeyError;
  }

  const journey =
    (journeyData as Journey | null) ?? null;

  if (!journey) {
    return {
      journey: null,
      recordCount: 0,
    };
  }

  const { count, error: countError } =
    await supabase
      .from("records")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", userId)
      .eq("journey_id", journey.id);

  if (countError) {
    throw countError;
  }

  return {
    journey,
    recordCount: count ?? 0,
  };
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
    .eq("status", "active")
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Journey;
}

/**
 * 선택한 진행 중 여정을 중단 상태로 변경한다.
 * 기록과 사진은 삭제하지 않는다.
 */
export async function cancelJourney(
  journeyId: string,
): Promise<Journey> {
  const userId = await getCurrentUserId();

  if (!journeyId.trim()) {
    throw new Error("여정 ID가 필요합니다.");
  }

  const { data, error } = await supabase
    .from("journeys")
    .update({
      status: "cancelled",
    })
    .eq("id", journeyId)
    .eq("user_id", userId)
    .eq("status", "active")
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as Journey;
}