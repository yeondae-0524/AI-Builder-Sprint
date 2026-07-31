import { supabase } from "../lib/supabase";

type UpstageResponse = {
  answer: string;
};

export async function getChallengeRecommendation(
  message: string,
): Promise<string> {
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    throw new Error("기록을 입력해주세요.");
  }

  const { data, error } = await supabase.functions.invoke<UpstageResponse>(
    "upstage-test",
    {
      body: {
        message: trimmedMessage,
      },
    },
  );

  if (error) {
    console.error("Upstage 함수 호출 오류:", error);
    throw new Error("AI 추천을 불러오지 못했습니다.");
  }

  if (!data?.answer) {
    throw new Error("AI 추천 결과가 없습니다.");
  }

  return data.answer;
}