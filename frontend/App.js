import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text } from "react-native";

import { colors } from "./src/theme";

import DashboardScreen      from "./src/screens/DashboardScreen";
import AnomaliesScreen      from "./src/screens/AnomaliesScreen";
import JournalScreen        from "./src/screens/JournalScreen";
import SettingsScreen       from "./src/screens/SettingsScreen";
import NightDetailScreen    from "./src/screens/NightDetailScreen";
import HealthConnectScreen  from "./src/screens/HealthConnectScreen";
import HistoryScreen        from "./src/screens/HistoryScreen";
import ScoreStatsScreen     from "./src/screens/ScoreStatsScreen";
import DurationStatsScreen  from "./src/screens/DurationStatsScreen";

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_CONFIG = {
  Dashboard: { icon: "🌙", label: "Главная" },
  Anomalies: { icon: "⚡", label: "Аномалии" },
  Journal:   { icon: "📓", label: "Дневник" },
  Settings:  { icon: "⚙️", label: "Настройки" },
};

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#111827",
          borderTopColor: "#1E2A40",
          borderTopWidth: 1,
          height: 70,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.4 }}>
            {TAB_CONFIG[route.name]?.icon}
          </Text>
        ),
        tabBarLabel: ({ focused }) => (
          <Text style={{
            fontSize: 10,
            color: focused ? "#6C8EF5" : "#4A5568",
            fontWeight: focused ? "700" : "400",
          }}>
            {TAB_CONFIG[route.name]?.label}
          </Text>
        ),
        tabBarActiveTintColor: "#6C8EF5",
        tabBarInactiveTintColor: "#4A5568",
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Anomalies" component={AnomaliesScreen} />
      <Tab.Screen name="Journal"   component={JournalScreen} />
      <Tab.Screen name="Settings"  component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main"          component={TabNavigator} />
        <Stack.Screen name="NightDetail"   component={NightDetailScreen} />
        <Stack.Screen name="HealthConnect" component={HealthConnectScreen} />
        <Stack.Screen name="History"       component={HistoryScreen} />
        <Stack.Screen name="ScoreStats"    component={ScoreStatsScreen} />
        <Stack.Screen name="DurationStats" component={DurationStatsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}