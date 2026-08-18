import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import QRCode from "react-native-qrcode-svg";
import { useKeepAwake } from "expo-keep-awake";
import type { AppStackParamList } from "../../App";
import { supabase } from "../lib/supabase";
import { colors, shadows, spacing, borderRadius, typography } from "../theme";

interface ListingSummary {
  id: string;
  address: string;
  city: string;
  state: string;
}

export default function OpenHouseScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "OpenHouse">>();
  const { listingId } = route.params;

  // Keep the screen on while visitors sign in at the door.
  useKeepAwake();

  const [listing, setListing] = useState<ListingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const signInUrl = `https://gochiavi.com/open-house/${listingId}`;

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("listings")
          .select("id, address, city, state")
          .eq("id", listingId)
          .single();
        if (data) setListing(data as ListingSummary);
      } finally {
        setLoading(false);
      }
    })();
  }, [listingId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primaryLight} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{"←"} Exit Open House Mode</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.welcome}>Welcome to our Open House</Text>
          {listing && (
            <Text style={styles.address}>
              {listing.address}
              {listing.city ? `\n${listing.city}, ${listing.state}` : ""}
            </Text>
          )}

          <View style={styles.qrWrap}>
            <QRCode value={signInUrl} size={220} color={colors.textPrimary} backgroundColor="#FFFFFF" />
          </View>

          <Text style={styles.instruction}>
            Scan with your phone camera to sign in
          </Text>
          <Text style={styles.subInstruction}>
            Takes 20 seconds — no app download needed
          </Text>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>How it works</Text>
          <Text style={styles.tipText}>
            Set this screen (or a printout of the QR code) by your front door.
            Visitors scan it and enter their name and contact info. Every
            sign-in lands in your Messages, so you can follow up with every
            person who walked through — the same day.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backText: {
    ...typography.body,
    color: colors.primaryLight,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: "center",
    ...shadows.md,
  },
  welcome: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  address: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  qrWrap: {
    padding: spacing.md,
    backgroundColor: "#FFFFFF",
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },
  instruction: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: "center",
  },
  subInstruction: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  tipCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primaryLight,
    ...shadows.sm,
  },
  tipTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  tipText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
