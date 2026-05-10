// src/screens/AnomaliesScreen.js
import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";

import { getAnomalies } from "../api/client";
import { colors, spacing, typography, radius } from "../theme";
import { Card, SeverityBadge, Section } from "../components/ui";


const ANOMALY_ICONS = {
  short_sleep:               "😴",
  long_sleep:                "🛏",
  low_deep_sleep:            "🔵",
  low_rem_sleep:             "🟣",
  frequent_awakenings:       "👁",
  high_heart_rate:           "❤️",
  low_spo2:                  "💧",
  social_jetlag:             "✈️",
  irregular_schedule:        "📅",
  chronic_sleep_deprivation: "⚠️",
  ml_complex_anomaly:        "🤖",
};


export default function AnomaliesScreen() {
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState("all"); // all | high | medium | low

  const loadData = async () => {
    try {
      const data = await getAnomalies(30);
      setAnomalies(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const filtered = filter === "all"
    ? anomalies
    : anomalies.filter(a => a.severity === filter);

  const counts = {
    high:   anomalies.filter(a => a.severity === "high").length,
    medium: anomalies.filter(a => a.severity === "medium").length,
    low:    anomalies.filter(a => a.severity === "low").length,
  };

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
        showsVerticalScrollIndicator={false}
      >
        {/* ── Заголовок ────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>Аномалии сна</Text>
          <Text style={styles.subtitle}>За последние 30 дней</Text>
        </View>

        {/* ── Сводка по severity ───────────────────────── */}
        <View style={styles.countsRow}>
          {[
            { key: "high",   label: "Высокие",  color: colors.severity.high   },
            { key: "medium", label: "Средние",  color: colors.severity.medium },
            { key: "low",    label: "Низкие",   color: colors.severity.low    },
          ].map(({ key, label, color }) => (
            <Card key={key} style={styles.countCard}>
              <Text style={[styles.countNumber, { color }]}>{counts[key]}</Text>
              <Text style={styles.countLabel}>{label}</Text>
            </Card>
          ))}
        </View>

        {/* ── Фильтр ───────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={{ gap: spacing.sm }}
        >
          {[
            { key: "all",    label: "Все" },
            { key: "high",   label: "🔴 Высокие" },
            { key: "medium", label: "🟡 Средние" },
            { key: "low",    label: "🟢 Низкие" },
          ].map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, filter === key && styles.filterChipActive]}
              onPress={() => setFilter(key)}
            >
              <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Список аномалий ──────────────────────────── */}
        <Section title={`Найдено: ${filtered.length}`}>
          {filtered.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>
                {filter === "all"
                  ? "🎉 Аномалий не найдено!\nЗапустите анализ на главном экране."
                  : "Аномалий этого уровня не найдено"}
              </Text>
            </Card>
          ) : (
            filtered.map((anomaly, i) => (
              <AnomalyCard key={i} anomaly={anomaly} />
            ))
          )}
        </Section>
      </ScrollView>
    </View>
  );
}


function AnomalyCard({ anomaly }) {
  const [expanded, setExpanded] = useState(false);
  const icon = ANOMALY_ICONS[anomaly.anomaly_type] ?? "⚡";

  return (
    <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.85}>
      <Card style={styles.anomalyCard}>
        <View style={styles.anomalyHeader}>
          <Text style={styles.anomalyIcon}>{icon}</Text>
          <View style={styles.anomalyInfo}>
            <Text style={styles.anomalyTitle}>{anomaly.title}</Text>
            <Text style={styles.anomalyDate}>
              {format(parseISO(anomaly.date), "d MMMM", { locale: ru })}
              {anomaly.is_ml_detected ? "  🤖 ML" : ""}
            </Text>
          </View>
          <SeverityBadge severity={anomaly.severity} />
        </View>

        {expanded && (
          <View style={styles.anomalyExpanded}>
            <Text style={styles.anomalyDescription}>{anomaly.description}</Text>
            {anomaly.value != null && (
              <View style={styles.anomalyValues}>
                <Text style={styles.anomalyValueText}>
                  Значение: <Text style={styles.anomalyValueBold}>
                    {anomaly.value}
                  </Text>
                </Text>
                {anomaly.threshold && (
                  <Text style={styles.anomalyValueText}>
                    Норма: <Text style={styles.anomalyValueBold}>
                      {anomaly.threshold}
                    </Text>
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        <Text style={styles.expandHint}>
          {expanded ? "▲ Свернуть" : "▼ Подробнее"}
        </Text>
      </Card>
    </TouchableOpacity>
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

  countsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  countCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  countNumber: {
    fontSize: typography.sizes.xxl,
    fontWeight: "800",
    letterSpacing: -1,
  },
  countLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },

  filterRow: {
    marginBottom: spacing.lg,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg.card,
  },
  filterChipActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.primary,
  },
  filterText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    fontWeight: "600",
  },
  filterTextActive: {
    color: colors.text.inverse,
  },

  anomalyCard: {
    marginBottom: spacing.sm,
  },
  anomalyHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  anomalyIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  anomalyInfo: {
    flex: 1,
  },
  anomalyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: "700",
    color: colors.text.primary,
    lineHeight: 20,
  },
  anomalyDate: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  anomalyExpanded: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  anomalyDescription: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  anomalyValues: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  anomalyValueText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  anomalyValueBold: {
    color: colors.text.primary,
    fontWeight: "700",
  },
  expandHint: {
    fontSize: typography.sizes.xs,
    color: colors.text.muted,
    textAlign: "center",
    marginTop: spacing.sm,
  },

  emptyText: {
    color: colors.text.secondary,
    textAlign: "center",
    padding: spacing.lg,
    lineHeight: 22,
  },
});
