// src/screens/DashboardScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity, StatusBar, Modal, Pressable
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import Svg, { Circle } from "react-native-svg";

import { getSleepSummary, getSleepRecords, runAnalysis } from "../api/client";
import { colors, spacing, typography, radius } from "../theme";
import {
  Card, MetricTile,
  PhaseBar, SeverityBadge, Section, Button
} from "../components/ui";


// ─────────────────────────────────────────
//  ЦВЕТОВАЯ ЛОГИКА
// ─────────────────────────────────────────

const COLOR_GOOD = "#22C55E";   // зелёный
const COLOR_WARN = "#EAB308";   // жёлтый
const COLOR_BAD  = "#EF4444";   // красный

function scoreColor(score) {
  if (score == null) return colors.text.muted;
  if (score >= 70) return COLOR_GOOD;
  if (score >= 55) return COLOR_WARN;
  return COLOR_BAD;
}

function scoreLabel(score) {
  if (score == null) return "—";
  if (score >= 85) return "ОТЛИЧНО";
  if (score >= 70) return "ХОРОШИЙ";
  if (score >= 55) return "СРЕДНИЙ";
  return "ПЛОХОЙ";
}

function hoursColor(hours) {
  if (hours == null) return colors.text.muted;
  if (hours >= 7 && hours <= 9) return COLOR_GOOD;
  if ((hours >= 6 && hours < 7) || (hours > 9 && hours <= 10)) return COLOR_WARN;
  return COLOR_BAD;
}

function anomaliesColor(count) {
  if (count == null) return colors.text.muted;
  if (count === 0) return COLOR_GOOD;
  if (count <= 5)  return COLOR_WARN;
  return COLOR_BAD;
}


// ─────────────────────────────────────────
//  SLEEP SCORE PROGRESS RING (SVG)
// ─────────────────────────────────────────

function SleepScoreRing({ score, size = 130, stroke = 10 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalized = score != null ? Math.max(0, Math.min(100, score)) : 0;
  const offset = circumference - (normalized / 100) * circumference;
  const color = scoreColor(score);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        {/* Фон-кольцо (всегда полное, тусклое) */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.bg.elevated}
          strokeWidth={stroke}
          fill="none"
        />
        {/* Прогресс-кольцо */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={ringStyles.inner}>
          <Text style={[ringStyles.score, { color }]}>
            {score != null ? Math.round(score) : "—"}
          </Text>
          <Text style={ringStyles.label}>{scoreLabel(score)}</Text>
        </View>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  score: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
  },
  label: {
    fontSize: 9,
    color: colors.text.secondary,
    letterSpacing: 1.2,
    marginTop: -2,
    fontWeight: "700",
  },
});


// ─────────────────────────────────────────
//  AWAKENINGS MODAL
// ─────────────────────────────────────────

