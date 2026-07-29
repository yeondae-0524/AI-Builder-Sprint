import cors from 'cors';
import express from 'express';
import { supabase } from './supabase.js';

const app = express();
app.use(cors());
app.use(express.json());

// 📌 프론트엔드가 카카오맵에 띄울 장소들을 달라고 할 때 호출하는 API
app.get('/api/places', async (req, res) => {
  // Supabase 'places' 테이블의 모든 데이터를 조회
  const { data, error } = await supabase
    .from('places')
    .select('*');

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // 성공 시 프론트엔드로 데이터 전달
  return res.json(data);
});

app.listen(5000, () => {
  console.log('백엔드 서버가 5000번 포트에서 실행 중입니다!');
});