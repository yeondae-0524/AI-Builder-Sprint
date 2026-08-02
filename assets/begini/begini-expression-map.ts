export type BeginiExpression =
  | "determined"
  | "nervous"
  | "flustered"
  | "blank"
  | "relieved"
  | "proud"
  | "shocked"
  | "thinking";

export const BEGINI_EXPRESSION_IMAGES = {
  determined: require("./expressions/begini_determined.png"),
  nervous: require("./expressions/begini_nervous.png"),
  flustered: require("./expressions/begini_flustered.png"),
  blank: require("./expressions/begini_blank.png"),
  relieved: require("./expressions/begini_relieved.png"),
  proud: require("./expressions/begini_proud.png"),
  shocked: require("./expressions/begini_shocked.png"),
  thinking: require("./expressions/begini_thinking.png"),
} as const;
