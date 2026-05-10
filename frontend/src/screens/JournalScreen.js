// src/screens/JournalScreen.js
import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Switch, TextInput, Alert
} from "react-native";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { saveContext } from "../api/client";
import { colors, spacing, typography, radius } from "../theme";
import { Card, Button, Section } from "../components/ui";


const STRESS_LABELS = ["", "Минимальный", "Низкий", "Средний", "Высокий", "Критический"];
const STRESS_COLORS = ["", colors.severity.low, colors.severity.low, colors.severity.medium, colors.severity.high, colors.severity.high];


export default function JournalScreen() {
  const today = new Date();

  const [form, setForm] = useState({
    caffeine_after_15: false,
    alcohol:           false,
    stress_level:      1,
    physical_activity: false,
    screen_before_bed: false,
    late_meal:         false,
    notes:             "",
  });
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setForm(f => ({ ...f, [key]: !f[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveContext({
        ...form,
        date: format(today, "yyyy-MM-dd"),
      });
      Alert.alert("Сохранено ✓", "Запись дневника сохранена. Данные будут учтены при следующем анализе.");
    } catch (e) {
      Alert.alert("Ошибка", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Заголовок ────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.title}>Вечерний дневник</Text>
          <Text style={styles.subtitle}>
            {format(today, "d MMMM yyyy", { locale: ru })}
          </Text>
          <Text style={styles.hint}>
            Заполни перед сном — это помогает находить причины аномалий
          </Text>
        </View>

        {/* ── Переключатели ────────────────────────────── */}
        <Section title="Что было сегодня?">
          <Card>
            {[
              { key: "caffeine_after_15", label: "Кофеин после 15:00",     emoji: "☕" },
              { key: "alcohol",           label: "Алкоголь",               emoji: "🍷" },
              { key: "physical_activity", label: "Физическая активность",  emoji: "🏃" },
              { key: "screen_before_bed", label: "Экран перед сном",       emoji: "📱" },
              { key: "late_meal",         label: "Поздний ужин (после 21)", emoji: "🍽" },
            ].map(({ key, label, emoji }, i, arr) => (
              <View key={key}>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleEmoji}>{emoji}</Text>
                  <Text style={styles.toggleLabel}>{label}</Text>
                  <Switch
                    value={form[key]}
                    onValueChange={() => toggle(key)}
                    trackColor={{
                      false: colors.bg.elevated,
                      true: colors.accent.primary + "88"
                    }}
                    thumbColor={form[key] ? colors.accent.primary : colors.text.muted}
                  />
                </View>
                {i < arr.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </Card>
        </Section>

        {/* ── Уровень стресса ──────────────────────────── */}
        <Section title="Уровень стресса">
          <Card>
            <Text style={styles.stressLabel}>
              {STRESS_LABELS[form.stress_level]}
            </Text>
            <View style={styles.stressButtons}>
              {[1, 2, 3, 4, 5].map(level => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.stressBtn,
                    form.stress_level === level && {
                      backgroundColor: STRESS_COLORS[level],
                      borderColor: STRESS_COLORS[level],
                    }
                  ]}
                  onPress={() => setForm(f => ({ ...f, stress_level: level }))}
                >
                  <Text style={[
                    styles.stressBtnText,
                    form.stress_level === level && { color: colors.bg.primary }
                  ]}>
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.stressHint}>1 — нет стресса, 5 — очень высокий</Text>
          </Card>
        </Section>

        {/* ── Заметки ──────────────────────────────────── */}
        <Section title="Заметки (необязательно)">
          <Card>
            <TextInput
              style={styles.notesInput}
              multiline
              numberOfLines={4}
              placeholder="Что-то особенное сегодня? Болезнь, стресс, поздняя работа..."
              placeholderTextColor={colors.text.muted}
              value={form.notes}
              onChangeText={t => setForm(f => ({ ...f, notes: t }))}
              textAlignVertical="top"
            />
          </Card>
        </Section>

        {/* ── Как это работает ─────────────────────────── */}
        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Как это работает</Text>
          <Text style={styles.infoText}>
            Приложение сопоставляет твои записи с данными сна и находит
            персональные корреляции. Например: "после кофе ваш Sleep Score
            ниже на 12 пунктов".{"\n\n"}
            Для точного анализа нужно минимум 5 записей.
          </Text>
        </Card>

        <Button
          title="Сохранить запись"
          onPress={handleSave}
          loading={saving}
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
    color: colors.accent.primary,
    marginTop: 2,
    fontWeight: "600",
  },
  hint: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  toggleEmoji: {
    fontSize: 20,
  },
  toggleLabel: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },

  stressLabel: {
    fontSize: typography.sizes.lg,
    fontWeight: "700",
    color: STRESS_COLORS[3],
    marginBottom: spacing.md,
    textAlign: "center",
  },
  stressButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
  },
  stressBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  stressBtnText: {
    fontSize: typography.sizes.lg,
    fontWeight: "700",
    color: colors.text.secondary,
  },
  stressHint: {
    fontSize: typography.sizes.xs,
    color: colors.text.muted,
    textAlign: "center",
    marginTop: spacing.sm,
  },

  notesInput: {
    color: colors.text.primary,
    fontSize: typography.sizes.md,
    lineHeight: 22,
    minHeight: 100,
  },

  infoCard: {
    backgroundColor: colors.accent.primary + "15",
    borderColor: colors.accent.primary + "33",
    marginBottom: spacing.lg,
  },
  infoTitle: {
    fontSize: typography.sizes.md,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});
