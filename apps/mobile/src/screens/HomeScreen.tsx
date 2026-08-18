import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, PipelineStage } from "../shared";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { AppStackParamList } from "../../App";
import { colors, shadows, spacing, borderRadius, typography } from "../theme";

type Mode = "selling" | "buying";

const STAGE_ICONS: Record<PipelineStage, string> = {
  prep_your_home: "\uD83C\uDFE0",
  price_it: "\uD83D\uDCB0",
  create_listing: "\uD83D\uDCDD",
  manage_showings: "\uD83D\uDCC5",
  review_offers: "\uD83D\uDCCB",
  close_the_deal: "\uD83C\uDF89",
};

const STAGE_COLORS: Record<PipelineStage, string> = {
  prep_your_home: "#DBEAFE",
  price_it: "#FEF3C7",
  create_listing: "#D1FAE5",
  manage_showings: "#E0E7FF",
  review_offers: "#FCE7F3",
  close_the_deal: "#FEF9C3",
};

const STAGE_DESCRIPTIONS: Record<PipelineStage, string> = {
  prep_your_home: "Get your home market-ready with our checklist",
  price_it: "AI-powered pricing analysis for your home",
  create_listing: "Build a compelling listing with AI descriptions",
  manage_showings: "Schedule and manage buyer showings",
  review_offers: "Analyze offers with AI-powered insights",
  close_the_deal: "Track closing checklist and costs",
};

const STAGE_CTA: Record<PipelineStage, string> = {
  prep_your_home: "Start prepping your home",
  price_it: "Get your AI price analysis",
  create_listing: "Build your listing",
  manage_showings: "Manage your showings",
  review_offers: "Review your offers",
  close_the_deal: "Finalize your sale",
};

const STAGE_NAV: Record<PipelineStage, keyof AppStackParamList> = {
  prep_your_home: "PrepHome",
  price_it: "Pricing",
  create_listing: "ListingBuilder",
  manage_showings: "Showings",
  review_offers: "Offers",
  close_the_deal: "Closing",
};

