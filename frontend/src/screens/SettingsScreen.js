// src/screens/SettingsScreen.js
import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert, Linking
} from "react-native";
import * as DocumentPicker from "expo-document-picker";

import { loadSimulation, uploadCSV } from "../api/client";
import { colors, spacing, typography, radius } from "../theme";
import { Card, Button, Section } from "../components/ui";


export default function SettingsScreen({ navigation }) {
  const [simLoading, setSimLoading]  = useState(false);
  const [csvLoading, setCsvLoading]  = useState(false);

  // ── Загрузка симулятора ──────────────────────────────────
  const handleSimulate = async () => {
    setSimLoading(true);
    try {
      const res = await loadSimulation(30);
      Alert.alert(
        "Готово ✓",
        `Загружено ${res.saved} записей симулированных данных сна.\n\nТеперь запустите анализ на главном экране.`,
        [{ text: "На главную", onPress: () => navigation.navigate("Dashboard") }]
      );
    } catch (e) {
      Alert.alert("Ошибка", e.message);
    } finally {
      setSimLoading(false);
    }
  };

  // ── Загрузка CSV ─────────────────────────────────────────
  const handleCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "text/comma-separated-values",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setCsvLoading(true);

      const res = await uploadCSV(file.uri, file.name);
      Alert.alert(
        "Файл загружен ✓",
        `Сохранено записей: ${res.saved}\n${res.errors.length > 0 ? `Ошибок: ${res.errors.length}` : "Ошибок нет"}`,
        [{ text: "Отлично" }]
      );
    } catch (e) {
      Alert.alert("Ошибка", e.message);
    } finally {
      setCsvLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Настройки</Text>
        </View>

        {/* ── Источники данных ─────────────────────────── */}
        <Section title="📡 Источники данных">

          {/* Gadgetbridge */}
          <Card style={styles.sourceCard}>
            <View style={styles.sourceHeader}>
              <Text style={styles.sourceIcon}>⌚</Text>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceName}>Gadgetbridge</Text>
                <Text style={styles.sourceDesc}>
                  Прямое подключение Amazfit GTS 2E
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Настройка</Text>
              </View>
            </View>

            <View style={styles.instructionBox}>
              <Text style={styles.instructionTitle}>Как подключить:</Text>
              <Text style={styles.instructionStep}>1. Установи Gadgetbridge на Android</Text>
              <Text style={styles.instructionStep}>2. Подключи Amazfit GTS 2E</Text>
              <Text style={styles.instructionStep}>3. Настройки → HTTP сервер →</Text>
              <Text style={[styles.instructionStep, styles.code]}>
                {"  "}https://web-production-e9298.up.railway.app/api/gadgetbridge/webhook
              </Text>
              <Text style={styles.instructionStep}>4. Данные будут поступать автоматически</Text>
            </View>
          </Card>

          {/* Health Connect */}
          <Card style={[styles.sourceCard, { marginTop: spacing.sm }]}>
            <View style={styles.sourceHeader}>
              <Text style={styles.sourceIcon}>🏥</Text>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceName}>Health Connect</Text>
                <Text style={styles.sourceDesc}>
                  Агрегирует данные со всех Android устройств
                </Text>
              </View>
            </View>
            <Text style={styles.sourceNote}>
              Поддерживает Samsung, Garmin, Fitbit и другие устройства
              синхронизированные с Android.
            </Text>
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => navigation.navigate("HealthConnect")}
            >
              <Text style={styles.linkText}>Настроить Health Connect →</Text>
            </TouchableOpacity>
          </Card>

          {/* CSV */}
          <Card style={[styles.sourceCard, { marginTop: spacing.sm }]}>
            <View style={styles.sourceHeader}>
              <Text style={styles.sourceIcon}>📄</Text>
              <View style={styles.sourceInfo}>
                <Text style={styles.sourceName}>Загрузка CSV</Text>
                <Text style={styles.sourceDesc}>
                  Экспорт из Zepp / Mi Fitness
                </Text>
              </View>
            </View>
            <Button
              title="Выбрать CSV файл"
              onPress={handleCSV}
              loading={csvLoading}
              variant="outline"
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        </Section>

        {/* ── Демо-данные ──────────────────────────────── */}
        <Section title="🎮 Демонстрация">
          <Card>
            <Text style={styles.demoText}>
              Загрузи 30 дней симулированных данных сна с намеренно
              вшитыми аномалиями. Идеально для демонстрации работы алгоритма.
            </Text>
            <Button
              title="Загрузить демо-данные"
              onPress={handleSimulate}
              loading={simLoading}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </Section>

        {/* ── О приложении ─────────────────────────────── */}
        <Section title="ℹ️ О приложении">
          <Card>
            {[
              ["Версия", "1.0.0"],
              ["Backend", "FastAPI + Python"],
              ["Анализ", "Isolation Forest (scikit-learn)"],
              ["Устройства", "Gadgetbridge / Health Connect"],
            ].map(([key, val]) => (
              <View key={key} style={styles.aboutRow}>
                <Text style={styles.aboutKey}>{key}</Text>
                <Text style={styles.aboutVal}>{val}</Text>
              </View>
            ))}
          </Card>
        </Section>

        {/* ── Дисклеймер ───────────────────────────────── */}
        <Card style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>⚠️ Важное уведомление</Text>
          <Text style={styles.disclaimerText}>
            Данные носят информационный характер и не являются медицинским
            диагнозом. При подозрении на нарушения сна обратитесь к
            врачу-сомнологу.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    padding: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
  },

  sourceCard: {},
  sourceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sourceIcon: {
    fontSize: 28,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceName: {
    fontSize: typography.sizes.md,
    fontWeight: "700",
    color: colors.text.primary,
  },
  sourceDesc: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.accent.primary + "22",
    borderWidth: 1,
    borderColor: colors.accent.primary + "44",
  },
  statusText: {
    fontSize: typography.sizes.xs,
    color: colors.accent.primary,
    fontWeight: "600",
  },

  instructionBox: {
    marginTop: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  instructionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  instructionStep: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  code: {
    fontFamily: "Courier New",
    color: colors.accent.teal,
    fontSize: 11,
  },

  sourceNote: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  linkBtn: {
    marginTop: spacing.sm,
  },
  linkText: {
    color: colors.accent.primary,
    fontSize: typography.sizes.sm,
    fontWeight: "600",
  },

  demoText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },

  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  aboutKey: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  aboutVal: {
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
    fontWeight: "600",
  },

  disclaimerCard: {
    backgroundColor: colors.severity.medium + "15",
    borderColor: colors.severity.medium + "33",
    marginBottom: spacing.lg,
  },
  disclaimerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: "700",
    color: colors.severity.medium,
    marginBottom: spacing.sm,
  },
  disclaimerText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});
