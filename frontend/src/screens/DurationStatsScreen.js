// src/screens/DurationStatsScreen.js
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


export default function DurationStatsScreen({ navigation }) {
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

  // Часы сна
  const hours = records.map(r => r.duration_minutes / 60).filter(h => h > 0);
  const min = hours.length ? Math.min(...hours) : 0;
  const max = hours.length ? Math.max(...hours) : 0;
  const avg = hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;

  // Распределение
  const tooShort = hours.filter(h => h < 6).length;
  const short    = hours.filter(h => h >= 6 && h < 7).length;
  const optimal  = hours.filter(h => h >= 7 && h <= 9).length;
  const long     = hours.filter(h => h > 9).length;
  const total = hours.length || 1;

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
          <Text style={styles.title}>Длительность сна</Text>
          <Text style={styles.subtitle}>За 30 дней</Text>
        </View>

        {/* Среднее */}
        <Card style={styles.heroCard}>
          <Text style={styles.heroLabel}>Средний сон</Text>
          <Text style={[styles.heroValue, { color: hoursColor(avg) }]}>
            {avg.toFixed(1)}<Text style={styles.heroUnit}>ч</Text>
          </Text>
          <Text style={styles.heroSubtext}>{hoursLabel(avg)}</Text>
        </Card>

        {/* Min / Max */}
        <View style={styles.minMaxRow}>
          <Card style={styles.minMaxCard}>
            <Text style={styles.minMaxLabel}>↓ Минимум</Text>
            <Text style={[styles.minMaxValue, { color: colors.severity.high }]}>
              {min.toFixed(1)}<Text style={styles.minMaxUnit}>ч</Text>
            </Text>
          </Card>
          <Card style={styles.minMaxCard}>
            <Text style={styles.minMaxLabel}>↑ Максимум</Text>
            <Text style={[styles.minMaxValue, { color: colors.score.excellent }]}>
              {max.toFixed(1)}<Text style={styles.minMaxUnit}>ч</Text>
            </Text>
          </Card>
        </View>

        {/* Распределение */}
        <Section title="Распределение">
          <Card>
            <DistributionRow label="< 6ч (мало)" count={tooShort} total={total} color={colors.severity.high} />
            <DistributionRow label="6-7ч (недосып)" count={short} total={total} color={colors.severity.medium} />
            <DistributionRow label="7-9ч (норма)" count={optimal} total={total} color={colors.score.excellent} />
            <DistributionRow label="> 9ч (много)" count={long} total={total} color={colors.severity.low} />
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
                    const h = r.duration_minutes / 60;
                    const heightPct = Math.min(h / 12, 1); // макс 12ч на шкале
                    return (
                      <TouchableOpacity
                        key={r.id ?? i}
                        style={styles.barColumn}
                        onPress={() => navigation.navigate("NightDetail", { record: r })}
                      >
                        <Text style={styles.barScore}>{h.toFixed(1)}</Text>
                        <View style={styles.barTrack}>
                          <View style={[
                            styles.bar,
                            { height: `${heightPct * 100}%`, backgroundColor: hoursColor(h) }
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

function hoursColor(h) {
  if (h >= 7 && h <= 9) return colors.score.excellent;
  if (h >= 6 && h < 7)  return colors.severity.medium;
  if (h > 9)            return colors.severity.low;
  return colors.severity.high;
}

function hoursLabel(h) {
  if (h >= 7 && h <= 9) return "ОПТИМАЛЬНО";
  if (h >= 6 && h < 7)  return "НЕДОСЫП";
  if (h > 9)            return "СЛИШКОМ ДОЛГО";
  return "КРИТИЧНО МАЛО";
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing.md, paddingTop: spacing.lg },

  header: { marginBottom: spacing.md },
  backBtn: { color: colors.accent.primary, fontSize: typography.sizes.md, marginBottom: spacing.sm },
  title: { fontSize: typography.sizes.xxl, fontWeight: "800", color: colors.text.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2 },

  heroCard: { alignItems: "center", paddingVertical: spacing.xl, marginBottom: spacing.md },
  heroLabel: { fontSize: typography.sizes.sm, color: colors.text.secondary },
  heroValue: { fontSize: 72, fontWeight: "900", letterSpacing: -2, marginVertical: spacing.xs },
  heroUnit: { fontSize: 32, fontWeight: "700" },
  heroSubtext: { fontSize: typography.sizes.sm, fontWeight: "700", color: colors.text.secondary, letterSpacing: 1 },

  minMaxRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  minMaxCard: { flex: 1, alignItems: "center", paddingVertical: spacing.md },
  minMaxLabel: { fontSize: typography.sizes.xs, color: colors.text.secondary, marginBottom: spacing.xs },
  minMaxValue: { fontSize: typography.sizes.xxl, fontWeight: "800" },
  minMaxUnit: { fontSize: typography.sizes.md, fontWeight: "700" },

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
