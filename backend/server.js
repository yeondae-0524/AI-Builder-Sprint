const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("백엔드 서버 실행 성공!");
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "서버가 정상적으로 작동하고 있습니다.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});