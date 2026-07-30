import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createRecord } from "../../services/records.service";
import { uploadMissionImage } from "../../services/storage.service";

const BL = "#3D5AFE";
const BLL = "#EEF1FF";
const T0 = "#0F0F0F";
const T1 = "#5C5F6A";
const T2 = "#9EA3AE";
const WH = "#FFFFFF";

const EMOTIONS = [
  { key: "joyful", label: "기쁨" },
  { key: "comfortable", label: "편안함" },
  { key: "new", label: "새로움" },
  { key: "uncomfortable", label: "불편함" },
  { key: "unsure", label: "막연함" },
];

type RecordTarget = { attemptId: string; title: string } | null;

export function RecordModal({
  visible,
  target,
  onClose,
}: {
  visible: boolean;
  target: RecordTarget;
  onClose: () => void;
}) {
  const [emotion, setEmotion] = useState("joyful");
  const [content, setContent] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!target) return;
    if (!content.trim()) {
      Alert.alert("기록 작성", "오늘의 경험을 짧게라도 적어주세요.");
      return;
    }
    setLoading(true);

    const result = await createRecord({
      missionAttemptId: target.attemptId,
      emotion,
      content: content.trim(),
      visibility: "private",
    });

    if (!result.success) {
      setLoading(false);
      const message = result.error instanceof Error ? result.error.message : "기록 저장에 실패했어요.";
      Alert.alert("저장 실패", message);
      return;
    }

    if (photoUri) {
      const uploadResult = await uploadMissionImage({
        imageUri: photoUri,
        recordId: result.recordId,
        mimeType: "image/jpeg",
      });
      if (!uploadResult.success) {
        console.log("사진 업로드 실패:", uploadResult.error);
      }
    }

    setContent("");
    setPhotoUri(null);
    setLoading(false);
    onClose();
    Alert.alert("완료했어요", "오늘의 기록이 저장됐어요.");
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            <Text style={styles.title}>{target?.title ?? "오늘의 경험을 기록해요"}</Text>

            <Text style={styles.label}>지금 기분</Text>
            <View style={styles.emotionRow}>
              {EMOTIONS.map((e) => (
                <Pressable
                  key={e.key}
                  onPress={() => setEmotion(e.key)}
                  style={[styles.emotionChip, emotion === e.key && styles.emotionChipActive]}
                >
                  <Text style={[styles.emotionText, emotion === e.key && styles.emotionTextActive]}>{e.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>기록</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="오늘 이 미션을 하면서 느낀 걸 적어보세요"
              placeholderTextColor={T2}
              multiline
              style={styles.textArea}
            />

            <Text style={styles.label}>사진 (선택)</Text>
            <Pressable onPress={pickPhoto} style={styles.photoPicker}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              ) : (
                <Text style={{ color: T2, fontSize: 12 }}>사진 추가하기</Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={[styles.submitButton, loading && { opacity: 0.6 }]}
            >
              <Text style={styles.submitText}>{loading ? "저장 중..." : "미션 완료하기"}</Text>
            </Pressable>

            <Pressable onPress={onClose} style={{ alignItems: "center", marginTop: 10 }}>
              <Text style={{ color: T2, fontSize: 12 }}>나중에 하기</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: WH, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%" },
  title: { fontSize: 17, fontWeight: "700", color: T0, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: T1, marginBottom: 8, marginTop: 12 },
  emotionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emotionChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: "#F3F4F6" },
  emotionChipActive: { backgroundColor: BLL },
  emotionText: { fontSize: 12, color: T1 },
  emotionTextActive: { color: BL, fontWeight: "700" },
  textArea: { minHeight: 90, backgroundColor: "#F7F8FA", borderRadius: 12, padding: 12, fontSize: 13, color: T0, textAlignVertical: "top" },
  photoPicker: { height: 100, borderRadius: 12, backgroundColor: "#F7F8FA", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoPreview: { width: "100%", height: "100%" },
  submitButton: { marginTop: 20, backgroundColor: BL, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  submitText: { color: WH, fontSize: 14, fontWeight: "700" },
});