function AwakeningsModal({ visible, onClose, record }) {
  let awakenings = [];
  if (record?.awakenings_json) {
    try {
      const parsed = JSON.parse(record.awakenings_json);
      if (Array.isArray(parsed)) awakenings = parsed;
    } catch {}
  }

  const fullCount = awakenings.filter(a => a.type === "full").length;
  const microCount = awakenings.filter(a => a.type === "micro").length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={modalStyles.backdrop} onPress={onClose}>
        <Pressable style={modalStyles.card} onPress={(e) => e.stopPropagation()}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Пробуждения</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={modalStyles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Сводка */}
          <View style={modalStyles.summary}>
            <View style={modalStyles.summaryItem}>
              <Text style={[modalStyles.summaryNum, { color: COLOR_BAD }]}>{fullCount}</Text>
              <Text style={modalStyles.summaryLabel}>полных</Text>
            </View>
            <View style={modalStyles.summaryItem}>
              <Text style={[modalStyles.summaryNum, { color: COLOR_WARN }]}>{microCount}</Text>
              <Text style={modalStyles.summaryLabel}>микро</Text>
            </View>
            <View style={modalStyles.summaryItem}>
              <Text style={[modalStyles.summaryNum, { color: colors.accent.primary }]}>
                {awakenings.reduce((s, a) => s + (a.duration_min || 0), 0)}м
              </Text>
              <Text style={modalStyles.summaryLabel}>всего</Text>
            </View>
          </View>

          {/* Список */}
          <ScrollView style={{ maxHeight: 320 }}>
            {awakenings.length === 0 ? (
              <Text style={modalStyles.empty}>Нет данных о времени пробуждений</Text>
            ) : (
              awakenings.map((a, i) => {
                let timeStr = "—";
                try {
                  timeStr = format(new Date(a.time), "HH:mm");
                } catch {}
                const isLong = a.type === "full";
                return (
                  <View key={i} style={modalStyles.row}>
                    <View style={[modalStyles.dot, { backgroundColor: isLong ? COLOR_BAD : COLOR_WARN }]} />
                    <Text style={modalStyles.time}>{timeStr}</Text>
                    <Text style={modalStyles.duration}>{a.duration_min} мин</Text>
                    <Text style={modalStyles.typeLabel}>{isLong ? "полное" : "микро"}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: "800",
    color: colors.text.primary,
  },
  close: {
    fontSize: 24,
    color: colors.text.secondary,
    padding: 4,
  },
  summary: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: spacing.sm,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.sm,
    marginBottom: spacing.md,
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryNum: {
    fontSize: typography.sizes.xl,
    fontWeight: "800",
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.bg.elevated,
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  time: {
    fontSize: typography.sizes.md,
    fontWeight: "700",
    color: colors.text.primary,
    width: 60,
  },
  duration: {
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
    flex: 1,
  },
  typeLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    textTransform: "uppercase",
  },
  empty: {
    color: colors.text.muted,
    textAlign: "center",
    padding: spacing.lg,
  },
});


// ─────────────────────────────────────────
//  ОСНОВНОЙ ЭКРАН
// ─────────────────────────────────────────

export default function DashboardScreen({ navigation }) {
  const [summary, setSummary]     = useState(null);
  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [awakeModalOpen, setAwakeModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const [sum, recs] = await Promise.all([
        getSleepSummary(),
        getSleepRecords(7),
      ]);
      setSummary(sum);
      setRecords(recs);
    } catch (e) {
      console.error("Ошибка загрузки:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await runAnalysis();
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzing(false);
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return "—";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}ч ${m}м`;
  };

  const last = summary?.last_night;
  const avgScore = summary?.avg_sleep_score;
  const avgHours = summary?.avg_duration_minutes ? summary.avg_duration_minutes / 60 : null;
  const anomCount = summary?.anomalies_last_30_days;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={colors.accent.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Шапка ────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Доброе утро 🌙</Text>
            <Text style={styles.dateText}>
              {format(new Date(), "d MMMM yyyy", { locale: ru })}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => navigation.navigate("Settings")}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* ── Sleep Score прошлой ночи ─────────────────── */}
        <Section title="Прошлая ночь">
          <Card style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <SleepScoreRing score={last?.sleep_score} size={130} stroke={10} />
              <View style={styles.scoreStats}>
                <MetricTile
                  label="Продолжительность"
                  value={formatDuration(last?.duration_minutes)}
                  icon="⏱"
                />
                <View style={{ height: spacing.sm }} />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => last && setAwakeModalOpen(true)}
                >
                  <MetricTile
                    label="Пробуждений ›"
                    value={last?.awakenings_count ?? "—"}
                    icon="👁"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Пульс и SpO2 */}
            <View style={styles.vitalsRow}>
              <MetricTile
                label="Пульс"
                value={last?.heart_rate_avg?.toFixed(0)}
                unit="уд/мин"
                color={colors.severity.low}
                icon="❤️"
              />
              <View style={{ width: spacing.sm }} />
              <MetricTile
                label="SpO2"
                value={last?.spo2_avg?.toFixed(1)}
                unit="%"
                color={colors.accent.teal}
                icon="💧"
              />
            </View>

            {/* Фазы сна */}
            {last && (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.phasesTitle}>Фазы сна</Text>
                <PhaseBar
                  phases={{
                    deep:  last.phase_deep,
                    rem:   last.phase_rem,
                    light: last.phase_light,
                    awake: last.phase_awake,
                  }}
                  totalMinutes={last.duration_minutes}
                />
              </View>
            )}
          </Card>
        </Section>

        {/* ── Статистика за 30 дней (цветная) ──────────── */}
        <Section title="За 30 дней">
          <View style={styles.statsGrid}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate("ScoreStats")}
              style={{ flex: 1 }}
            >
              <Card style={styles.statCard}>
                <Text style={[styles.statValue, { color: scoreColor(avgScore) }]}>
                  {avgScore?.toFixed(0) ?? "—"}
                </Text>
                <Text style={styles.statLabel}>Средний Score</Text>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate("DurationStats")}
              style={{ flex: 1 }}
            >
              <Card style={styles.statCard}>
                <Text style={[styles.statValue, { color: hoursColor(avgHours) }]}>
                  {avgHours ? `${avgHours.toFixed(1)}ч` : "—"}
                </Text>
                <Text style={styles.statLabel}>Средний сон</Text>
              </Card>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate("Main", { screen: "Anomalies" })}
              style={{ flex: 1 }}
            >
              <Card style={styles.statCard}>
                <Text style={[styles.statValue, { color: anomaliesColor(anomCount) }]}>
                  {anomCount ?? "—"}
                </Text>
                <Text style={styles.statLabel}>Аномалий</Text>
              </Card>
            </TouchableOpacity>
          </View>
        </Section>

        {/* ── График последних 7 ночей ─────────────────── */}
        <Section
          title="Последние 7 ночей"
          action="Все →"
          onAction={() => navigation.navigate("History")}
        >
          <Card>
            {records.length === 0 ? (
              <Text style={styles.emptyText}>Нет данных</Text>
            ) : (
              <View style={styles.miniChart}>
                {records.slice(0, 7).reverse().map((r, i) => {
                  const hours = r.duration_minutes / 60;
                  const maxH = 9;
                  const heightPct = Math.min(hours / maxH, 1);
                  const barColor = scoreColor(r.sleep_score);

                  return (
                    <TouchableOpacity
                      key={r.id ?? i}
                      style={styles.barColumn}
                      onPress={() => navigation.navigate("NightDetail", { record: r })}
                    >
                      <Text style={[styles.barScore, { color: barColor }]}>
                        {r.sleep_score ?? ""}
                      </Text>
                      <View style={styles.barTrack}>
                        <View style={[
                          styles.bar,
                          { height: `${heightPct * 100}%`, backgroundColor: barColor }
                        ]} />
                      </View>
                      <Text style={styles.barDate}>
                        {format(parseISO(r.date), "dd.MM")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Card>
        </Section>

        {/* ── Кнопка анализа ───────────────────────────── */}
        <Button
          title="Запустить анализ"
          onPress={handleAnalyze}
          loading={analyzing}
          style={{ marginBottom: spacing.xl }}
        />
      </ScrollView>

      {/* Модалка пробуждений */}
      <AwakeningsModal
        visible={awakeModalOpen}
        onClose={() => setAwakeModalOpen(false)}
        record={last}
      />
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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.xl,
  },
  greeting: {
    fontSize: typography.sizes.xxl,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  dateText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  settingsBtn: {
    padding: spacing.sm,
  },
  settingsIcon: {
    fontSize: 22,
  },

  scoreCard: {
    gap: spacing.md,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  scoreStats: {
    flex: 1,
  },
  vitalsRow: {
    flexDirection: "row",
  },
  phasesTitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  statsGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  statValue: {
    fontSize: typography.sizes.xxl,
    fontWeight: "800",
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: "center",
  },

  miniChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    gap: spacing.xs,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  barScore: {
    fontSize: 9,
    fontWeight: "700",
    marginBottom: 2,
  },
  barTrack: {
    flex: 1,
    width: "70%",
    justifyContent: "flex-end",
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  bar: {
    width: "100%",
    borderRadius: radius.sm,
    minHeight: 4,
  },
  barDate: {
    fontSize: 9,
    color: colors.text.muted,
    marginTop: 4,
  },

  emptyText: {
    color: colors.text.muted,
    textAlign: "center",
    padding: spacing.lg,
  },
});
