import app from "./src/app.js";

const PORT = Number(process.env.PORT ?? 5000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ 백엔드 서버 실행 중: http://localhost:${PORT}`);
});