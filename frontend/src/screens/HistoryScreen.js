// src/screens/HistoryScreen.js
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, RefreshControl
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

import { getSleepRecords, withCache } from "../api/client";
import { colors, spacing, typography, radius } from "../theme";
import { Card, Section } from "../components/ui";


export default function HistoryScreen({ navigation }) {
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

  // Сортируем по дате (старые слева, новые справа)
  const sortedRecords = [...records].reverse();

  // Статистика
  const scores = records.map(r => r.sleep_score).filter(s => s != null);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const avgHours = records.length
    ? (records.reduce((s, r) => s + r.duration_minutes, 0) / records.length / 60).toFixed(1)
    : 0;

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
        {/* Заголовок */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.title}>История сна</Text>
          <Text style={styles.subtitle}>За 30 дней</Text>
        </View>

        {/* Статистика */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{avgScore}</Text>
            <Text style={styles.statLabel}>Средний Score</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{avgHours}ч</Text>
            <Text style={styles.statLabel}>Средний сон</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{records.length}</Text>
            <Text style={styles.statLabel}>Записей</Text>
          </Card>
        </View>

        {/* График баров — те же что на главной, но за месяц */}
        <Section title="График сна">
          <Card>
            {sortedRecords.length === 0 ? (
              <Text style={styles.emptyText}>
                {loading ? "Загрузка..." : "Нет данных за 30 дней"}
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chart}>
                  {sortedRecords.map((r, i) => {
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
              </ScrollView>
            )}
          </Card>
        </Section>

        {/* Список записей */}
        <Section title="Все записи">
          {sortedRecords.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>Нет записей</Text>
            </Card>
          ) : (
            [...records].map((r, i) => (
              <TouchableOpacity
                key={r.id ?? i}
                onPress={() => navigation.navigate("NightDetail", { record: r })}
              >
                <Card style={styles.recordCard}>
                  <View style={styles.recordRow}>
                    <View>
                      <Text style={styles.recordDate}>
                        {format(parseISO(r.date), "d MMMM, EEEE", { locale: ru })}
                      </Text>
                      <Text style={styles.recordSubtext}>
                        {(r.duration_minutes / 60).toFixed(1)}ч • {r.awakenings_count ?? 0} пробужд.
                      </Text>
                    </View>
                    <View style={styles.recordRight}>
                      <Text style={[
                        styles.recordScore,
                        { color: r.sleep_score >= 70 ? colors.accent.primary
                                 : r.sleep_score >= 55 ? colors.severity.medium
                                 : colors.severity.high }
                      ]}>
                        {r.sleep_score ?? "—"}
                      </Text>
                      <Text style={styles.recordChevron}>›</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </Section>
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
    marginBottom: spacing.lg,
  },
  backBtn: {
    color: colors.accent.primary,
    fontSize: typography.sizes.md,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },

  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  statNumber: {
    fontSize: typography.sizes.xxl,
    fontWeight: "800",
    color: colors.text.primary,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: 2,
    textAlign: "center",
  },

  // График — как на дашборде, но шире для горизонтального скролла
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 160,
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  barColumn: {
    width: 32,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  barScore: {
    fontSize: 10,
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

  // Список
  recordCard: {
    marginBottom: spacing.xs,
  },
  recordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recordDate: {
    fontSize: typography.sizes.md,
    fontWeight: "600",
    color: colors.text.primary,
  },
  recordSubtext: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  recordRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  recordScore: {
    fontSize: typography.sizes.xl,
    fontWeight: "800",
  },
  recordChevron: {
    fontSize: 24,
    color: colors.text.muted,
  },

  emptyText: {
    color: colors.text.secondary,
    textAlign: "center",
    padding: spacing.lg,
  },
});
