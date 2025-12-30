import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DayPicker } from "@/components/day-picker";
import { OfflineBanner } from "@/components/offline-banner";
import { SyncStatusBar } from "@/components/sync-status-bar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useLanguage } from "@/contexts/language-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { DEFAULT_CHECKPOINTS } from "@/constants/checkpoints";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useResponsive } from "@/hooks/use-responsive";
import { useSettings } from "@/hooks/use-storage";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { scanFromGallery } from "@/services/qr-scanner";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SCAN_BUTTON_SIZE = 140;

interface RecentScan {
  id: string;
  participantName: string;
  checkpointNumber: number;
  timestamp: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ScannerScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const insets = useSafeAreaInsets();
  const { isDesktop, containerWidth } = useResponsive();
  const { t } = useLanguage();

  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{
    success: boolean;
    message: string;
    participantName?: string;
  } | null>(null);
  const [showCheckpointPicker, setShowCheckpointPicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState<1 | 2 | "all">("all");

  const { settings, updateSettings } = useSettings();
  const { participants, scanLogs, addScan, isOnline, pendingCount, forceSync } = useOfflineSync();

  // Animation values
  const scanButtonScale = useSharedValue(1);
  const pulseScale = useSharedValue(1);

  // Pulse animation for scan button
  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: 2 - pulseScale.value,
  }));

  const scanButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scanButtonScale.value }],
  }));

  // Get recent scans for display
  const recentScans: RecentScan[] = scanLogs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, isDesktop ? 20 : 10)
    .map((log) => {
      const participant = participants.find((p) => p.id === log.participantId);
      const checkpoint = DEFAULT_CHECKPOINTS.find((c) => c.id === log.checkpointId);
      return {
        id: log.id,
        participantName: participant?.name || "Unknown",
        checkpointNumber: checkpoint?.number || log.checkpointId,
        timestamp: log.timestamp,
      };
    });

  const currentCheckpoint = DEFAULT_CHECKPOINTS.find(
    (c) => c.id === settings.currentCheckpoint
  );

  // Filter checkpoints by selected day
  const filteredCheckpoints = selectedDay === "all"
    ? DEFAULT_CHECKPOINTS
    : DEFAULT_CHECKPOINTS.filter((c) => c.day === selectedDay);

  const handleBarCodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (isProcessing) return;
      setIsProcessing(true);

      const participant = participants.find((p) => p.qrToken === data);

      if (!participant) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setLastScanResult({
          success: false,
          message: "Participant not found. Invalid QR code.",
        });
        setIsScannerOpen(false);
        setIsProcessing(false);
        return;
      }

      const result = await addScan(
        participant.id,
        settings.currentCheckpoint
      );

      if (result.duplicate) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setLastScanResult({
          success: false,
          message: `Already scanned at this checkpoint`,
          participantName: participant.name,
        });
      } else if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLastScanResult({
          success: true,
          message: `Successfully recorded!`,
          participantName: participant.name,
        });
      }

      setIsScannerOpen(false);
      setIsProcessing(false);
    },
    [isProcessing, participants, addScan, settings.currentCheckpoint]
  );

  const openScanner = async () => {
    scanButtonScale.value = withSequence(
      withSpring(0.9),
      withSpring(1)
    );
    
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setLastScanResult({
          success: false,
          message: "Camera permission is required to scan QR codes.",
        });
        return;
      }
    }
    setLastScanResult(null);
    setIsScannerOpen(true);
  };

  const handleGalleryScan = useCallback(async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setIsScannerOpen(false);

    try {
      const result = await scanFromGallery();
      
      if (!result.success || !result.data) {
        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setLastScanResult({
          success: false,
          message: result.error || "Could not read QR code from image",
        });
        setIsProcessing(false);
        return;
      }

      // Process the scanned QR data
      const participant = participants.find((p) => p.qrToken === result.data);

      if (!participant) {
        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setLastScanResult({
          success: false,
          message: "Participant not found. Invalid QR code.",
        });
        setIsProcessing(false);
        return;
      }

      const scanResult = await addScan(
        participant.id,
        settings.currentCheckpoint
      );

      if (scanResult.duplicate) {
        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        setLastScanResult({
          success: false,
          message: `Already scanned at this checkpoint`,
          participantName: participant.name,
        });
      } else if (scanResult.success) {
        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setLastScanResult({
          success: true,
          message: `Successfully recorded!`,
          participantName: participant.name,
        });
      }
    } catch (error) {
      console.error("Gallery scan error:", error);
      setLastScanResult({
        success: false,
        message: "Failed to scan from gallery. Please try again.",
      });
    }

    setIsProcessing(false);
  }, [isProcessing, participants, addScan, settings.currentCheckpoint]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderRecentScan = ({ item, index }: { item: RecentScan; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      style={[
        styles.recentScanItem,
        { backgroundColor: colors.card },
        Shadows.sm,
        isDesktop && styles.recentScanItemDesktop,
      ]}
    >
      <View style={[styles.scanAvatar, { backgroundColor: colors.successLight }]}>
        <IconSymbol name="checkmark.circle.fill" size={20} color={colors.success} />
      </View>
      <View style={styles.recentScanInfo}>
        <ThemedText style={styles.scanName} numberOfLines={1}>
          {item.participantName}
        </ThemedText>
        <ThemedText style={[styles.scanMeta, { color: colors.textSecondary }]}>
          CP {item.checkpointNumber} • {formatTime(item.timestamp)}
        </ThemedText>
      </View>
    </Animated.View>
  );

  const todayScans = scanLogs.filter((log) => {
    const today = new Date();
    const logDate = new Date(log.timestamp);
    return logDate.toDateString() === today.toDateString();
  }).length;

  // Desktop Layout
  if (isDesktop) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView 
          style={styles.desktopScrollView}
          contentContainerStyle={[
            styles.desktopContent,
            { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) + 80 }
          ]}
        >
          <View style={[styles.desktopContainer, { maxWidth: containerWidth }]}>
            {/* Desktop Header */}
            <LinearGradient
              colors={[colors.gradientPrimaryStart, colors.gradientPrimaryEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.desktopHeader}
            >
              <View style={styles.desktopHeaderContent}>
                <View>
                  <ThemedText style={styles.headerTitle}>{t("app_name")}</ThemedText>
                  <SyncStatusBar />
                </View>
                <View style={styles.desktopStatsRow}>
                  <View style={styles.desktopStatItem}>
                    <ThemedText style={styles.statValue}>{todayScans}</ThemedText>
                    <ThemedText style={styles.statLabel}>{t("scanner_recent_scans")}</ThemedText>
                  </View>
                  <View style={styles.desktopStatItem}>
                    <ThemedText style={styles.statValue}>{participants.length}</ThemedText>
                    <ThemedText style={styles.statLabel}>{t("nav_pilgrims")}</ThemedText>
                  </View>
                  <View style={styles.desktopStatItem}>
                    <ThemedText style={styles.statValue}>{currentCheckpoint?.number || 1}</ThemedText>
                    <ThemedText style={styles.statLabel}>{t("nav_checkpoints")}</ThemedText>
                  </View>
                </View>
              </View>
            </LinearGradient>

            {/* Desktop Main Content */}
            <View style={styles.desktopMainContent}>
              {/* Left Column - Scanner & Checkpoint */}
              <View style={styles.desktopLeftColumn}>
                {/* Checkpoint Selector */}
                <Pressable
                  style={[styles.checkpointCard, { backgroundColor: colors.card }, Shadows.md]}
                  onPress={() => setShowCheckpointPicker(true)}
                >
                  <View style={[styles.checkpointIcon, { backgroundColor: colors.primaryLight }]}>
                    <IconSymbol name="location.fill" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.checkpointInfo}>
                    <ThemedText style={[styles.checkpointLabel, { color: colors.textSecondary }]}>
                      {t("scanner_select_checkpoint")}
                    </ThemedText>
                    <ThemedText style={styles.checkpointName}>
                      #{currentCheckpoint?.number} - {currentCheckpoint?.description}
                    </ThemedText>
                  </View>
                  <View style={[styles.chevronCircle, { backgroundColor: colors.backgroundSecondary }]}>
                    <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
                  </View>
                </Pressable>

                {/* Scan Result Toast */}
                {lastScanResult && (
                  <Animated.View
                    entering={FadeIn.springify()}
                    exiting={FadeOut}
                    style={[
                      styles.resultToast,
                      {
                        backgroundColor: lastScanResult.success ? colors.successLight : colors.errorLight,
                        borderLeftColor: lastScanResult.success ? colors.success : colors.error,
                      },
                    ]}
                  >
                    <IconSymbol
                      name={lastScanResult.success ? "checkmark.circle.fill" : "xmark.circle.fill"}
                      size={28}
                      color={lastScanResult.success ? colors.success : colors.error}
                    />
                    <View style={styles.resultTextContainer}>
                      {lastScanResult.participantName && (
                        <ThemedText style={styles.resultName}>
                          {lastScanResult.participantName}
                        </ThemedText>
                      )}
                      <ThemedText
                        style={[
                          styles.resultMessage,
                          { color: lastScanResult.success ? colors.success : colors.error },
                        ]}
                      >
                        {lastScanResult.message}
                      </ThemedText>
                    </View>
                  </Animated.View>
                )}

                {/* Desktop Scan Button */}
                <View style={styles.desktopScanButtonContainer}>
                  <Animated.View style={[styles.pulseRing, { backgroundColor: colors.primary }, pulseStyle]} />
                  <AnimatedPressable
                    style={[styles.scanButton, scanButtonStyle]}
                    onPress={openScanner}
                  >
                    <LinearGradient
                      colors={[colors.gradientPrimaryStart, colors.gradientPrimaryEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.scanButtonGradient}
                    >
                      <IconSymbol name="qrcode.viewfinder" size={48} color="#FFFFFF" />
                    </LinearGradient>
                  </AnimatedPressable>
                </View>

                <ThemedText style={[styles.desktopHint, { color: colors.textTertiary }]}>
                  {t("scanner_tap_to_scan")}
                </ThemedText>
              </View>

              {/* Right Column - Recent Scans */}
              <View style={styles.desktopRightColumn}>
                <ThemedText style={styles.sectionTitle}>{t("scanner_recent_scans")}</ThemedText>
                {recentScans.length > 0 ? (
                  <View style={styles.desktopScansList}>
                    {recentScans.map((item, index) => renderRecentScan({ item, index }))}
                  </View>
                ) : (
                  <View style={[styles.emptyState, styles.desktopEmptyState]}>
                    <View style={[styles.emptyIcon, { backgroundColor: colors.backgroundSecondary }]}>
                      <IconSymbol name="qrcode" size={40} color={colors.textTertiary} />
                    </View>
                    <ThemedText style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                      {t("pilgrims_not_started")}
                    </ThemedText>
                    <ThemedText style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                      {t("qr_card_scan_instruction")}
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Modals */}
        {renderModals()}
      </ThemedView>
    );
  }

  // Mobile/Tablet Layout
  function renderModals() {
    return (
      <>
        {/* Camera Scanner Modal */}
        <Modal visible={isScannerOpen} animationType="slide" onRequestClose={() => setIsScannerOpen(false)}>
          <View style={styles.scannerContainer}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              onBarcodeScanned={isProcessing ? undefined : handleBarCodeScanned}
            />
            <LinearGradient
              colors={["rgba(0,0,0,0.7)", "transparent", "transparent", "rgba(0,0,0,0.7)"]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={[styles.scannerOverlay, { paddingTop: Math.max(insets.top, 20) }]}>
              <View style={styles.scannerHeader}>
                <Pressable style={styles.closeButton} onPress={() => setIsScannerOpen(false)}>
                  <IconSymbol name="xmark.circle.fill" size={36} color="#FFFFFF" />
                </Pressable>
                <View style={styles.scannerTitleContainer}>
                  <ThemedText style={styles.scannerLabel}>Scanning for</ThemedText>
                  <ThemedText style={styles.scannerTitle}>
                    Checkpoint #{currentCheckpoint?.number}
                  </ThemedText>
                </View>
                <View style={{ width: 36 }} />
              </View>
              
              <View style={styles.scannerFrameContainer}>
                <View style={[styles.scannerFrame, isDesktop && styles.scannerFrameDesktop]}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                </View>
              </View>
              
              <View style={styles.scannerFooter}>
                <ThemedText style={styles.scannerHint}>
                  Align QR code within the frame
                </ThemedText>
                {isProcessing ? (
                  <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 16 }} />
                ) : (
                  <Pressable
                    style={styles.galleryButton}
                    onPress={handleGalleryScan}
                  >
                    <IconSymbol name="photo" size={20} color="#FFFFFF" />
                    <ThemedText style={styles.galleryButtonText}>Scan from Gallery</ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </Modal>

        {/* Checkpoint Picker Modal */}
        <Modal
          visible={showCheckpointPicker}
          animationType="slide"
          transparent
          onRequestClose={() => setShowCheckpointPicker(false)}
        >
          <Pressable 
            style={styles.modalOverlay} 
            onPress={() => setShowCheckpointPicker(false)}
          >
            <Pressable 
              style={[
                styles.pickerContainer, 
                { backgroundColor: colors.card },
                isDesktop && styles.pickerContainerDesktop,
              ]}
            >
              <View style={styles.pickerHeader}>
                <ThemedText style={styles.pickerTitle}>Select Checkpoint</ThemedText>
                <Pressable onPress={() => setShowCheckpointPicker(false)}>
                  <IconSymbol name="xmark.circle.fill" size={28} color={colors.textSecondary} />
                </Pressable>
              </View>
              
              {/* Day Picker */}
              <View style={styles.dayPickerContainer}>
                <DayPicker
                  selectedDay={selectedDay}
                  onSelectDay={setSelectedDay}
                  compact
                />
              </View>
              
              {/* Day Header */}
              {selectedDay !== "all" && (
                <View style={[styles.dayHeader, { backgroundColor: colors.backgroundSecondary }]}>
                  <IconSymbol 
                    name={selectedDay === 1 ? "arrow.up.circle.fill" : "arrow.down.circle.fill"} 
                    size={20} 
                    color={colors.primary} 
                  />
                  <ThemedText style={[styles.dayHeaderText, { color: colors.text }]}>
                    Day {selectedDay} - {selectedDay === 1 ? "Ascent" : "Descent"}
                  </ThemedText>
                  <ThemedText style={[styles.dayHeaderSubtext, { color: colors.textSecondary }]}>
                    Checkpoints {selectedDay === 1 ? "1-8" : "9-16"}
                  </ThemedText>
                </View>
              )}
              
              <FlatList
                data={filteredCheckpoints}
                keyExtractor={(item) => item.id.toString()}
                numColumns={isDesktop ? 2 : 1}
                key={isDesktop ? `desktop-${selectedDay}` : `mobile-${selectedDay}`}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.checkpointOption,
                      item.id === settings.currentCheckpoint && {
                        backgroundColor: colors.primaryLight,
                      },
                      isDesktop && styles.checkpointOptionDesktop,
                    ]}
                    onPress={() => {
                      updateSettings({ currentCheckpoint: item.id });
                      setShowCheckpointPicker(false);
                    }}
                  >
                    <View style={styles.checkpointOptionInfo}>
                      <ThemedText style={styles.checkpointOptionNumber}>
                        #{item.number}
                      </ThemedText>
                      <ThemedText style={styles.checkpointOptionDesc}>
                        {item.description}
                      </ThemedText>
                      <View style={[styles.dayBadge, { backgroundColor: item.day === 1 ? colors.primaryLight : colors.successLight }]}>
                        <ThemedText style={[styles.dayBadgeText, { color: item.day === 1 ? colors.primary : colors.success }]}>
                          Day {item.day}
                        </ThemedText>
                      </View>
                    </View>
                    {item.id === settings.currentCheckpoint && (
                      <IconSymbol name="checkmark.circle.fill" size={24} color={colors.primary} />
                    )}
                  </Pressable>
                )}
                showsVerticalScrollIndicator={false}
                style={styles.checkpointList}
              />
            </Pressable>
          </Pressable>
        </Modal>
      </>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Premium Header with Gradient */}
      <LinearGradient
        colors={[colors.gradientPrimaryStart, colors.gradientPrimaryEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 10 }]}
      >
        <Animated.View entering={FadeInDown.delay(100)}>
          <ThemedText style={styles.headerTitle}>{t("app_name")}</ThemedText>
          <SyncStatusBar />
        </Animated.View>
        
        {/* Stats Row */}
        <Animated.View 
          entering={FadeInUp.delay(200)}
          style={styles.statsRow}
        >
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>{todayScans}</ThemedText>
            <ThemedText style={styles.statLabel}>{t("scanner_recent_scans")}</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>{participants.length}</ThemedText>
            <ThemedText style={styles.statLabel}>{t("nav_pilgrims")}</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>{currentCheckpoint?.number || 1}</ThemedText>
            <ThemedText style={styles.statLabel}>{t("nav_checkpoints")}</ThemedText>
          </View>
        </Animated.View>
      </LinearGradient>

      {/* Offline Banner */}
      <OfflineBanner />

      {/* Checkpoint Selector Card */}
      <Animated.View entering={FadeInUp.delay(300)}>
        <Pressable
          style={[styles.checkpointCard, { backgroundColor: colors.card }, Shadows.md]}
          onPress={() => setShowCheckpointPicker(true)}
        >
          <View style={[styles.checkpointIcon, { backgroundColor: colors.primaryLight }]}>
            <IconSymbol name="location.fill" size={24} color={colors.primary} />
          </View>
          <View style={styles.checkpointInfo}>
            <ThemedText style={[styles.checkpointLabel, { color: colors.textSecondary }]}>
              {t("scanner_select_checkpoint")}
            </ThemedText>
            <ThemedText style={styles.checkpointName}>
              #{currentCheckpoint?.number} - {currentCheckpoint?.description}
            </ThemedText>
          </View>
          <View style={[styles.chevronCircle, { backgroundColor: colors.backgroundSecondary }]}>
            <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
          </View>
        </Pressable>
      </Animated.View>

      {/* Scan Result Toast */}
      {lastScanResult && (
        <Animated.View
          entering={FadeIn.springify()}
          exiting={FadeOut}
          style={[
            styles.resultToast,
            {
              backgroundColor: lastScanResult.success ? colors.successLight : colors.errorLight,
              borderLeftColor: lastScanResult.success ? colors.success : colors.error,
            },
          ]}
        >
          <IconSymbol
            name={lastScanResult.success ? "checkmark.circle.fill" : "xmark.circle.fill"}
            size={28}
            color={lastScanResult.success ? colors.success : colors.error}
          />
          <View style={styles.resultTextContainer}>
            {lastScanResult.participantName && (
              <ThemedText style={styles.resultName}>
                {lastScanResult.participantName}
              </ThemedText>
            )}
            <ThemedText
              style={[
                styles.resultMessage,
                { color: lastScanResult.success ? colors.success : colors.error },
              ]}
            >
              {lastScanResult.message}
            </ThemedText>
          </View>
        </Animated.View>
      )}

      {/* Recent Scans Section */}
      <View style={styles.recentSection}>
        <ThemedText style={styles.sectionTitle}>{t("scanner_recent_scans")}</ThemedText>
        {recentScans.length > 0 ? (
          <FlatList
            data={recentScans}
            renderItem={renderRecentScan}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.recentList}
          />
        ) : (
          <Animated.View 
            entering={FadeIn.delay(400)}
            style={styles.emptyState}
          >
            <View style={[styles.emptyIcon, { backgroundColor: colors.backgroundSecondary }]}>
              <IconSymbol name="qrcode" size={40} color={colors.textTertiary} />
            </View>
            <ThemedText style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              {t("pilgrims_not_started")}
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
              {t("qr_card_scan_instruction")}
            </ThemedText>
          </Animated.View>
        )}
      </View>

      {/* Floating Scan Button */}
      <View style={[styles.scanButtonContainer, { paddingBottom: Math.max(insets.bottom, 20) + 70 }]}>
        {/* Pulse ring */}
        <Animated.View style={[styles.pulseRing, { backgroundColor: colors.primary }, pulseStyle]} />
        
        <AnimatedPressable
          style={[styles.scanButton, scanButtonStyle]}
          onPress={openScanner}
        >
          <LinearGradient
            colors={[colors.gradientPrimaryStart, colors.gradientPrimaryEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.scanButtonGradient}
          >
            <IconSymbol name="qrcode.viewfinder" size={48} color="#FFFFFF" />
          </LinearGradient>
        </AnimatedPressable>
      </View>

      {renderModals()}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Desktop styles
  desktopScrollView: {
    flex: 1,
  },
  desktopContent: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  desktopContainer: {
    width: "100%",
  },
  desktopHeader: {
    borderRadius: Radius["2xl"],
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  desktopHeaderContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  desktopStatsRow: {
    flexDirection: "row",
    gap: Spacing.xl,
  },
  desktopStatItem: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
  },
  desktopMainContent: {
    flexDirection: "row",
    gap: Spacing.xl,
  },
  desktopLeftColumn: {
    flex: 1,
    maxWidth: 400,
  },
  desktopRightColumn: {
    flex: 2,
  },
  desktopScanButtonContainer: {
    alignItems: "center",
    marginVertical: Spacing["2xl"],
  },
  desktopHint: {
    textAlign: "center",
    fontSize: Typography.size.sm,
  },
  desktopScansList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  desktopEmptyState: {
    paddingVertical: Spacing["3xl"],
  },
  recentScanItemDesktop: {
    width: "48%",
  },
  scannerFrameDesktop: {
    width: 400,
    height: 400,
  },
  pickerContainerDesktop: {
    maxWidth: 600,
    alignSelf: "center",
    marginHorizontal: "auto",
    borderRadius: Radius["2xl"],
    marginBottom: 100,
  },
  checkpointOptionDesktop: {
    flex: 1,
    margin: Spacing.xs,
  },
  // Mobile styles
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
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: Radius.lg,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: Typography.size.xl,
    fontWeight: Typography.weight.bold,
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: Typography.size.xs,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  checkpointCard: {
    flexDirection: "row",
    alignItems: "center",
    margin: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
  },
  checkpointIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  checkpointInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  checkpointLabel: {
    fontSize: Typography.size.sm,
    marginBottom: 2,
  },
  checkpointName: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  chevronCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  resultToast: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderLeftWidth: 4,
  },
  resultTextContainer: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  resultName: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  resultMessage: {
    fontSize: Typography.size.sm,
    marginTop: 2,
  },
  recentSection: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
    marginBottom: Spacing.md,
  },
  recentList: {
    paddingBottom: Spacing.xl,
  },
  recentScanItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  scanAvatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  recentScanInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  scanName: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
  },
  scanMeta: {
    fontSize: Typography.size.sm,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: Typography.size.md,
    textAlign: "center",
    lineHeight: 22,
  },
  scanButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pulseRing: {
    position: "absolute",
    width: SCAN_BUTTON_SIZE,
    height: SCAN_BUTTON_SIZE,
    borderRadius: SCAN_BUTTON_SIZE / 2,
    opacity: 0.3,
  },
  scanButton: {
    width: SCAN_BUTTON_SIZE,
    height: SCAN_BUTTON_SIZE,
    borderRadius: SCAN_BUTTON_SIZE / 2,
    ...Shadows.xl,
  },
  scanButtonGradient: {
    width: "100%",
    height: "100%",
    borderRadius: SCAN_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  scanButtonText: {
    color: "#FFFFFF",
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  scannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  scannerTitleContainer: {
    alignItems: "center",
  },
  scannerLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: Typography.size.sm,
  },
  scannerTitle: {
    color: "#FFFFFF",
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
  },
  scannerFrameContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  scannerFrame: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: "#FFFFFF",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scannerFooter: {
    alignItems: "center",
    paddingBottom: Spacing["3xl"],
  },
  scannerHint: {
    color: "rgba(255,255,255,0.8)",
    fontSize: Typography.size.md,
  },
  galleryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  galleryButtonText: {
    color: "#FFFFFF",
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerContainer: {
    borderTopLeftRadius: Radius["2xl"],
    borderTopRightRadius: Radius["2xl"],
    maxHeight: "70%",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  pickerTitle: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
  },
  checkpointList: {
    padding: Spacing.md,
  },
  checkpointOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  checkpointOptionInfo: {
    flex: 1,
  },
  checkpointOptionNumber: {
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.bold,
  },
  checkpointOptionDesc: {
    fontSize: Typography.size.md,
    marginTop: 2,
  },
  checkpointOptionDay: {
    fontSize: Typography.size.sm,
    marginTop: 4,
  },
  // Day picker styles
  dayPickerContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  dayHeaderText: {
    fontSize: Typography.size.md,
    fontWeight: Typography.weight.semibold,
  },
  dayHeaderSubtext: {
    fontSize: Typography.size.sm,
    marginLeft: "auto",
  },
  dayBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
    marginTop: Spacing.xs,
    alignSelf: "flex-start",
  },
  dayBadgeText: {
    fontSize: Typography.size.xs,
    fontWeight: Typography.weight.medium,
  },
});
