// src/screens/DashboardScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity, StatusBar
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

import { getSleepSummary, getSleepRecords, runAnalysis } from "../api/client";
import { colors, spacing, typography, radius } from "../theme";
import {
  Card, ScoreCircle, MetricTile,
  PhaseBar, SeverityBadge, Section, Button
} from "../components/ui";


export default function DashboardScreen({ navigation }) {
  const [summary, setSummary]     = useState(null);
  const [records, setRecords]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

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
              <ScoreCircle score={last?.sleep_score} size={110} />
              <View style={styles.scoreStats}>
                <MetricTile
                  label="Продолжительность"
                  value={formatDuration(last?.duration_minutes)}
                  icon="⏱"
                />
                <View style={{ height: spacing.sm }} />
                <MetricTile
                  label="Пробуждений"
                  value={last?.awakenings_count ?? "—"}
                  icon="👁"
                />
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

        {/* ── Статистика за 30 дней ────────────────────── */}
        <Section title="За 30 дней">
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>
                {summary?.avg_sleep_score?.toFixed(0) ?? "—"}
              </Text>
              <Text style={styles.statLabel}>Средний Score</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>
                {summary?.avg_duration_minutes
                  ? `${(summary.avg_duration_minutes / 60).toFixed(1)}ч`
                  : "—"}
              </Text>
              <Text style={styles.statLabel}>Средний сон</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.severity.medium }]}>
                {summary?.anomalies_last_30_days ?? "—"}
              </Text>
              <Text style={styles.statLabel}>Аномалий</Text>
            </Card>
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
                  const score = r.sleep_score;
                  const barColor = score >= 70
                    ? colors.accent.primary
                    : score >= 55
                    ? colors.severity.medium
                    : colors.severity.high;

                  return (
                    <TouchableOpacity
                      key={r.id ?? i}
                      style={styles.barColumn}
                      onPress={() => navigation.navigate("NightDetail", { record: r })}
                    >
                      <Text style={styles.barScore}>{score ?? ""}</Text>
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

  // Score карточка
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

  // Статистика
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
    color: colors.accent.primary,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: 4,
    textAlign: "center",
  },

  // Мини-график
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
    color: colors.text.secondary,
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
