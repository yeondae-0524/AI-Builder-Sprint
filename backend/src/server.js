const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "백엔드 서버가 정상적으로 실행 중입니다.",
  });
});

app.get("/api/missions/today", (req, res) => {
  res.json({
    id: 1,
    title: "오늘 좋아하는 소리 찾기",
    description: "주변에서 마음에 드는 소리를 찾아 짧게 기록해 보세요.",
    category: "일상 관찰",
  });
});

app.listen(PORT, () => {
  console.log(`서버 실행 완료: http://localhost:${PORT}`);
});