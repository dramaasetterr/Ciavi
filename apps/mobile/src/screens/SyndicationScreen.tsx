import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../App';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors, shadows, spacing, borderRadius, typography } from '../theme';
import TierGate from '../components/TierGate';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ListingSummary {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  year_built?: number;
  hoa_fee?: number | null;
  title?: string;
  property_type: string;
  description: string;
  status: string;
}

interface PlatformInfo {
  key: string;
  icon: string;
  name: string;
  getStatus: (listing: ListingSummary | null) => 'listed' | 'not_listed';
  instructions: string[];
}

const PLATFORMS: PlatformInfo[] = [
  {
    key: 'chiavi',
    icon: '🏠',
    name: 'Chiavi Marketplace',
    getStatus: (listing) => (listing?.status === 'active' ? 'listed' : 'not_listed'),
    instructions: [
      'Your listing is automatically published on the Chiavi Marketplace when you set it to active.',
      'Buyers can find your home, schedule showings, and contact you directly.',
    ],
  },
  {
    key: 'zillow',
    icon: '🔵',
    name: 'Zillow / Trulia',
    getStatus: () => 'not_listed',
    instructions: [
      '1. Go to zillow.com/sell and click "List your home for free"',
      '2. Sign in or create a Zillow account',
      '3. Enter your property address and confirm ownership',
      '4. Add photos, description, and pricing details',
      '5. Select "For Sale By Owner" as your listing type',
      '6. Review and publish — your listing will also appear on Trulia',
      'Tip: Zillow FSBO listings are completely free!',
    ],
  },
  {
    key: 'realtor',
    icon: '🔴',
    name: 'Realtor.com',
    getStatus: () => 'not_listed',
    instructions: [
      '1. Visit realtor.com/sell/list-your-home',
      '2. Create an account or sign in',
      '3. Enter your property address',
      '4. Upload photos and fill in property details',
      '5. Set your asking price and contact preferences',
      '6. Publish your FSBO listing',
      'Note: Basic FSBO listings on Realtor.com are free.',
    ],
  },
  {
    key: 'facebook',
    icon: '📘',
    name: 'Facebook Marketplace',
    getStatus: () => 'not_listed',
    instructions: [
      '1. Open Facebook and go to Marketplace',
      '2. Click "Create New Listing" then select "Home for Sale"',
      '3. Add your property photos (use the ones from your Chiavi listing)',
      '4. Fill in price, address, bedrooms, bathrooms, and square footage',
      '5. Write a compelling description',
      '6. Publish — your listing will be visible to local buyers',
      'Tip: Facebook Marketplace reaches a massive local audience for free!',
    ],
  },
  {
    key: 'mls',
    icon: '🏢',
    name: 'Flat-Fee MLS',
    getStatus: () => 'not_listed',
    instructions: [
      'The MLS (Multiple Listing Service) is the main database real estate agents use to find homes.',
      'As a FSBO seller, you can get MLS access through flat-fee services:',
      '',
      'Popular services:',
      '• Houzeo ($399) — Full MLS listing + contract support',
      '• Beycome ($99-299) — MLS listing in select states',
      '• ISoldMyHouse.com ($299) — MLS listing nationwide',
      '',
      'What you get:',
      '• Your home appears on agent searches',
      '• Syndication to hundreds of real estate websites',
      '• Professional-level exposure',
      '',
      'Note: You may need to offer a buyer agent commission (typically 2-3%).',
    ],
  },
  {
    key: 'craigslist',
    icon: '📋',
    name: 'Craigslist',
    getStatus: () => 'not_listed',
    instructions: [
      '1. Go to craigslist.org and select your city',
      '2. Click "Create a Posting" and choose "housing offered"',
      '3. Select "real estate - by owner"',
      '4. Add your listing details, photos, and price',
      '5. Include "FSBO" in the title for clarity',
      '6. Post and renew every few days for visibility',
      'Tip: Craigslist is free and great for reaching local bargain hunters!',
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SyndicationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [listing, setListing] = useState<ListingSummary | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('listings')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) setListing(data as ListingSummary);
      } catch (err) {
        Alert.alert("Error", "Failed to load listing data. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const toggleExpand = useCallback((key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedKey((prev) => (prev === key ? null : key));
  }, []);

  const buildListingText = (): string => {
    if (!listing) return 'No listing data available.';
    const typeLabel = (listing.property_type || 'N/A')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const lines = [
      `FOR SALE BY OWNER`,
      ``,
    ];
    if (listing.title) lines.push(listing.title, ``);
    lines.push(
      `${listing.address}`,
      `${listing.city || ''}${listing.city ? ', ' : ''}${listing.state || ''} ${listing.zip || ''}`.trim(),
      ``,
      `Price: $${listing.price?.toLocaleString()}`,
      `Bedrooms: ${listing.bedrooms ?? 'N/A'}`,
      `Bathrooms: ${listing.bathrooms ?? 'N/A'}`,
      `Square Feet: ${listing.sqft?.toLocaleString() ?? 'N/A'}`,
      `Property Type: ${typeLabel}`,
    );
    if (listing.year_built) lines.push(`Year Built: ${listing.year_built}`);
    if (listing.hoa_fee != null) lines.push(`HOA: $${listing.hoa_fee}/mo`);
    lines.push(``);
    if (listing.description) {
      lines.push(`Description:`, listing.description, ``);
    }
    lines.push(
      `Full listing with photos: https://gochiavi.com/show/${listing.id}`,
      ``,
      `Listed on Chiavi — sell your home without an agent.`
    );
    return lines.join('\n');
  };

  const copyListingDetails = async () => {
    const text = buildListingText();
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied!', 'Listing details copied to clipboard.');
    } catch {
      Alert.alert('Error', 'Could not copy to clipboard.');
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <TierGate feature="syndication">
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primaryLight} />
          </View>
        </SafeAreaView>
      </TierGate>
    );
  }

  return (
    <TierGate feature="syndication">
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Back button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>List Everywhere</Text>
          <Text style={styles.subtitle}>
            Get maximum exposure for your listing
          </Text>
        </View>

        {/* Copy Listing Kit */}
        <TouchableOpacity style={styles.copyAllButton} onPress={copyListingDetails}>
          <Text style={styles.copyAllIcon}>📋</Text>
          <Text style={styles.copyAllText}>Copy Listing Kit</Text>
        </TouchableOpacity>
        <Text style={styles.copyAllHint}>
          One tap copies your headline, description, specs, and listing link —
          ready to paste into any site below.
        </Text>

        {/* Platform cards */}
        {PLATFORMS.map((platform) => {
          const status = platform.getStatus(listing);
          const expanded = expandedKey === platform.key;

          return (
            <View key={platform.key} style={styles.platformCard}>
              {/* Header row */}
              <TouchableOpacity
                style={styles.platformHeader}
                onPress={() => toggleExpand(platform.key)}
                activeOpacity={0.7}
              >
                <Text style={styles.platformIcon}>{platform.icon}</Text>
                <View style={styles.platformTextGroup}>
                  <Text style={styles.platformName}>{platform.name}</Text>
                  {status === 'listed' ? (
                    <View style={styles.statusListed}>
                      <Text style={styles.statusListedText}>✅ Already Listed</Text>
                    </View>
                  ) : (
                    <View style={styles.statusNotListed}>
                      <Text style={styles.statusNotListedText}>Not Listed</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {/* Expandable instructions */}
              {expanded && (
                <View style={styles.instructionsContainer}>
                  <Text style={styles.instructionsTitle}>How to List</Text>
                  {platform.instructions.map((line, idx) => (
                    <Text key={idx} style={styles.instructionLine}>
                      {line}
                    </Text>
                  ))}

                  {/* Copy button per platform */}
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={copyListingDetails}
                  >
                    <Text style={styles.copyButtonText}>📋 Copy Listing Details</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
    </TierGate>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  backButton: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  backText: {
    ...typography.body,
    color: colors.primaryLight,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Copy All
  copyAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    gap: spacing.sm,
    ...shadows.md,
  },
  copyAllHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  copyAllIcon: {
    fontSize: 18,
  },
  copyAllText: {
    ...typography.bodyBold,
    color: colors.white,
  },

  // Platform card
  platformCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  platformIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  platformTextGroup: {
    flex: 1,
  },
  platformName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  statusListed: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusListedText: {
    ...typography.small,
    color: colors.accent,
    fontWeight: '600',
  },
  statusNotListed: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusNotListedText: {
    ...typography.small,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },

  // Instructions
  instructionsContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.md,
  },
  instructionsTitle: {
    ...typography.captionBold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  instructionLine: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  copyButton: {
    backgroundColor: colors.primarySoft,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  copyButtonText: {
    ...typography.captionBold,
    color: colors.primaryLight,
  },
});
