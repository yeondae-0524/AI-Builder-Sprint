import { StyleSheet, Text, View } from "react-native";

export default function CalendarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>캘린더</Text>
      <Text style={styles.description}>캘린더 화면입니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F8",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#171719",
  },
  description: {
    marginTop: 12,
    fontSize: 16,
    color: "#767676",
  },
});