const SELLING_TIPS = [
  "First impressions matter — 90% of buyers start their search online. Great photos can make or break your listing.",
  "Homes that are priced right from the start sell 50% faster than those that need price reductions.",
  "Decluttering and depersonalizing can help buyers envision themselves in your home.",
  "The best time to sell is when you're ready — but spring and early summer often see the most buyer activity.",
  "Responding to showing requests within 1 hour can double your chances of receiving an offer.",
];

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [currentStage, setCurrentStage] = useState<PipelineStage>("prep_your_home");
  const [fullName, setFullName] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>("free");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<Mode>("selling");
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [upcomingShowings, setUpcomingShowings] = useState(0);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("current_stage, full_name, plan")
        .eq("id", user.id)
        .single();

      if (data?.current_stage) {
        setCurrentStage(data.current_stage as PipelineStage);
      }
      if (data?.full_name) {
        setFullName(data.full_name);
      }
      if (data?.plan) setPlan(data.plan);
    } catch {
      // Continue with defaults if profile fetch fails
    } finally {
      setLoadingProfile(false);
    }

    // Attention counters — what needs the user right now.
    try {
      const { count: unread } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("read", false);
      setUnreadMessages(unread || 0);

      const today = new Date().toISOString().slice(0, 10);
      const { count: showings } = await supabase
        .from("showings")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .eq("status", "confirmed")
        .gte("showing_date", today);
      setUpcomingShowings(showings || 0);
    } catch {
      // Non-critical
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile().finally(() => setRefreshing(false));
  }, [fetchProfile]);

  const currentIndex = PIPELINE_STAGES.indexOf(currentStage);
  const totalStages = PIPELINE_STAGES.length;
  const progress = (currentIndex + 1) / totalStages;

  const getStageState = (stage: PipelineStage): "complete" | "current" | "future" => {
    const stageIndex = PIPELINE_STAGES.indexOf(stage);
    if (stageIndex < currentIndex) return "complete";
    if (stageIndex === currentIndex) return "current";
    return "future";
  };

  const handleStageTap = (stage: PipelineStage) => {
    const target = STAGE_NAV[stage];
    navigation.navigate(target as any);
  };

  const firstName = fullName ? fullName.split(" ")[0] : null;

  // Profile button initials
  const profileInitials = useMemo(() => {
    if (!fullName) return null;
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }, [fullName]);

  // Rotating tip based on day
  const tipOfTheDay = useMemo(() => {
    const dayIndex = Math.floor(Date.now() / 86400000) % SELLING_TIPS.length;
    return SELLING_TIPS[dayIndex];
  }, []);

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryLight} />
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Buyer view
  // ---------------------------------------------------------------------------
  const renderBuyerView = () => (
    <>
      {renderAttention()}

      {/* Hero card */}
      <View style={styles.buyerHeroCard}>
        <Text style={styles.buyerHeroIcon}>{"\uD83C\uDFE1"}</Text>
        <Text style={styles.buyerHeroTitle}>Find Your Next Home</Text>
        <Text style={styles.buyerHeroDescription}>
          Browse FSBO listings, schedule showings, and make offers — all without agent fees.
        </Text>
        <TouchableOpacity
          style={styles.buyerHeroCta}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("Marketplace")}
        >
          <Text style={styles.buyerHeroCtaText}>Browse Marketplace</Text>
          <Text style={styles.buyerHeroCtaArrow}>{"\u2192"}</Text>
        </TouchableOpacity>
      </View>

      {/* Buyer action cards */}
      <View style={styles.buyerCardsGrid}>
        <TouchableOpacity
          style={styles.buyerCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Marketplace")}
        >
          <View style={styles.buyerCardIconWrap}>
            <Text style={styles.buyerCardIcon}>{"\uD83D\uDD0D"}</Text>
          </View>
          <View style={styles.buyerCardTextGroup}>
            <Text style={styles.buyerCardTitle}>Browse Marketplace</Text>
            <Text style={styles.buyerCardSubtitle}>Find FSBO homes near you</Text>
          </View>
          <Text style={styles.buyerCardArrow}>{"\u2192"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buyerCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Showings")}
        >
          <View style={[styles.buyerCardIconWrap, { backgroundColor: colors.accentLight }]}>
            <Text style={styles.buyerCardIcon}>{"\uD83D\uDCC5"}</Text>
          </View>
          <View style={styles.buyerCardTextGroup}>
            <Text style={styles.buyerCardTitle}>Your Showings</Text>
            <Text style={styles.buyerCardSubtitle}>Showings you've booked</Text>
          </View>
          <Text style={styles.buyerCardArrow}>{"\u2192"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buyerCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Messages")}
        >
          <View style={[styles.buyerCardIconWrap, { backgroundColor: "#F3E8FF" }]}>
            <Text style={styles.buyerCardIcon}>{"\uD83D\uDCAC"}</Text>
          </View>
          <View style={styles.buyerCardTextGroup}>
            <Text style={styles.buyerCardTitle}>Messages</Text>
            <Text style={styles.buyerCardSubtitle}>Chat with sellers</Text>
          </View>
          <Text style={styles.buyerCardArrow}>{"\u2192"}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  // ---------------------------------------------------------------------------
  // Seller view (existing)
  // ---------------------------------------------------------------------------
  const renderAttention = () => {
    if (unreadMessages === 0 && upcomingShowings === 0) return null;
    return (
      <View style={styles.attentionSection}>
        <Text style={styles.attentionTitle}>Needs your attention</Text>
        {unreadMessages > 0 && (
          <TouchableOpacity
            style={styles.attentionCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Messages")}
          >
            <Text style={styles.attentionIcon}>{"💬"}</Text>
            <Text style={styles.attentionText}>
              {unreadMessages} unread {unreadMessages === 1 ? "message" : "messages"} — buyers
              who reply fast sell fast
            </Text>
            <Text style={styles.attentionArrow}>{"→"}</Text>
          </TouchableOpacity>
        )}
        {upcomingShowings > 0 && (
          <TouchableOpacity
            style={styles.attentionCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("Showings")}
          >
            <Text style={styles.attentionIcon}>{"📅"}</Text>
            <Text style={styles.attentionText}>
              {upcomingShowings} upcoming {upcomingShowings === 1 ? "showing" : "showings"} on
              your calendar
            </Text>
            <Text style={styles.attentionArrow}>{"→"}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderSellerView = () => (
    <>
      {renderAttention()}

      {/* Hero / Current Stage Card */}
      <View style={styles.heroCard}>
        {/* Top accent strip */}
        <View style={styles.heroAccentStrip} />
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>YOU'RE HERE</Text>
          </View>
        </View>
        <View style={styles.heroBody}>
          <Text style={styles.heroIcon}>{STAGE_ICONS[currentStage]}</Text>
          <View style={styles.heroTextGroup}>
            <Text style={styles.heroTitle}>
              {PIPELINE_STAGE_LABELS[currentStage]}
            </Text>
            <Text style={styles.heroDescription}>
              {STAGE_CTA[currentStage]}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.heroCta}
          activeOpacity={0.8}
          onPress={() => handleStageTap(currentStage)}
        >
          <Text style={styles.heroCtaText}>Continue</Text>
          <Text style={styles.heroCtaArrow}>{"\u2192"}</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressLabelRow}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressStep}>
            Step {currentIndex + 1} of {totalStages}
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.progressDots}>
          {PIPELINE_STAGES.map((stage) => {
            const state = getStageState(stage);
            return (
              <View
                key={stage}
                style={[
                  styles.progressDot,
                  state === "complete" && styles.progressDotComplete,
                  state === "current" && styles.progressDotCurrent,
                  state === "future" && styles.progressDotFuture,
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* All Stages List */}
      <Text style={styles.sectionTitle}>All Stages</Text>
      <View style={styles.stagesList}>
        {PIPELINE_STAGES.map((stage) => {
          const state = getStageState(stage);
          return (
            <TouchableOpacity
              key={stage}
              style={[
                styles.stageCard,
                state === "complete" && styles.stageCardComplete,
                state === "current" && styles.stageCardCurrent,
              ]}
              activeOpacity={0.7}
              onPress={() => handleStageTap(stage)}
            >
              <View style={[styles.stageIconCircle, { backgroundColor: STAGE_COLORS[stage] }]}>
                <Text style={styles.stageIcon}>{STAGE_ICONS[stage]}</Text>
              </View>
              <View style={styles.stageTextGroup}>
                <Text style={styles.stageName}>
                  {PIPELINE_STAGE_LABELS[stage]}
                </Text>
                <Text style={styles.stageDescription}>
                  {STAGE_DESCRIPTIONS[stage]}
                </Text>
              </View>
              <View style={styles.stageStatus}>
                {state === "complete" && (
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkMark}>{"\u2713"}</Text>
                  </View>
                )}
                {state === "current" && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current</Text>
                  </View>
                )}
                {state === "future" && (
                  <Text style={styles.chevron}>{"\u203A"}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickActionsRow}
      >
        <TouchableOpacity
          style={styles.quickActionCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Documents")}
        >
          <Text style={styles.quickActionIcon}>{"\uD83D\uDCC4"}</Text>
          <Text style={styles.quickActionLabel}>Documents</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Closing")}
        >
          <Text style={styles.quickActionIcon}>{"\uD83E\uDDEE"}</Text>
          <Text style={styles.quickActionLabel}>Calculator</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Marketplace")}
        >
          <Text style={styles.quickActionIcon}>{"\uD83C\uDFD8\uFE0F"}</Text>
          <Text style={styles.quickActionLabel}>Marketplace</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("Syndication")}
        >
          <Text style={styles.quickActionIcon}>{"\uD83D\uDCE2"}</Text>
          <Text style={styles.quickActionLabel}>List Everywhere</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Tip of the Day */}
      <View style={styles.tipCard}>
        <View style={styles.tipHeader}>
          <Text style={styles.tipIcon}>{"\uD83D\uDCA1"}</Text>
          <Text style={styles.tipTitle}>Tip of the Day</Text>
        </View>
        <Text style={styles.tipText}>{tipOfTheDay}</Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryLight} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              {firstName ? `Welcome, ${firstName}!` : "Welcome back!"}
            </Text>
            <Text style={styles.subtitle}>
              {mode === "selling" ? "Your home selling journey" : "Find your dream home"}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Profile" as any)}
              style={styles.profileButton}
              activeOpacity={0.7}
            >
              {profileInitials ? (
                <Text style={styles.profileInitials}>{profileInitials}</Text>
              ) : (
                <Text style={styles.profileFallbackIcon}>{"\uD83D\uDC64"}</Text>
              )}
            </TouchableOpacity>
            {plan === "full_service" && (
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityBadgeText}>⭐ Priority</Text>
              </View>
            )}
          </View>
        </View>

        {/* Mode toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              mode === "selling" && styles.toggleOptionActive,
            ]}
            activeOpacity={0.7}
            onPress={() => setMode("selling")}
          >
            <Text
              style={[
                styles.toggleText,
                mode === "selling" && styles.toggleTextActive,
              ]}
            >
              Selling
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              mode === "buying" && styles.toggleOptionActive,
            ]}
            activeOpacity={0.7}
            onPress={() => setMode("buying")}
          >
            <Text
              style={[
                styles.toggleText,
                mode === "buying" && styles.toggleTextActive,
              ]}
            >
              Buying
            </Text>
          </TouchableOpacity>
        </View>

        {mode === "selling" ? renderSellerView() : renderBuyerView()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* -- Layout -- */
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  /* -- Header -- */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  greeting: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitials: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  profileFallbackIcon: {
    fontSize: 18,
  },
  priorityBadge: {
    backgroundColor: colors.accentLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginLeft: spacing.sm,
  },
  priorityBadgeText: {
    ...typography.smallBold,
    color: colors.accentDark,
  },

  /* -- Mode Toggle -- */
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: colors.borderLight,
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.lg,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    borderRadius: borderRadius.sm,
  },
  toggleOptionActive: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  toggleText: {
    ...typography.bodyBold,
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.primary,
  },

  /* -- Hero Card (Seller) -- */
  heroCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primaryLight,
    padding: spacing.lg,
    paddingTop: 0,
    marginBottom: spacing.lg,
    overflow: "hidden",
    ...shadows.md,
  },
  heroAccentStrip: {
    height: 4,
    backgroundColor: colors.primaryLight,
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.lg,
  },
  heroBadgeRow: {
    flexDirection: "row",
    marginBottom: spacing.md,
  },
  heroBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  heroBadgeText: {
    ...typography.smallBold,
    color: colors.white,
    letterSpacing: 0.8,
  },
  heroBody: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  heroIcon: {
    fontSize: 40,
    marginRight: spacing.md,
  },
  heroTextGroup: {
    flex: 1,
  },
  heroTitle: {
    ...typography.h2,
    color: colors.primary,
  },
  heroDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.md - 2,
    borderRadius: borderRadius.md,
  },
  heroCtaText: {
    ...typography.bodyBold,
    color: colors.white,
  },
  heroCtaArrow: {
    fontSize: 18,
    color: colors.white,
    marginLeft: spacing.sm,
  },

  /* -- Progress -- */
  progressSection: {
    marginBottom: spacing.lg,
  },
  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  progressLabel: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  progressStep: {
    ...typography.small,
    color: colors.textSecondary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
  },
  progressDots: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressDotComplete: {
    backgroundColor: colors.accent,
  },
  progressDotCurrent: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  progressDotFuture: {
    backgroundColor: colors.border,
  },

  /* -- Section -- */
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  /* -- Stage Cards -- */
  stagesList: {
    marginBottom: spacing.lg,
    gap: spacing.sm + 2,
  },
  stageCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
    ...shadows.sm,
  },
  stageCardComplete: {
    borderLeftColor: colors.accent,
  },
  stageCardCurrent: {
    borderLeftColor: colors.primaryLight,
  },
  stageIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  stageIcon: {
    fontSize: 22,
  },
  stageTextGroup: {
    flex: 1,
    marginRight: spacing.sm,
  },
  stageName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  stageDescription: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stageStatus: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 32,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: colors.accentDark,
    fontSize: 15,
    fontWeight: "700",
  },
  currentBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  currentBadgeText: {
    ...typography.smallBold,
    color: colors.primaryLight,
  },
  chevron: {
    fontSize: 24,
    color: colors.textMuted,
    fontWeight: "300",
  },

  /* -- Quick Actions -- */
  quickActionsRow: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  quickActionCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 130,
    ...shadows.sm,
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  quickActionLabel: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },

  /* -- Tip of the Day -- */
  tipCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.amberLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.amber,
  },
  attentionSection: {
    marginBottom: spacing.lg,
  },
  attentionTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  attentionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primaryLight,
    ...shadows.sm,
  },
  attentionIcon: {
    fontSize: 22,
    marginRight: spacing.md,
  },
  attentionText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 19,
  },
  attentionArrow: {
    ...typography.bodyBold,
    color: colors.primaryLight,
    marginLeft: spacing.sm,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  tipIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  tipTitle: {
    ...typography.captionBold,
    color: colors.amberDark,
  },
  tipText: {
    ...typography.caption,
    color: colors.amberDark,
    lineHeight: 22,
  },

  /* -- Buyer View -- */
  buyerHeroCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  buyerHeroIcon: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  buyerHeroTitle: {
    ...typography.h1,
    color: colors.primary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  buyerHeroDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  buyerHeroCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    width: "100%",
    ...shadows.sm,
  },
  buyerHeroCtaText: {
    ...typography.bodyBold,
    color: colors.white,
  },
  buyerHeroCtaArrow: {
    fontSize: 18,
    color: colors.white,
    marginLeft: spacing.sm,
  },
  buyerCardsGrid: {
    gap: spacing.md,
  },
  buyerCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    ...shadows.sm,
  },
  buyerCardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  buyerCardIcon: {
    fontSize: 22,
  },
  buyerCardTextGroup: {
    flex: 1,
    marginRight: spacing.sm,
  },
  buyerCardTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  buyerCardSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  buyerCardArrow: {
    fontSize: 18,
    color: colors.textMuted,
  },
});

