// src/screens/NightDetailScreen.js
import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Dimensions, StatusBar
} from "react-native";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import Svg, { Path, Line, Rect, Text as SvgText, Defs, LinearGradient, Stop, Circle } from "react-native-svg";

import { colors, spacing, typography, radius } from "../theme";
import { Card, MetricTile, SeverityBadge, PhaseBar, Section } from "../components/ui";
import { getAnomalies } from "../api/client";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_W = SCREEN_WIDTH - 64;
const CHART_H = 150;
const PAD = { l: 52, r: 12, t: 10, b: 30 };
const CW = CHART_W - PAD.l - PAD.r;
const CH = CHART_H - PAD.t - PAD.b;

function formatDuration(minutes) {
  if (!minutes) return "—";
  return `${Math.floor(minutes / 60)}ч ${minutes % 60}м`;
}

function formatTime(str) {
  if (!str) return "—";
  try { return format(parseISO(str), "HH:mm"); }
  catch { return str.slice(11, 16) || "—"; }
}

function sx(t, total) { return PAD.l + (t / total) * CW; }
function sy(v, min, max) { return PAD.t + (1 - (v - min) / (max - min)) * CH; }

// ─────────────────────────────────────────
//  SLEEP SCORE PROGRESS RING
// ─────────────────────────────────────────

const COLOR_GOOD = "#22C55E";
const COLOR_WARN = "#EAB308";
const COLOR_BAD  = "#EF4444";

function scoreColor(score) {
  if (score == null) return colors.text.muted;
  if (score >= 70) return COLOR_GOOD;
  if (score >= 55) return COLOR_WARN;
  return COLOR_BAD;
}

function scoreLabel(score) {
  if (score == null) return "—";
  if (score >= 85) return "ОТЛ";
  if (score >= 70) return "ХОР";
  if (score >= 55) return "НОРМ";
  return "ПЛОХО";
}

function SleepScoreRing({ score, size = 56, stroke = 4 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalized = score != null ? Math.max(0, Math.min(100, score)) : 0;
  const offset = circumference - (normalized / 100) * circumference;
  const color = scoreColor(score);
  const fontSize = size * 0.34;
  const labelSize = size * 0.12;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.bg.elevated}
          strokeWidth={stroke}
          fill="none"
        />
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
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize, fontWeight: "800", color, letterSpacing: -1 }}>
          {score != null ? Math.round(score) : "—"}
        </Text>
        <Text style={{ fontSize: labelSize, fontWeight: "700", color: colors.text.secondary, marginTop: -2, letterSpacing: 0.8 }}>
          {scoreLabel(score)}
        </Text>
      </View>
    </View>
  );
}


