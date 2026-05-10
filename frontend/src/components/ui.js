// src/components/ui.js
// Переиспользуемые UI компоненты с единой стилистикой

import React from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator
} from "react-native";
import { colors, typography, spacing, radius, shadows } from "../theme";


// ─────────────────────────────────────────
//  КАРТОЧКА
// ─────────────────────────────────────────

export const Card = ({ children, style, glow = false }) => (
  <View style={[styles.card, glow && shadows.glow, style]}>
    {children}
  </View>
);


// ─────────────────────────────────────────
//  SLEEP SCORE КРУГ
// ─────────────────────────────────────────

export const ScoreCircle = ({ score, size = 120 }) => {
  const getColor = (s) => {
    if (s >= 85) return colors.score.excellent;
    if (s >= 70) return colors.score.good;
    if (s >= 55) return colors.score.fair;
    return colors.score.poor;
  };

  const getLabel = (s) => {
    if (s >= 85) return "Отличный";
    if (s >= 70) return "Хороший";
    if (s >= 55) return "Норм";
    return "Плохой";
  };

  const color = getColor(score ?? 0);

  return (
    <View style={[styles.scoreCircle, {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderColor: color,
      shadowColor: color,
    }]}>
      <Text style={[styles.scoreNumber, { color, fontSize: size * 0.35 }]}>
        {score ?? "—"}
      </Text>
      <Text style={[styles.scoreLabel, { color, fontSize: size * 0.12 }]}>
        {score != null ? getLabel(score) : "нет данных"}
      </Text>
    </View>
  );
};


// ─────────────────────────────────────────
//  МЕТРИКА (заголовок + значение + единица)
// ─────────────────────────────────────────

export const MetricTile = ({ label, value, unit, color, icon }) => (
  <View style={styles.metricTile}>
    <Text style={styles.metricLabel}>{icon} {label}</Text>
    <View style={styles.metricValueRow}>
      <Text style={[styles.metricValue, color && { color }]}>{value ?? "—"}</Text>
      {unit && <Text style={styles.metricUnit}>{unit}</Text>}
    </View>
  </View>
);


// ─────────────────────────────────────────
//  БЕЙДЖ АНОМАЛИИ
// ─────────────────────────────────────────

export const SeverityBadge = ({ severity }) => {
  const config = {
    low:    { color: colors.severity.low,    label: "Низкая",  emoji: "🟢" },
    medium: { color: colors.severity.medium, label: "Средняя", emoji: "🟡" },
    high:   { color: colors.severity.high,   label: "Высокая", emoji: "🔴" },
  };
  const cfg = config[severity] ?? config.low;

  return (
    <View style={[styles.badge, { borderColor: cfg.color, backgroundColor: cfg.color + "22" }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>
        {cfg.emoji} {cfg.label}
      </Text>
    </View>
  );
};


// ─────────────────────────────────────────
//  ПОЛОСКА ФАЗЫ СНА
// ─────────────────────────────────────────

export const PhaseBar = ({ phases, totalMinutes }) => {
  if (!totalMinutes) return null;

  const bars = [
    { key: "deep",  color: colors.phases.deep,  label: "Глубокий" },
    { key: "rem",   color: colors.phases.rem,   label: "REM" },
    { key: "light", color: colors.phases.light, label: "Лёгкий" },
    { key: "awake", color: colors.phases.awake, label: "Бодр." },
  ];

  return (
    <View>
      {/* Полоска */}
      <View style={styles.phaseBarContainer}>
        {bars.map(({ key, color }) => {
          const pct = ((phases[key] ?? 0) / totalMinutes) * 100;
          if (pct < 1) return null;
          return (
            <View
              key={key}
              style={[styles.phaseSegment, { flex: pct, backgroundColor: color }]}
            />
          );
        })}
      </View>

      {/* Легенда */}
      <View style={styles.phaseLegend}>
        {bars.map(({ key, color, label }) => {
          const pct = ((phases[key] ?? 0) / totalMinutes) * 100;
          return (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendLabel}>{label}</Text>
              <Text style={[styles.legendValue, { color }]}>{pct.toFixed(0)}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};


// ─────────────────────────────────────────
//  КНОПКА
// ─────────────────────────────────────────

export const Button = ({ title, onPress, variant = "primary", loading = false, style }) => {
  const isPrimary = variant === "primary";
  return (
    <TouchableOpacity
      style={[styles.button, isPrimary ? styles.buttonPrimary : styles.buttonOutline, style]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={isPrimary ? colors.text.inverse : colors.accent.primary} />
        : <Text style={[styles.buttonText, !isPrimary && { color: colors.accent.primary }]}>
            {title}
          </Text>
      }
    </TouchableOpacity>
  );
};


// ─────────────────────────────────────────
//  РАЗДЕЛ С ЗАГОЛОВКОМ
// ─────────────────────────────────────────

export const Section = ({ title, children, action, onAction }) => (
  <View style={styles.section}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
    {children}
  </View>
);


// ─────────────────────────────────────────
//  СТИЛИ
// ─────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },

  scoreCircle: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  scoreNumber: {
    fontWeight: "800",
    letterSpacing: -1,
  },
  scoreLabel: {
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 2,
  },

  metricTile: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  metricValue: {
    fontSize: typography.sizes.xl,
    fontWeight: "700",
    color: colors.text.primary,
  },
  metricUnit: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginLeft: 2,
  },

  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: "600",
  },

  phaseBarContainer: {
    flexDirection: "row",
    height: 10,
    borderRadius: radius.full,
    overflow: "hidden",
    backgroundColor: colors.bg.elevated,
    gap: 1,
  },
  phaseSegment: {
    borderRadius: 2,
  },
  phaseLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  legendValue: {
    fontSize: typography.sizes.xs,
    fontWeight: "700",
  },

  button: {
    height: 52,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonPrimary: {
    backgroundColor: colors.accent.primary,
  },
  buttonOutline: {
    borderWidth: 1.5,
    borderColor: colors.accent.primary,
    backgroundColor: "transparent",
  },
  buttonText: {
    fontSize: typography.sizes.md,
    fontWeight: "700",
    color: colors.text.inverse,
    letterSpacing: 0.3,
  },

  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  sectionAction: {
    fontSize: typography.sizes.sm,
    color: colors.accent.primary,
    fontWeight: "600",
  },
});
