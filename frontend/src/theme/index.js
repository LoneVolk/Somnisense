// src/theme/index.js
// Тёмная тема с космической/ночной эстетикой — соответствует теме сна

export const colors = {
  // Фоны
  bg: {
    primary:   "#0A0E1A",   // Глубокий тёмно-синий
    secondary: "#111827",   // Чуть светлее
    card:      "#151D2E",   // Карточки
    elevated:  "#1C2539",   // Приподнятые элементы
  },

  // Акценты
  accent: {
    primary:  "#6C8EF5",    // Мягкий синий
    glow:     "#4F6FE8",    // Для свечений
    purple:   "#9B7FEA",    // Фиолетовый акцент
    teal:     "#4ECDC4",    // Бирюзовый
  },

  // Фазы сна — каждая своим цветом
  phases: {
    deep:   "#4F6FE8",      // Тёмно-синий — глубокий сон
    rem:    "#9B7FEA",      // Фиолетовый — REM
    light:  "#6C8EF5",      // Светло-синий — лёгкий сон
    awake:  "#F59E6C",      // Оранжевый — пробуждение
  },

  // Severity аномалий
  severity: {
    low:    "#4ECDC4",      // Бирюзовый
    medium: "#F5C46C",      // Жёлтый
    high:   "#F56C6C",      // Красный
  },

  // Sleep Score градиент
  score: {
    excellent: "#4ECDC4",   // 85-100
    good:      "#6C8EF5",   // 70-84
    fair:      "#F5C46C",   // 55-69
    poor:      "#F56C6C",   // 0-54
  },

  // Текст
  text: {
    primary:   "#E8EDF8",
    secondary: "#8899BB",
    muted:     "#4A5568",
    inverse:   "#0A0E1A",
  },

  // Утилиты
  border:  "#1E2A40",
  white:   "#FFFFFF",
};

export const typography = {
  // Заголовки — геометричный, чистый
  heading: {
    fontFamily: "System",
    fontWeight: "700",
    color: colors.text.primary,
  },

  // Тело — читаемый
  body: {
    fontFamily: "System",
    fontWeight: "400",
    color: colors.text.secondary,
  },

  // Цифры — моноширинный для метрик
  mono: {
    fontFamily: "Courier New",
    fontWeight: "600",
    color: colors.text.primary,
  },

  sizes: {
    xs:   11,
    sm:   13,
    md:   15,
    lg:   18,
    xl:   22,
    xxl:  28,
    hero: 48,
  }
};

export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const radius = {
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  full: 999,
};

export const shadows = {
  card: {
    shadowColor: colors.accent.glow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: colors.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  }
};
