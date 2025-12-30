import * as Sharing from "expo-sharing";
import { Paths, File } from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { DayPicker } from "@/components/day-picker";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useLanguage } from "@/contexts/language-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { DEFAULT_CHECKPOINTS, TOTAL_CHECKPOINTS } from "@/constants/checkpoints";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { getParticipantsWithProgress } from "@/hooks/use-storage";

// Animated Progress Ring Component
function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 10,
  color,
  backgroundColor,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  backgroundColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - progress * circumference;

  return (
    <Svg width={size} height={size}>
      <Circle
        stroke={backgroundColor}
        fill="none"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
      />
      <Circle
        stroke={color}
        fill="none"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

export default function ReportsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [isExporting, setIsExporting] = useState(false);
  const [selectedDay, setSelectedDay] = useState<1 | 2 | "all">("all");

  const { participants, scanLogs } = useOfflineSync();

  const participantsWithProgress = useMemo(
    () => getParticipantsWithProgress(participants, scanLogs),
    [participants, scanLogs]
  );

  // Filter checkpoints by selected day
  const filteredCheckpoints = selectedDay === "all"
    ? DEFAULT_CHECKPOINTS
    : DEFAULT_CHECKPOINTS.filter((c) => c.day === selectedDay);

  const dayCheckpointCount = selectedDay === "all" ? TOTAL_CHECKPOINTS : 8;

  // Calculate statistics (day-filtered)
  const stats = useMemo(() => {
    const totalParticipants = participants.length;
    
    // Filter scan logs by day if a specific day is selected
    const filteredScanLogs = selectedDay === "all"
      ? scanLogs
      : scanLogs.filter((log) => {
          const checkpoint = DEFAULT_CHECKPOINTS.find((c) => c.id === log.checkpointId);
          return checkpoint?.day === selectedDay;
        });
    
    const totalScans = filteredScanLogs.length;
    
    // Calculate progress based on filtered checkpoints
    const getFilteredProgress = (p: typeof participantsWithProgress[0]) => {
      if (selectedDay === "all") return p.totalScans;
      return p.scannedCheckpoints.filter((cpId) => {
        const cp = DEFAULT_CHECKPOINTS.find((c) => c.id === cpId);
        return cp?.day === selectedDay;
      }).length;
    };
    
    const completedParticipants = participantsWithProgress.filter(
      (p) => getFilteredProgress(p) === dayCheckpointCount
    ).length;
    const notStartedParticipants = participantsWithProgress.filter(
      (p) => getFilteredProgress(p) === 0
    ).length;
    const inProgressParticipants =
      totalParticipants - completedParticipants - notStartedParticipants;

    const checkpointStats = filteredCheckpoints.map((checkpoint) => {
      const checkpointLogs = scanLogs.filter((log) => log.checkpointId === checkpoint.id);
      return {
        ...checkpoint,
        scanCount: checkpointLogs.length,
        percentage:
          totalParticipants > 0
            ? Math.round((checkpointLogs.length / totalParticipants) * 100)
            : 0,
      };
    });

    return {
      totalParticipants,
      totalScans,
      completedParticipants,
      notStartedParticipants,
      inProgressParticipants,
      completionRate:
        totalParticipants > 0
          ? Math.round((completedParticipants / totalParticipants) * 100)
          : 0,
      checkpointStats,
    };
  }, [participants, scanLogs, participantsWithProgress, selectedDay, filteredCheckpoints, dayCheckpointCount]);

  const exportToCSV = async () => {
    setIsExporting(true);
    try {
      let csvContent = "Participant ID,Name,Mobile,QR Token,Checkpoints Completed,Progress %\n";

      participantsWithProgress.forEach((p) => {
        const progress = Math.round((p.totalScans / TOTAL_CHECKPOINTS) * 100);
        csvContent += `${p.id},"${p.name}","${p.mobile}",${p.qrToken},${p.totalScans},${progress}%\n`;
      });

      csvContent += "\n\nScan Logs\n";
      csvContent += "Scan ID,Participant ID,Participant Name,Checkpoint,Timestamp,Synced\n";

      scanLogs.forEach((log) => {
        const participant = participants.find((p) => p.id === log.participantId);
        const checkpoint = DEFAULT_CHECKPOINTS.find((c) => c.id === log.checkpointId);
        csvContent += `${log.id},${log.participantId},"${participant?.name || "Unknown"}",${checkpoint?.number || log.checkpointId},${log.timestamp},${log.synced}\n`;
      });

      const fileName = `palitana_yatra_report_${new Date().toISOString().split("T")[0]}.csv`;
      const file = new File(Paths.cache, fileName);
      await file.write(csvContent);
      const filePath = file.uri;

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: "text/csv",
          dialogTitle: "Export Yatra Report",
        });
      } else {
        Alert.alert("Success", `Report saved to ${fileName}`);
      }
    } catch (error) {
      console.error("Export error:", error);
      Alert.alert("Error", "Failed to export report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return colors.success;
    if (percentage >= 50) return colors.pending;
    if (percentage > 0) return colors.primary;
    return colors.textTertiary;
  };

  return (
    <ThemedView style={styles.container}>
      {/* Premium Header */}
      <LinearGradient
        colors={[colors.gradientPrimaryStart, colors.gradientPrimaryEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 10 }]}
      >
        <Animated.View entering={FadeInDown.delay(100)}>
          <ThemedText style={styles.headerTitle}>{t("reports_title")}</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            Pilgrimage progress and statistics
          </ThemedText>
        </Animated.View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 70 },
        ]}
      >
        {/* Day Picker */}
        <Animated.View entering={FadeIn.delay(100)} style={styles.dayPickerSection}>
          <DayPicker
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            showAllOption
          />
        </Animated.View>

        {/* Day Info Banner */}
        {selectedDay !== "all" && (
          <Animated.View
            entering={FadeIn}
            style={[styles.dayBanner, { backgroundColor: selectedDay === 1 ? colors.primaryLight : colors.successLight }]}
          >
            <IconSymbol
              name={selectedDay === 1 ? "arrow.up.circle.fill" : "arrow.down.circle.fill"}
              size={24}
              color={selectedDay === 1 ? colors.primary : colors.success}
            />
            <View style={styles.dayBannerText}>
              <ThemedText style={[styles.dayBannerTitle, { color: selectedDay === 1 ? colors.primary : colors.success }]}>
                Day {selectedDay} - {selectedDay === 1 ? "Ascent" : "Descent"}
              </ThemedText>
              <ThemedText style={[styles.dayBannerSubtitle, { color: colors.textSecondary }]}>
                Showing checkpoints {selectedDay === 1 ? "1-8" : "9-16"} only
              </ThemedText>
            </View>
          </Animated.View>
        )}

        {/* Completion Ring Card */}
        <Animated.View
          entering={FadeInUp.delay(200)}
          style={[styles.ringCard, { backgroundColor: colors.card }, Shadows.md]}
        >
          <View style={styles.ringContainer}>
            <ProgressRing
              progress={stats.completionRate / 100}
              size={140}
              strokeWidth={12}
              color={colors.success}
              backgroundColor={colors.backgroundSecondary}
            />
            <View style={styles.ringCenter}>
              <ThemedText style={styles.ringValue}>
                {stats.completionRate}%
              </ThemedText>
              <ThemedText style={[styles.ringLabel, { color: colors.textSecondary }]}>
                Completed
              </ThemedText>
            </View>
          </View>

          <View style={styles.ringStats}>
            <View style={styles.ringStat}>
              <View style={[styles.statDot, { backgroundColor: colors.success }]} />
              <ThemedText style={[styles.ringStatLabel, { color: colors.textSecondary }]}>
                Completed
              </ThemedText>
              <ThemedText style={styles.ringStatValue}>{stats.completedParticipants}</ThemedText>
            </View>
            <View style={styles.ringStat}>
              <View style={[styles.statDot, { backgroundColor: colors.pending }]} />
              <ThemedText style={[styles.ringStatLabel, { color: colors.textSecondary }]}>
                In Progress
              </ThemedText>
              <ThemedText style={styles.ringStatValue}>{stats.inProgressParticipants}</ThemedText>
            </View>
            <View style={styles.ringStat}>
              <View style={[styles.statDot, { backgroundColor: colors.textTertiary }]} />
              <ThemedText style={[styles.ringStatLabel, { color: colors.textSecondary }]}>
                Not Started
              </ThemedText>
              <ThemedText style={styles.ringStatValue}>{stats.notStartedParticipants}</ThemedText>
            </View>
          </View>
        </Animated.View>

        {/* Quick Stats */}
        <Animated.View entering={FadeIn.delay(300)} style={styles.quickStats}>
          <View style={[styles.quickStatCard, { backgroundColor: colors.card }, Shadows.sm]}>
            <View style={[styles.quickStatIcon, { backgroundColor: colors.primaryLight }]}>
              <IconSymbol name="person.2.fill" size={20} color={colors.primary} />
            </View>
            <ThemedText style={styles.quickStatValue}>{stats.totalParticipants}</ThemedText>
            <ThemedText style={[styles.quickStatLabel, { color: colors.textSecondary }]}>
              Total Pilgrims
            </ThemedText>
          </View>

          <View style={[styles.quickStatCard, { backgroundColor: colors.card }, Shadows.sm]}>
            <View style={[styles.quickStatIcon, { backgroundColor: colors.successLight }]}>
              <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
            </View>
            <ThemedText style={styles.quickStatValue}>{stats.totalScans}</ThemedText>
            <ThemedText style={[styles.quickStatLabel, { color: colors.textSecondary }]}>
              Total Scans
            </ThemedText>
          </View>
        </Animated.View>

        {/* Checkpoint Progress */}
        <Animated.View entering={FadeInUp.delay(400)}>
          <ThemedText style={styles.sectionTitle}>Checkpoint Progress</ThemedText>
          <View style={[styles.checkpointList, { backgroundColor: colors.card }, Shadows.sm]}>
            {stats.checkpointStats.map((checkpoint, index) => {
              const statusColor = getProgressColor(checkpoint.percentage);

              return (
                <View
                  key={checkpoint.id}
                  style={[
                    styles.checkpointRow,
                    index < stats.checkpointStats.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={[styles.cpNumber, { backgroundColor: colors.backgroundSecondary }]}>
                    <ThemedText style={[styles.cpNumberText, { color: colors.textSecondary }]}>
                      {checkpoint.number}
                    </ThemedText>
                  </View>
                  <View style={styles.cpInfo}>
                    <ThemedText style={styles.cpName} numberOfLines={1}>
                      {checkpoint.description}
                    </ThemedText>
                    <View style={[styles.cpProgressBg, { backgroundColor: colors.backgroundSecondary }]}>
                      <View
                        style={[
                          styles.cpProgressFill,
                          { backgroundColor: statusColor, width: `${checkpoint.percentage}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.cpCount}>
                    <ThemedText style={[styles.cpCountValue, { color: statusColor }]}>
                      {checkpoint.scanCount}
                    </ThemedText>
                    <ThemedText style={[styles.cpCountPercent, { color: colors.textTertiary }]}>
                      {checkpoint.percentage}%
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Export Button */}
        <Animated.View entering={FadeIn.delay(500)}>
          <Pressable
            style={({ pressed }) => [
              styles.exportButton,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              isExporting && { opacity: 0.6 },
            ]}
            onPress={exportToCSV}
            disabled={isExporting}
          >
            <IconSymbol name="square.and.arrow.up" size={20} color="#FFFFFF" />
            <ThemedText style={styles.exportButtonText}>
              {isExporting ? "Exporting..." : "Export Report (CSV)"}
            </ThemedText>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: Radius["2xl"],
    borderBottomRightRadius: Radius["2xl"],
  },
  headerTitle: {
    fontSize: Typography.size["2xl"],
    fontWeight: Typography.weight.bold,
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: Typography.size.sm,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  ringCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  ringContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  ringCenter: {
    position: "absolute",
    alignItems: "center",
  },
  ringValue: {
    fontSize: Typography.size["3xl"],
    fontWeight: Typography.weight.bold,
  },
  ringLabel: {
    fontSize: Typography.size.sm,
    marginTop: 2,
  },
  ringStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  ringStat: {
    alignItems: "center",
  },
  statDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginBottom: Spacing.xs,
  },
  ringStatLabel: {
    fontSize: Typography.size.xs,
    marginBottom: 2,
  },
  ringStatValue: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
  },
  quickStats: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  quickStatCard: {
    flex: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: "center",
  },
  quickStatIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  quickStatValue: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
  },
  quickStatLabel: {
    fontSize: Typography.size.sm,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
    marginBottom: Spacing.md,
  },
  checkpointList: {
    borderRadius: Radius.xl,
    overflow: "hidden",
    marginBottom: Spacing.xl,
  },
  checkpointRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  cpNumber: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  cpNumberText: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  cpInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  cpName: {
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.medium,
    marginBottom: Spacing.xs,
  },
  cpProgressBg: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  cpProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
  cpCount: {
    alignItems: "flex-end",
    marginLeft: Spacing.md,
  },
  cpCountValue: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.bold,
  },
  cpCountPercent: {
    fontSize: Typography.size.xs,
  },
  exportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    gap: Spacing.sm,
  },
  exportButtonText: {
    color: "#FFFFFF",
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  // Day picker styles
  dayPickerSection: {
    marginBottom: Spacing.lg,
  },
  dayBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  dayBannerText: {
    flex: 1,
  },
  dayBannerTitle: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  dayBannerSubtitle: {
    fontSize: Typography.size.sm,
    marginTop: 2,
  },
});
