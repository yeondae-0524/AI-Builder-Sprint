import { supabase } from "@/lib/supabase";

// 📌 1. SNS 피드용 데이터 타입 정의
export type SnsFeedRequest = {
  missionTitle: string;
  userContent: string;
  emotion: string;
  placeName?: string;
};

export type SnsFeedResponse = {
  titleCardText: string;
  bodyCardText: string;
  hashtags: string[];
  themeColor: string;
  accentColor: string;
};

// 📌 2. 취향 리포트용 데이터 타입 정의
export type RecordItem = {
  missionTitle: string;
  userContent: string;
  emotion: string;
};

export type TasteReportRequest = {
  journeyTitle: string;
  records: RecordItem[];
};

export type InsightItem = {
  keyword: string;
  description: string;
};

export type TasteReportResponse = {
  summary: string;
  insights: InsightItem[];
  aiRecommendation: string;
};

/**
 * 📸 1. SNS 파노라마 피드용 감성 문구 및 테마 생성 API
 */
export async function generateSnsFeedData(
  params: SnsFeedRequest,
): Promise<SnsFeedResponse> {
  const { data, error } = await supabase.functions.invoke("generate-essay", {
    body: {
      type: "sns-feed",
      ...params,
    },
  });

  if (error) {
    console.error("SNS 피드 데이터 생성 실패:", error);
    throw new Error("SNS 피드용 데이터를 생성하지 못했습니다.");
  }

  return data as SnsFeedResponse;
}

/**
 * 📊 2. AI 취향 분석 리포트 생성 API
 */
export async function generateTasteReport(
  params: TasteReportRequest,
): Promise<TasteReportResponse> {
  const { data, error } = await supabase.functions.invoke("generate-essay", {
    body: {
      type: "taste-report",
      ...params,
    },
  });

  if (error) {
    console.error("취향 리포트 생성 실패:", error);
    throw new Error("취향 분석 리포트를 생성하지 못했습니다.");
  }

  return data as TasteReportResponse;
}