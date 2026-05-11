// src/screens/HealthConnectScreen.js
import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert, Linking, Platform
} from "react-native";
import { colors, spacing, typography, radius } from "../theme";
import { Card, Button, Section } from "../components/ui";
import api from "../api/client";

// Импортируем библиотеку безопасно — если не установлена, кнопка покажет ошибку
let HC = null;
try {
  HC = require("react-native-health-connect");
} catch (e) {
  console.warn("react-native-health-connect not installed");
}


export default function HealthConnectScreen({ navigation }) {
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState(null);

  // Проверка и запуск синхронизации
  const handleSync = async () => {
    if (!HC) {
      Alert.alert(
        "Библиотека не установлена",
        "Нужно установить react-native-health-connect и пересобрать APK через EAS Build."
      );
      return;
    }

    if (Platform.OS !== "android") {
      Alert.alert("Только Android", "Health Connect работает только на Android");
      return;
    }

    setSyncing(true);
    setStatus("Инициализация...");

    try {
      // 1. Инициализируем SDK
      const initialized = await HC.initialize();
      if (!initialized) {
        throw new Error("Health Connect недоступен. Установи из Play Store.");
      }

      // 2. Запрашиваем разрешения
      setStatus("Запрос разрешений...");
      const granted = await HC.requestPermission([
        { accessType: "read", recordType: "SleepSession" },
        { accessType: "read", recordType: "HeartRate" },
        { accessType: "read", recordType: "OxygenSaturation" },
      ]);

      if (!granted || granted.length === 0) {
        throw new Error("Разрешения не выданы");
      }

      // 3. Читаем сон за 30 дней
      setStatus("Чтение данных за 30 дней...");
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);

      const result = await HC.readRecords("SleepSession", {
        timeRangeFilter: {
          operator: "between",
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      });

      const sessions = result.records || [];
      if (sessions.length === 0) {
        throw new Error("Нет данных сна в Health Connect за последние 30 дней");
      }

      // 4. Формируем payload для backend'а
      setStatus(`Найдено ${sessions.length} ночей. Отправка...`);

      const payload = {
        sleepSessions: sessions.map(s => ({
          startTime: s.startTime,
          endTime: s.endTime,
          stages: (s.stages || []).map(stage => ({
            startTime: stage.startTime,
            endTime: stage.endTime,
            stage: stage.stage, // 1=Unknown, 2=Awake, 3=Sleeping(light), 4=Deep, 5=REM, 6=Out of bed
          })),
        })),
      };

      // 5. POST на backend
      const response = await api.post("/api/health-connect", payload);

      setStatus(null);
      setSyncing(false);
      Alert.alert(
        "Синхронизация завершена ✓",
        `Сохранено ${response.data.saved} сессий сна.\n\nТеперь можешь запустить анализ во вкладке Главная.`,
        [{ text: "Отлично" }]
      );
    } catch (e) {
      setSyncing(false);
      setStatus(null);
      console.error("HC sync error:", e);
      Alert.alert("Ошибка синхронизации", e.message || String(e));
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Health Connect</Text>
          <Text style={styles.subtitle}>Подключение и синхронизация</Text>
        </View>

        {/* Что это */}
        <Card style={styles.heroCard}>
          <Text style={styles.heroIcon}>🏥</Text>
          <Text style={styles.heroTitle}>Что это такое?</Text>
          <Text style={styles.heroText}>
            Health Connect — это хранилище данных о здоровье от Google.
            Приложения часов (Mi Fitness, Zepp, Samsung Health) пишут туда
            данные сна, а Somnisense их читает и анализирует.
          </Text>
        </Card>

        {/* Шаги */}
        <Section title="Шаг 1. Установить Health Connect">
          <Card>
            <Text style={styles.stepText}>
              На Android 14+ Health Connect встроен в систему — ничего ставить не нужно.
            </Text>
            <Text style={[styles.stepText, { marginTop: spacing.sm }]}>
              На Android 8-13 — установи приложение из Play Store:
            </Text>
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata")}
            >
              <Text style={styles.linkText}>📥 Открыть Play Store</Text>
            </TouchableOpacity>
          </Card>
        </Section>

        <Section title="Шаг 2. Разрешить приложению часов">
          <Card>
            <Text style={styles.stepText}>
              Открой приложение твоих часов:
            </Text>
            <Text style={styles.bullet}>• <Text style={styles.bold}>Mi Fitness / Zepp Life</Text> (Xiaomi, Amazfit)</Text>
            <Text style={styles.bullet}>• <Text style={styles.bold}>Zepp</Text> (Amazfit GTS/GTR/T-Rex)</Text>
            <Text style={styles.bullet}>• <Text style={styles.bold}>Samsung Health</Text> (Galaxy Watch)</Text>
            <Text style={styles.bullet}>• <Text style={styles.bold}>Huawei Health</Text> (Honor / Huawei Band)</Text>
            <Text style={styles.bullet}>• <Text style={styles.bold}>Fitbit / Garmin Connect</Text></Text>

            <Text style={[styles.stepText, { marginTop: spacing.md }]}>
              В нём найди:
            </Text>
            <Text style={styles.codeBlock}>
              Профиль → Настройки → Подключения{"\n"}
              → Health Connect → Включить{"\n"}
              → Разрешить запись данных Sleep
            </Text>
          </Card>
        </Section>

        <Section title="Шаг 3. Проверить данные">
          <Card>
            <Text style={styles.stepText}>
              Открой Health Connect → Данные и доступ → Сон. Там должны быть
              записи. Если пусто — данные ещё не пришли с часов, синхронизируй
              их в приложении производителя вручную.
            </Text>
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL("market://launch?id=com.google.android.apps.healthdata")
                .catch(() => Linking.openURL("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata"))
              }
            >
              <Text style={styles.linkText}>🏥 Открыть Health Connect</Text>
            </TouchableOpacity>
          </Card>
        </Section>

        <Section title="Шаг 4. Синхронизировать с Somnisense">
          <Card>
            <Text style={styles.stepText}>
              Когда данные есть в Health Connect — жми кнопку ниже.
              Приложение запросит разрешение на чтение и загрузит сон за 30 дней.
            </Text>

            {status && (
              <Text style={styles.statusText}>{status}</Text>
            )}

            <Button
              title={syncing ? "Синхронизация..." : "🔄 Синхронизировать сейчас"}
              onPress={handleSync}
              disabled={syncing}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </Section>

        {/* Поддерживаемые устройства */}
        <Section title="Поддерживаемые часы">
          <Card>
            <Text style={styles.bullet}>✓ Xiaomi / Amazfit (через Mi Fitness, Zepp)</Text>
            <Text style={styles.bullet}>✓ Samsung Galaxy Watch</Text>
            <Text style={styles.bullet}>✓ Huawei / Honor Band</Text>
            <Text style={styles.bullet}>✓ Fitbit</Text>
            <Text style={styles.bullet}>✓ Garmin</Text>
            <Text style={styles.bullet}>✓ Google Pixel Watch / Fitbit Sense</Text>
            <Text style={[styles.stepText, { marginTop: spacing.sm, fontStyle: "italic" }]}>
              Apple Watch не поддерживается — Health Connect только на Android.
            </Text>
          </Card>
        </Section>

        {/* Если не работает */}
        <Section title="Если не работает">
          <Card>
            <Text style={styles.bullet}><Text style={styles.bold}>Нет данных сна:</Text> синхронизируй часы в приложении производителя</Text>
            <Text style={styles.bullet}><Text style={styles.bold}>Разрешение не появилось:</Text> Настройки Android → Приложения → Health Connect → Разрешения</Text>
            <Text style={styles.bullet}><Text style={styles.bold}>Ошибка инициализации:</Text> переустанови Health Connect из Play Store</Text>
            <Text style={styles.bullet}><Text style={styles.bold}>Старая Android (до 8.0):</Text> Health Connect не поддерживается, используй CSV-экспорт</Text>
          </Card>
        </Section>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xxl },

  header: { marginBottom: spacing.md },
  backBtn: { color: colors.accent.primary, fontSize: typography.sizes.md, marginBottom: spacing.sm },
  title: { fontSize: typography.sizes.xxl, fontWeight: "800", color: colors.text.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2 },

  heroCard: { alignItems: "center", paddingVertical: spacing.lg, marginBottom: spacing.md },
  heroIcon: { fontSize: 48, marginBottom: spacing.sm },
  heroTitle: { fontSize: typography.sizes.lg, fontWeight: "700", color: colors.text.primary, marginBottom: spacing.xs },
  heroText: { fontSize: typography.sizes.sm, color: colors.text.secondary, textAlign: "center", lineHeight: 20 },

  stepText: { fontSize: typography.sizes.sm, color: colors.text.primary, lineHeight: 22 },
  bullet: { fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 4, lineHeight: 22 },
  bold: { fontWeight: "700", color: colors.text.primary },

  codeBlock: {
    fontSize: typography.sizes.xs,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.accent.primary,
    backgroundColor: colors.bg.elevated,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    lineHeight: 18,
  },

  linkBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    alignSelf: "flex-start",
  },
  linkText: { color: colors.accent.primary, fontWeight: "600" },

  statusText: {
    color: colors.accent.primary,
    fontSize: typography.sizes.sm,
    textAlign: "center",
    marginTop: spacing.md,
    fontStyle: "italic",
  },
});