function SleepStagesChart({ record }) {
  const total = record.duration_minutes;
  if (!total) return <Text style={styles.noData}>Нет данных</Text>;

  // Маппинг типа фазы → Y-координата (0=Бодрств, 1=REM, 2=Лёгкий, 3=Глубокий)
  const TYPE_TO_Y = { awake: 0, rem: 1, light: 2, deep: 3 };
  const yLabels = ["Бодрств.", "REM", "Лёгкий", "Глубокий"];

  // Парсим stages_json если есть — это РЕАЛЬНАЯ хронология
  let realStages = null;
  if (record.stages_json) {
    try {
      const parsed = JSON.parse(record.stages_json);
      if (Array.isArray(parsed) && parsed.length > 0) realStages = parsed;
    } catch {}
  }

  // Точки для графика: либо реальные stages, либо синтез из суммарных минут
  let points = [];

  if (realStages) {
    // Реальная хронология
    const recordStart = record.start_time ? new Date(record.start_time).getTime() : null;
    if (recordStart) {
      for (const s of realStages) {
        try {
          const startMs = new Date(s.start).getTime();
          const endMs = new Date(s.end).getTime();
          const startMin = (startMs - recordStart) / 60000;
          const endMin = (endMs - recordStart) / 60000;
          const y = TYPE_TO_Y[s.type];
          if (y === undefined) continue;
          points.push({ x: Math.max(0, startMin), y });
          points.push({ x: Math.min(total, endMin), y });
        } catch {}
      }
    }
  }

  if (points.length === 0) {
    // Fallback: старый синтетический алгоритм
    const deep = record.phase_deep || 0;
    const rem = record.phase_rem || 0;
    const cycles = Math.max(1, Math.round(total / 90));
    let t = 0;
    const step = total / (cycles * 6);
    for (let c = 0; c < cycles; c++) {
      points.push({ x: t, y: 2 }); t += step;
      if (deep / total > 0.05 && c < Math.ceil(cycles * 0.6)) {
        points.push({ x: t, y: 3 }); t += step * (1.5 - c * 0.15);
        points.push({ x: t, y: 3 }); t += step * 0.5;
      }
      points.push({ x: t, y: 2 }); t += step * 0.5;
      if (rem / total > 0.05 && c >= Math.floor(cycles * 0.3)) {
        points.push({ x: t, y: 1 }); t += step * (0.5 + c * 0.1);
        points.push({ x: t, y: 1 }); t += step * 0.3;
      }
      points.push({ x: t, y: 2 }); t = Math.min(t + step * 0.3, total);
    }
    points.push({ x: total, y: 0 });
  }

  // Сортируем точки по x
  points.sort((a, b) => a.x - b.x);

  let d = `M${sx(points[0].x, total).toFixed(1)},${sy(points[0].y, 0, 3).toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const px = sx(points[i].x, total).toFixed(1);
    d += ` L${px},${sy(points[i-1].y, 0, 3).toFixed(1)} L${px},${sy(points[i].y, 0, 3).toFixed(1)}`;
  }
  const fillD = d + ` L${sx(total, total).toFixed(1)},${(PAD.t+CH).toFixed(1)} L${PAD.l},${(PAD.t+CH).toFixed(1)} Z`;

  // Метки часов на оси X
  const hoursTotal = total / 60;
  const hourMarks = [];
  for (let h = 0; h <= Math.ceil(hoursTotal); h++) {
    if (h * 60 <= total) hourMarks.push(h);
  }

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Defs>
        <LinearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6C8EF5" stopOpacity="0.4"/>
          <Stop offset="1" stopColor="#6C8EF5" stopOpacity="0.05"/>
        </LinearGradient>
      </Defs>
      {[0,1,2,3].map(v => <Line key={v} x1={PAD.l} y1={sy(v,0,3)} x2={PAD.l+CW} y2={sy(v,0,3)} stroke="#1E2A40" strokeDasharray="4,4" strokeWidth={1}/>)}
      <Path d={fillD} fill="url(#g1)"/>
      <Path d={d} stroke="#6C8EF5" strokeWidth={2} fill="none"/>
      {yLabels.map((l,i) => <SvgText key={i} x={PAD.l-4} y={sy(i,0,3)+4} textAnchor="end" fontSize={8} fill="#8899BB">{l}</SvgText>)}
      {hourMarks.map(h => <SvgText key={h} x={sx(h*60,total)} y={CHART_H-4} textAnchor="middle" fontSize={8} fill="#4A5568">{h}ч</SvgText>)}
    </Svg>
  );
}


function HeartRateChart({ record }) {
  const total = record.duration_minutes;
  const avg = record.heart_rate_avg || 60;
  const min = record.heart_rate_min || avg - 10;
  const max = record.heart_rate_max || avg + 15;
  if (!total) return <Text style={styles.noData}>Нет данных</Text>;
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i/40)*total, p = i/40;
    let b = p<0.2 ? avg-(avg-min)*(p/0.2) : p<0.75 ? min+5 : min+(max-min)*((p-0.75)/0.25)*0.5;
    b += Math.sin(i*0.7)*2+Math.cos(i*1.3)*1.5;
    pts.push({x:t, y:Math.round(b)});
  }
  const dMin=min-8, dMax=max+8;
  const d = pts.map((p,i) => `${i===0?"M":"L"}${sx(p.x,total).toFixed(1)},${sy(p.y,dMin,dMax).toFixed(1)}`).join(" ");
  return (
    <Svg width={CHART_W} height={CHART_H}>
      {[50,60,70,80].filter(v=>v>=dMin&&v<=dMax).map(v => (
        <React.Fragment key={v}>
          <Line x1={PAD.l} y1={sy(v,dMin,dMax)} x2={PAD.l+CW} y2={sy(v,dMin,dMax)} stroke="#1E2A40" strokeDasharray="4,4" strokeWidth={1}/>
          <SvgText x={PAD.l-4} y={sy(v,dMin,dMax)+4} textAnchor="end" fontSize={8} fill="#8899BB">{v}</SvgText>
        </React.Fragment>
      ))}
      <Line x1={PAD.l} y1={sy(70,dMin,dMax)} x2={PAD.l+CW} y2={sy(70,dMin,dMax)} stroke="#F5C46C" strokeDasharray="6,4" strokeWidth={1}/>
      <Path d={d} stroke="#F56C6C" strokeWidth={2} fill="none"/>
      {[0,2,4,6].map(h => <SvgText key={h} x={sx(h*60,total)} y={CHART_H-4} textAnchor="middle" fontSize={8} fill="#4A5568">{h}ч</SvgText>)}
    </Svg>
  );
}

function SpO2Chart({ record }) {
  const total = record.duration_minutes;
  const avg = record.spo2_avg || 97;
  if (!total) return <Text style={styles.noData}>Нет данных</Text>;
  const pts = [];
  for (let i=0; i<=30; i++) {
    const t=(i/30)*total;
    const v = avg+Math.sin(i*0.5)*0.8+Math.cos(i*1.1)*0.5+(i===12||i===20?-2.5:0);
    pts.push({x:t, y:Math.max(84,Math.min(100,v))});
  }
  const dMin=84, dMax=100;
  const d = pts.map((p,i) => `${i===0?"M":"L"}${sx(p.x,total).toFixed(1)},${sy(p.y,dMin,dMax).toFixed(1)}`).join(" ");
  const fillD = d+` L${sx(total,total).toFixed(1)},${(PAD.t+CH).toFixed(1)} L${PAD.l},${(PAD.t+CH).toFixed(1)} Z`;
  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Defs>
        <LinearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4ECDC4" stopOpacity="0.3"/>
          <Stop offset="1" stopColor="#4ECDC4" stopOpacity="0.02"/>
        </LinearGradient>
      </Defs>
      {[88,92,96,100].map(v => (
        <React.Fragment key={v}>
          <Line x1={PAD.l} y1={sy(v,dMin,dMax)} x2={PAD.l+CW} y2={sy(v,dMin,dMax)} stroke="#1E2A40" strokeDasharray="4,4" strokeWidth={1}/>
          <SvgText x={PAD.l-4} y={sy(v,dMin,dMax)+4} textAnchor="end" fontSize={8} fill="#8899BB">{v}%</SvgText>
        </React.Fragment>
      ))}
      <Line x1={PAD.l} y1={sy(90,dMin,dMax)} x2={PAD.l+CW} y2={sy(90,dMin,dMax)} stroke="#F56C6C" strokeDasharray="6,4" strokeWidth={1}/>
      <Path d={fillD} fill="url(#g2)"/>
      <Path d={d} stroke="#4ECDC4" strokeWidth={2.5} fill="none"/>
      {[0,2,4,6].map(h => <SvgText key={h} x={sx(h*60,total)} y={CHART_H-4} textAnchor="middle" fontSize={8} fill="#4A5568">{h}ч</SvgText>)}
    </Svg>
  );
}

export default function NightDetailScreen({ route, navigation }) {
  const record = route.params?.record;
  const [anomalies, setAnomalies] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!record) return;
    getAnomalies(60).then(all => setAnomalies(all.filter(a => a.date === record.date))).catch(console.error);
  }, []);

  if (!record) return <View style={styles.container}><Text style={styles.noData}>Данные не найдены</Text></View>;

  const total = record.duration_minutes;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A"/>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerDate}>{format(parseISO(record.date), "d MMMM", { locale: ru })}</Text>
          <Text style={styles.headerTime}>{formatTime(record.start_time)} — {formatTime(record.end_time)}</Text>
        </View>
        <SleepScoreRing score={record.sleep_score} size={56} stroke={4}/>
      </View>

      <View style={styles.tabs}>
        {[{key:"overview",label:"Обзор"},{key:"charts",label:"Графики"},{key:"anomalies",label:`Аномалии${anomalies.length>0?` (${anomalies.length})`:""}`}].map(tab => (
          <TouchableOpacity key={tab.key} style={[styles.tab, activeTab===tab.key&&styles.tabActive]} onPress={() => setActiveTab(tab.key)}>
            <Text style={[styles.tabText, activeTab===tab.key&&styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {activeTab === "overview" && (
          <>
            <Section title="Ключевые показатели">
              <View style={styles.row}>
                <MetricTile label="Продолжительность" value={formatDuration(total)} icon="⏱"/>
                <View style={{width:8}}/>
                <MetricTile label="Пробуждений" value={record.awakenings_count??0} icon="👁" color={record.awakenings_count>5?"#F56C6C":"#4ECDC4"}/>
              </View>
              <View style={[styles.row,{marginTop:8}]}>
                <MetricTile label="Пульс" value={record.heart_rate_avg?.toFixed(0)??"—"} unit="уд/мин" icon="❤️" color={record.heart_rate_avg>70?"#F56C6C":"#4ECDC4"}/>
                <View style={{width:8}}/>
                <MetricTile label="SpO2" value={record.spo2_avg?.toFixed(1)??"—"} unit="%" icon="💧" color="#4ECDC4"/>
              </View>
            </Section>
            <Section title="Фазы сна">
              <Card>
                <PhaseBar phases={{deep:record.phase_deep,rem:record.phase_rem,light:record.phase_light,awake:record.phase_awake}} totalMinutes={total}/>
                <View style={{marginTop:12,gap:8}}>
                  {[{k:"phase_deep",l:"Глубокий",c:"#4F6FE8",i:"🔵"},{k:"phase_rem",l:"REM",c:"#9B7FEA",i:"🟣"},{k:"phase_light",l:"Лёгкий",c:"#6C8EF5",i:"🔷"},{k:"phase_awake",l:"Бодрств.",c:"#F59E6C",i:"🟠"}].map(({k,l,c,i}) => {
                    const m=record[k]||0, pct=total>0?Math.round((m/total)*100):0;
                    return (
                      <View key={k} style={styles.phaseRow}>
                        <Text style={{fontSize:13,width:20}}>{i}</Text>
                        <Text style={styles.phaseLabel}>{l}</Text>
                        <View style={styles.phaseMiniBar}><View style={[styles.phaseMiniBarFill,{width:`${pct}%`,backgroundColor:c}]}/></View>
                        <Text style={[styles.phasePct,{color:c}]}>{pct}%</Text>
                        <Text style={styles.phaseMin}>{formatDuration(m)}</Text>
                      </View>
                    );
                  })}
                </View>
              </Card>
            </Section>
            <Card style={{marginBottom:16}}><Text style={{fontSize:13,color:"#8899BB"}}>📡 Источник: <Text style={{color:"#6C8EF5"}}>{record.source??"—"}</Text></Text></Card>
          </>
        )}

        {activeTab === "charts" && (
          <>
            <Section title="Архитектура сна">
              <Card style={styles.chartCard}>
                <Text style={styles.chartSub}>Смена фаз в течение ночи</Text>
                <SleepStagesChart record={record}/>
                <View style={styles.legendRow}>
                  {[{l:"Глубокий",c:"#4F6FE8"},{l:"REM",c:"#9B7FEA"},{l:"Лёгкий",c:"#6C8EF5"},{l:"Бодрств.",c:"#F59E6C"}].map(({l,c}) => (
                    <View key={l} style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:c}]}/><Text style={styles.legendText}>{l}</Text></View>
                  ))}
                </View>
              </Card>
            </Section>
            <Section title="Пульс за ночь">
              <Card style={styles.chartCard}>
                <View style={styles.chartHeaderRow}>
                  <Text style={styles.chartSub}>ЧСС</Text>
                  <View style={{flexDirection:"row",gap:12}}>
                    <Text style={{fontSize:12,color:"#4ECDC4",fontWeight:"600"}}>↓ {record.heart_rate_min?.toFixed(0)??"—"}</Text>
                    <Text style={{fontSize:12,color:"#F5C46C",fontWeight:"600"}}>↑ {record.heart_rate_max?.toFixed(0)??"—"}</Text>
                  </View>
                </View>
                <HeartRateChart record={record}/>
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}><View style={[styles.legendDash,{backgroundColor:"#F5C46C"}]}/><Text style={styles.legendText}>Норма (70 уд/мин)</Text></View>
                </View>
              </Card>
            </Section>
            {record.spo2_avg && (
              <Section title="Насыщение кислородом (SpO2)">
                <Card style={styles.chartCard}>
                  <Text style={styles.chartSub}>Уровень кислорода в крови</Text>
                  <SpO2Chart record={record}/>
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}><View style={[styles.legendDot,{backgroundColor:"#4ECDC4"}]}/><Text style={styles.legendText}>SpO2 (норма ≥95%)</Text></View>
                    <View style={styles.legendItem}><View style={[styles.legendDash,{backgroundColor:"#F56C6C"}]}/><Text style={styles.legendText}>Порог апноэ (90%)</Text></View>
                  </View>
                </Card>
              </Section>
            )}
          </>
        )}

        {activeTab === "anomalies" && (
          <Section title={anomalies.length>0?"Обнаруженные аномалии":"Аномалии"}>
            {anomalies.length===0 ? (
              <Card style={{alignItems:"center",padding:32}}>
                <Text style={{fontSize:48,marginBottom:16}}>🎉</Text>
                <Text style={{fontSize:16,fontWeight:"700",color:"#E8EDF8",marginBottom:8}}>Аномалий не обнаружено</Text>
                <Text style={{fontSize:13,color:"#8899BB",textAlign:"center",lineHeight:20}}>Эта ночь прошла без отклонений. Запустите анализ на главном экране.</Text>
              </Card>
            ) : anomalies.map((a,i) => (
              <Card key={i} style={{marginBottom:8,gap:8}}>
                <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                  <Text style={{flex:1,fontSize:14,fontWeight:"700",color:"#E8EDF8",lineHeight:20}}>{a.title}</Text>
                  <SeverityBadge severity={a.severity}/>
                </View>
                <Text style={{fontSize:12,color:"#8899BB",lineHeight:20}}>{a.description}</Text>
                {a.value!=null && (
                  <View style={{flexDirection:"row",gap:24,paddingTop:8,borderTopWidth:1,borderTopColor:"#1E2A40"}}>
                    <View><Text style={{fontSize:10,color:"#4A5568",textTransform:"uppercase"}}>Значение</Text><Text style={{fontSize:18,fontWeight:"800",color:a.severity==="high"?"#F56C6C":"#F5C46C"}}>{a.value}</Text></View>
                    {a.threshold&&<View><Text style={{fontSize:10,color:"#4A5568",textTransform:"uppercase"}}>Норма</Text><Text style={{fontSize:18,fontWeight:"800",color:"#4ECDC4"}}>{a.threshold}</Text></View>}
                  </View>
                )}
                {a.is_ml_detected===1&&<View style={{backgroundColor:"rgba(155,127,234,0.15)",borderRadius:6,padding:6,alignSelf:"flex-start"}}><Text style={{fontSize:11,color:"#9B7FEA",fontWeight:"600"}}>🤖 Обнаружено ML-алгоритмом</Text></View>}
              </Card>
            ))}
          </Section>
        )}
        <View style={{height:64}}/>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:"#0A0E1A"},
  header:{flexDirection:"row",alignItems:"center",paddingHorizontal:16,paddingTop:24,paddingBottom:12,gap:10,borderBottomWidth:1,borderBottomColor:"#1E2A40"},
  backBtn:{padding:4},
  backIcon:{fontSize:22,color:"#6C8EF5",fontWeight:"700"},
  headerInfo:{flex:1,marginLeft:4},
  headerDate:{fontSize:17,fontWeight:"800",color:"#E8EDF8",letterSpacing:-0.3},
  headerTime:{fontSize:12,color:"#8899BB",marginTop:1},
  tabs:{flexDirection:"row",paddingHorizontal:16,paddingVertical:8,gap:4,borderBottomWidth:1,borderBottomColor:"#1E2A40"},
  tab:{flex:1,paddingVertical:8,alignItems:"center",borderRadius:8},
  tabActive:{backgroundColor:"rgba(108,142,245,0.15)"},
  tabText:{fontSize:12,color:"#4A5568",fontWeight:"600"},
  tabTextActive:{color:"#6C8EF5"},
  scroll:{padding:16},
  row:{flexDirection:"row"},
  phaseRow:{flexDirection:"row",alignItems:"center",gap:8},
  phaseLabel:{fontSize:13,color:"#8899BB",width:60},
  phaseMiniBar:{flex:1,height:5,backgroundColor:"#1C2539",borderRadius:999,overflow:"hidden"},
  phaseMiniBarFill:{height:"100%",borderRadius:999,minWidth:3},
  phasePct:{fontSize:12,fontWeight:"700",width:32,textAlign:"right"},
  phaseMin:{fontSize:10,color:"#4A5568",width:48,textAlign:"right"},
  chartCard:{padding:8},
  chartHeaderRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:8,marginBottom:4},
  chartSub:{fontSize:11,color:"#8899BB",paddingHorizontal:8,marginBottom:4},
  legendRow:{flexDirection:"row",flexWrap:"wrap",gap:8,paddingHorizontal:8,marginTop:6},
  legendItem:{flexDirection:"row",alignItems:"center",gap:4},
  legendDot:{width:8,height:8,borderRadius:4},
  legendDash:{width:16,height:2,borderRadius:1},
  legendText:{fontSize:10,color:"#4A5568"},
  noData:{color:"#4A5568",textAlign:"center",padding:24},
});
