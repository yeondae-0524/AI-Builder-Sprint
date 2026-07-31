import cors from "cors";
import express from "express";

import { supabase } from "./supabase.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Builder Sprint 백엔드 서버입니다.",
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "서버가 정상적으로 작동하고 있습니다.",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/places", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("places")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      count: data.length,
      places: data,
    });
  } catch (error) {
    console.error("장소 조회 오류:", error);

    return res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "장소를 조회하는 중 오류가 발생했습니다.",
    });
  }
});

export default app;