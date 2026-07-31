/**
 * AI/DB에서 받은 미션 안내를 화면에 표시하기 전에 정리합니다.
 * - "수행 방법:" 같은 머리말 제거
 * - 1. / 2) / 불릿 / 줄바꿈 제거
 * - 너무 짧으면 보충
 * - 마지막을 반드시 "해보세요."로 통일
 */
export function normalizeMissionGuide(
  value: unknown,
  description = "",
): string {
  let text = String(value ?? "")
    .replace(/\r/g, "")
    .replace(
      /^\s*(?:미션\s*)?(?:수행\s*)?(?:방법|안내)\s*[:：-]?\s*/i,
      "",
    )
    .replace(
      /(?:^|\n|\s)(?:\d{1,2}\s*[.)]|[-•▪◦])\s*/g,
      " ",
    )
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    text =
      "안내된 장소에서 주변의 분위기와 자신의 느낌을 천천히 살피며 미션을 수행해보세요";
  }

  text = text.replace(/[.!?。]+$/g, "").trim();

  if (text.length < 38) {
    const cleanDescription = String(description ?? "")
      .replace(/[.!?。]+$/g, "")
      .trim();

    text = [
      text,
      cleanDescription
        ? "주변의 분위기와 자신의 느낌도 함께 살피며"
        : "서두르지 말고 주변의 분위기와 자신의 느낌을 살피며",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (/해\s*보세요$/u.test(text)) {
    return `${text.replace(/해\s*보세요$/u, "해보세요")}.`;
  }

  if (/해\s*주세요$/u.test(text)) {
    return `${text.replace(/해\s*주세요$/u, "해보세요")}.`;
  }

  if (/하세요$/u.test(text)) {
    return `${text.replace(/하세요$/u, "해보세요")}.`;
  }

  if (/합니다$/u.test(text)) {
    return `${text.replace(/합니다$/u, "해보세요")}.`;
  }

  if (/해요$/u.test(text)) {
    return `${text.replace(/해요$/u, "해보세요")}.`;
  }

  if (/보세요$/u.test(text)) {
    return `${text}.`;
  }

  return `${text} 천천히 시도해보세요.`;
}