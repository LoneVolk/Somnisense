// src/screens/ScoreStatsScreen.js
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { format, parseISO } from "date-fns";

import { getSleepRecords, withCache } from "../api/client";
import { colors, spacing, typography, radius } from "../theme";
import { Card, Section } from "../components/ui";


export default function ScoreStatsScreen({ navigation }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const { cached, fresh } = withCache("records:30", () => getSleepRecords(30));

    const cachedData = await cached;
    if (cachedData) {
      setRecords(cachedData);
      setLoading(false);
    }
    try {
      const freshData = await fresh;
      setRecords(freshData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  // Статистика
  const scores = records.map(r => r.sleep_score).filter(s => s != null);
  const min = scores.length ? Math.min(...scores) : 0;
  const max = scores.length ? Math.max(...scores) : 0;
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  // Распределение
  const excellent = scores.filter(s => s >= 85).length;
  const good      = scores.filter(s => s >= 70 && s < 85).length;
  const fair      = scores.filter(s => s >= 55 && s < 70).length;
  const poor      = scores.filter(s => s < 55).length;
  const total = scores.length || 1;

  const sortedRecords = [...records].reverse();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={colors.accent.primary}
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Sleep Score</Text>
          <Text style={styles.subtitle}>За 30 дней</Text>
        </View>

        {/* Главная цифра — средний score */}
        <Card style={styles.heroCard}>
          <Text style={styles.heroLabel}>Средний</Text>
          <Text style={[styles.heroValue, { color: scoreColor(avg) }]}>{avg}</Text>
          <Text style={styles.heroSubtext}>{scoreLabel(avg)}</Text>
        </Card>

        {/* Min / Max */}
        <View style={styles.minMaxRow}>
          <Card style={styles.minMaxCard}>
            <Text style={styles.minMaxLabel}>↓ Минимум</Text>
            <Text style={[styles.minMaxValue, { color: colors.severity.high }]}>{min}</Text>
          </Card>
          <Card style={styles.minMaxCard}>
            <Text style={styles.minMaxLabel}>↑ Максимум</Text>
            <Text style={[styles.minMaxValue, { color: colors.score.excellent }]}>{max}</Text>
          </Card>
        </View>

        {/* Распределение */}
        <Section title="Распределение">
          <Card>
            <DistributionRow label="Отлично (85+)" count={excellent} total={total} color={colors.score.excellent} />
            <DistributionRow label="Хорошо (70-84)" count={good} total={total} color={colors.score.good} />
            <DistributionRow label="Удовл. (55-69)" count={fair} total={total} color={colors.score.fair} />
            <DistributionRow label="Плохо (<55)" count={poor} total={total} color={colors.score.poor} />
          </Card>
        </Section>

        {/* График */}
        <Section title="График">
          <Card>
            {sortedRecords.length === 0 ? (
              <Text style={styles.emptyText}>{loading ? "Загрузка..." : "Нет данных"}</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chart}>
                  {sortedRecords.map((r, i) => {
                    const score = r.sleep_score ?? 0;
                    const heightPct = score / 100;
                    return (
                      <TouchableOpacity
                        key={r.id ?? i}
                        style={styles.barColumn}
                        onPress={() => navigation.navigate("NightDetail", { record: r })}
                      >
                        <Text style={styles.barScore}>{score || ""}</Text>
                        <View style={styles.barTrack}>
                          <View style={[
                            styles.bar,
                            { height: `${heightPct * 100}%`, backgroundColor: scoreColor(score) }
                          ]} />
                        </View>
                        <Text style={styles.barDate}>
                          {format(parseISO(r.date), "dd.MM")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </Card>
        </Section>
      </ScrollView>
    </View>
  );
}


function DistributionRow({ label, count, total, color }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={styles.distRow}>
      <Text style={styles.distLabel}>{label}</Text>
      <View style={styles.distBarWrap}>
        <View style={[styles.distBar, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.distCount}>{count}</Text>
    </View>
  );
}

function scoreColor(s) {
  if (s >= 85) return colors.score.excellent;
  if (s >= 70) return colors.score.good;
  if (s >= 55) return colors.score.fair;
  return colors.score.poor;
}

function scoreLabel(s) {
  if (s >= 85) return "ОТЛИЧНО";
  if (s >= 70) return "ХОРОШО";
  if (s >= 55) return "УДОВЛЕТВОРИТЕЛЬНО";
  return "ПЛОХО";
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing.md, paddingTop: spacing.lg },

  header: { marginBottom: spacing.md },
  backBtn: { color: colors.accent.primary, fontSize: typography.sizes.md, marginBottom: spacing.sm },
  title: { fontSize: typography.sizes.xxl, fontWeight: "800", color: colors.text.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2 },

  heroCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  heroLabel: { fontSize: typography.sizes.sm, color: colors.text.secondary },
  heroValue: { fontSize: 72, fontWeight: "900", letterSpacing: -2, marginVertical: spacing.xs },
  heroSubtext: { fontSize: typography.sizes.sm, fontWeight: "700", color: colors.text.secondary, letterSpacing: 1 },

  minMaxRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  minMaxCard: { flex: 1, alignItems: "center", paddingVertical: spacing.md },
  minMaxLabel: { fontSize: typography.sizes.xs, color: colors.text.secondary, marginBottom: spacing.xs },
  minMaxValue: { fontSize: typography.sizes.xxl, fontWeight: "800" },

  distRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.xs, gap: spacing.sm },
  distLabel: { width: 130, fontSize: typography.sizes.xs, color: colors.text.secondary },
  distBarWrap: { flex: 1, height: 8, backgroundColor: colors.bg.elevated, borderRadius: 4, overflow: "hidden" },
  distBar: { height: "100%", borderRadius: 4 },
  distCount: { width: 24, textAlign: "right", color: colors.text.primary, fontWeight: "700" },

  chart: { flexDirection: "row", alignItems: "flex-end", height: 180, gap: spacing.xs, paddingVertical: spacing.sm },
  barColumn: { width: 32, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  barScore: { fontSize: 10, color: colors.text.secondary, marginBottom: 2 },
  barTrack: { flex: 1, width: "70%", justifyContent: "flex-end", backgroundColor: colors.bg.elevated, borderRadius: radius.sm, overflow: "hidden" },
  bar: { width: "100%", borderRadius: radius.sm, minHeight: 4 },
  barDate: { fontSize: 9, color: colors.text.muted, marginTop: 4 },

  emptyText: { color: colors.text.secondary, textAlign: "center", padding: spacing.lg },
});
