import { supabase } from "../lib/supabase";

export type BadgeTier =
  | "LOCKED"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PRISM";

export type Badge = {
  id: string;
  name: string;
  icon: string;
  title: string | null;
  description: string | null;
  created_at: string | null;
};

export type UserBadge = {
  id: string | null;
  user_id: string;
  badge_id: string;
  points: number;
  tier: BadgeTier;
  updated_at: string | null;
  badge: Badge;
};

export type BadgeProgress = UserBadge & {
  nextTier: Exclude<BadgeTier, "LOCKED"> | null;
  nextTierPoints: number | null;
  pointsToNextTier: number;
};

const TIER_THRESHOLDS = {
  BRONZE: 3,
  SILVER: 7,
  GOLD: 15,
  PRISM: 30,
} as const;

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

function normalizeTier(value: unknown): BadgeTier {
  if (
    value === "BRONZE" ||
    value === "SILVER" ||
    value === "GOLD" ||
    value === "PRISM"
  ) {
    return value;
  }

  return "LOCKED";
}

function getNextTier(points: number): {
  nextTier: Exclude<BadgeTier, "LOCKED"> | null;
  nextTierPoints: number | null;
  pointsToNextTier: number;
} {
  if (points < TIER_THRESHOLDS.BRONZE) {
    return {
      nextTier: "BRONZE",
      nextTierPoints: TIER_THRESHOLDS.BRONZE,
      pointsToNextTier: TIER_THRESHOLDS.BRONZE - points,
    };
  }

  if (points < TIER_THRESHOLDS.SILVER) {
    return {
      nextTier: "SILVER",
      nextTierPoints: TIER_THRESHOLDS.SILVER,
      pointsToNextTier: TIER_THRESHOLDS.SILVER - points,
    };
  }

  if (points < TIER_THRESHOLDS.GOLD) {
    return {
      nextTier: "GOLD",
      nextTierPoints: TIER_THRESHOLDS.GOLD,
      pointsToNextTier: TIER_THRESHOLDS.GOLD - points,
    };
  }

  if (points < TIER_THRESHOLDS.PRISM) {
    return {
      nextTier: "PRISM",
      nextTierPoints: TIER_THRESHOLDS.PRISM,
      pointsToNextTier: TIER_THRESHOLDS.PRISM - points,
    };
  }

  return {
    nextTier: null,
    nextTierPoints: null,
    pointsToNextTier: 0,
  };
}

export async function getBadges(): Promise<Badge[]> {
  const { data, error } = await supabase
    .from("badges")
    .select(
      `
        id,
        name,
        icon,
        title,
        description,
        created_at
      `,
    )
    .order("created_at", {
      ascending: true,
      nullsFirst: true,
    });

  if (error) {
    console.error("getBadges Error:", error);
    throw error;
  }

  return (data ?? []) as Badge[];
}

export async function getMyBadges(): Promise<UserBadge[]> {
  const userId = await getCurrentUserId();

  const [badgesResult, userBadgesResult] = await Promise.all([
    supabase
      .from("badges")
      .select(
        `
          id,
          name,
          icon,
          title,
          description,
          created_at
        `,
      )
      .order("created_at", {
        ascending: true,
        nullsFirst: true,
      }),

    supabase
      .from("user_badges")
      .select(
        `
          id,
          user_id,
          badge_id,
          points,
          tier,
          updated_at
        `,
      )
      .eq("user_id", userId),
  ]);

  if (badgesResult.error) {
    console.error("getMyBadges badges Error:", badgesResult.error);
    throw badgesResult.error;
  }

  if (userBadgesResult.error) {
    console.error("getMyBadges user_badges Error:", userBadgesResult.error);
    throw userBadgesResult.error;
  }

  const userBadgeByBadgeId = new Map(
    (userBadgesResult.data ?? []).map((row) => [String(row.badge_id), row]),
  );

  return (badgesResult.data ?? []).map((badge) => {
    const userBadge = userBadgeByBadgeId.get(String(badge.id));

    return {
      id: userBadge ? String(userBadge.id) : null,
      user_id: userId,
      badge_id: String(badge.id),
      points: userBadge?.points ?? 0,
      tier: normalizeTier(userBadge?.tier),
      updated_at: userBadge?.updated_at ?? null,
      badge: badge as Badge,
    };
  });
}

export async function getMyBadgeProgress(): Promise<BadgeProgress[]> {
  const badges = await getMyBadges();

  return badges.map((badge) => ({
    ...badge,
    ...getNextTier(badge.points),
  }));
}

export async function getMyUnlockedBadges(): Promise<UserBadge[]> {
  const badges = await getMyBadges();

  return badges.filter((badge) => badge.tier !== "LOCKED");
}

export async function getMyBadgeById(badgeId: string): Promise<UserBadge> {
  if (!badgeId.trim()) {
    throw new Error("badgeId가 필요합니다.");
  }

  const badges = await getMyBadges();
  const badge = badges.find((item) => item.badge_id === badgeId);

  if (!badge) {
    throw new Error("배지를 찾을 수 없습니다.");
  }

  return badge;
}