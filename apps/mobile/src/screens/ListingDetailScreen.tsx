import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../App';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors, shadows, spacing, borderRadius, typography } from '../theme';
import { PROPERTY_TYPE_LABELS } from '../shared';

const formatPropertyType = (raw: string | null | undefined): string => {
  if (!raw) return 'N/A';
  return (
    (PROPERTY_TYPE_LABELS as Record<string, string>)[raw] ??
    raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Listing {
  id: string;
  user_id: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  year_built: number;
  property_type: string;
  description: string;
  photos: string[];
  hoa_fee: number | null;
  lot_size: string | null;
  status: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ListingDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'ListingDetail'>>();
  const { listingId } = route.params;

  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setFetchError(false);
        const { data, error } = await supabase
          .from('listings')
          .select('*')
          .eq('id', listingId)
          .single();

        if (error) {
          setFetchError(true);
        } else {
          setListing(data as Listing);
        }
      } catch {
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [listingId]);

  useEffect(() => {
    if (!user) return;
    supabase.from('favorites').select('id').eq('user_id', user.id).eq('listing_id', listingId).then(({ data }) => {
      if (data && data.length > 0) setIsSaved(true);
    });
  }, [user, listingId]);

  const toggleSave = async () => {
    if (!user) { Alert.alert('Sign In Required', 'Please sign in to save listings.'); return; }
    setIsSaved(!isSaved);
    if (isSaved) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('listing_id', listingId);
    } else {
      await supabase.from('favorites').insert({ user_id: user.id, listing_id: listingId });
    }
  };

  const callSeller = async () => {
    if (!listing) return;
    try {
      const { data } = await supabase.from('profiles').select('phone').eq('id', listing.user_id).single();
      if (data?.phone) {
        Linking.openURL(`tel:${data.phone}`);
      } else {
        Alert.alert('No Phone Number', 'This seller hasn\'t added a phone number. You can message them instead.', [
          { text: 'Message', onPress: () => navigation.navigate('ContactSeller', { listingId: listing.id }) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    } catch { Alert.alert('Error', 'Could not fetch seller info.'); }
  };

  const handleShare = async () => {
    if (!listing) return;
    try {
      await Share.share({
        message: `${listing.address}, ${listing.city}, ${listing.state} — $${listing.price?.toLocaleString()} · For Sale By Owner on Chiavi\nhttps://gochiavi.com/show/${listing.id}`,
        url: `https://gochiavi.com/show/${listing.id}`,
      });
    } catch (err) {
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryLight} />
        </View>
      </SafeAreaView>
    );
  }

  if (!listing) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>
            {fetchError ? 'Something went wrong. Please check your connection.' : 'Listing not found.'}
          </Text>
          {fetchError && (
            <TouchableOpacity
              style={styles.showingButton}
              activeOpacity={0.8}
              onPress={() => { setLoading(true); setFetchError(false); }}
            >
              <Text style={styles.showingButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const photos = listing.photos || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Back + Share row */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <TouchableOpacity onPress={toggleSave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 22 }}>{isSaved ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
              <Text style={styles.shareText}>Share ↗</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Photo carousel */}
        <View style={styles.carouselContainer}>
          {photos.length > 0 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
                  setActivePhotoIndex(idx);
                }}
              >
                {photos.map((url, i) => (
                  <View key={i} style={[styles.carouselSlide, { width: SCREEN_WIDTH }]}>
                    <Image source={{ uri: url }} style={styles.carouselImage} resizeMode="cover" />
                  </View>
                ))}
              </ScrollView>
              {/* Dots */}
              <View style={styles.dotsRow}>
                {photos.map((_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, i === activePhotoIndex && styles.dotActive]}
                  />
                ))}
              </View>
            </>
          ) : (
            <View style={styles.noPhotoPlaceholder}>
              <Text style={styles.noPhotoText}>🏠</Text>
              <Text style={styles.noPhotoLabel}>No photos available</Text>
            </View>
          )}
        </View>

        {/* Price hero */}
        <View style={styles.priceSection}>
          <Text style={styles.priceHero}>${listing.price?.toLocaleString()}</Text>
          <Text style={styles.addressHero}>{listing.address}</Text>
          <Text style={styles.cityStateHero}>
            {listing.city}, {listing.state} {listing.zip_code}
          </Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {listing.bedrooms != null && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{listing.bedrooms}</Text>
              <Text style={styles.statLabel}>Beds</Text>
            </View>
          )}
          {listing.bathrooms != null && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{listing.bathrooms}</Text>
              <Text style={styles.statLabel}>Baths</Text>
            </View>
          )}
          {listing.sqft != null && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{listing.sqft.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Sqft</Text>
            </View>
          )}
          {listing.year_built != null && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{listing.year_built}</Text>
              <Text style={styles.statLabel}>Year Built</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {listing.description ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{listing.description}</Text>
          </View>
        ) : null}

        {/* Property Details */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Property Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>{formatPropertyType(listing.property_type)}</Text>
          </View>
          {listing.year_built != null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Year Built</Text>
              <Text style={styles.detailValue}>{listing.year_built}</Text>
            </View>
          )}
          {listing.sqft != null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Square Feet</Text>
              <Text style={styles.detailValue}>{listing.sqft.toLocaleString()}</Text>
            </View>
          )}
          {listing.price != null && listing.sqft ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Price per Sqft</Text>
              <Text style={styles.detailValue}>
                ${Math.round(listing.price / listing.sqft).toLocaleString()}
              </Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>HOA</Text>
            <Text style={styles.detailValue}>
              {listing.hoa_fee != null ? `$${listing.hoa_fee}/mo` : 'None'}
            </Text>
          </View>
          {listing.lot_size != null && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Lot Size</Text>
              <Text style={styles.detailValue}>{listing.lot_size}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Sale Type</Text>
            <Text style={styles.detailValue}>For Sale By Owner</Text>
          </View>
        </View>

        {user?.id === listing.user_id ? (
          <>
            {/* Owner actions */}
            <View style={{ flexDirection: 'row', marginHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md }}>
              <TouchableOpacity
                style={[styles.showingButton, { flex: 1, marginHorizontal: 0 }]}
                activeOpacity={0.8}
                onPress={handleShare}
              >
                <Text style={styles.showingButtonText}>📣 Share Listing</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactSellerButton, { flex: 1, marginHorizontal: 0 }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('OpenHouse', { listingId: listing.id })}
              >
                <Text style={styles.contactSellerButtonText}>🚪 Open House Mode</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.showingButton}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Syndication')}
            >
              <Text style={styles.showingButtonText}>🌐 Get Listed Everywhere</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Buyer actions */}
            <View style={{ flexDirection: 'row', marginHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md }}>
              <TouchableOpacity
                style={[styles.showingButton, { flex: 1, marginHorizontal: 0 }]}
                activeOpacity={0.8}
                onPress={callSeller}
              >
                <Text style={styles.showingButtonText}>📞 Call Seller</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactSellerButton, { flex: 1, marginHorizontal: 0 }]}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('ContactSeller', { listingId: listing.id })}
              >
                <Text style={styles.contactSellerButtonText}>✉️ Message</Text>
              </TouchableOpacity>
            </View>

            {/* Schedule Showing */}
            <TouchableOpacity
              style={styles.showingButton}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('BookShowing', { listingId: listing.id })}
            >
              <Text style={styles.showingButtonText}>📅 Schedule a Showing</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Make an Offer info */}
        <View style={styles.offerInfoCard}>
          <Text style={styles.offerInfoIcon}>💰</Text>
          <Text style={styles.offerInfoTitle}>Interested in Making an Offer?</Text>
          <Text style={styles.offerInfoBody}>
            This is a For Sale By Owner (FSBO) listing. To make an offer, schedule a showing
            first and then discuss terms directly with the seller. You can bring your own agent
            or attorney to help with the transaction.
          </Text>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
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
    paddingBottom: spacing.xxl,
  },
  errorText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  backButton: {
    paddingVertical: spacing.xs,
  },
  backText: {
    ...typography.body,
    color: colors.primaryLight,
  },
  shareButton: {
    paddingVertical: spacing.xs,
  },
  shareText: {
    ...typography.bodyBold,
    color: colors.primaryLight,
  },

  // Carousel
  carouselContainer: {
    height: 260,
    backgroundColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  carouselSlide: {
    width: SCREEN_WIDTH,
    height: 260,
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  noPhotoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.borderLight,
  },
  noPhotoText: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  noPhotoLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    gap: spacing.xs + 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: colors.white,
    width: 20,
  },

  // Price section
  priceSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  priceHero: {
    ...typography.hero,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  addressHero: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  cityStateHero: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
    color: colors.primaryLight,
  },
  statLabel: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Section cards
  sectionCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  descriptionText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  detailValue: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },

  // Showing button
  showingButton: {
    backgroundColor: colors.accent,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  showingButtonText: {
    ...typography.bodyBold,
    color: colors.white,
  },

  // Contact seller
  contactSellerButton: {
    backgroundColor: colors.primaryLight,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  contactSellerButtonText: {
    ...typography.bodyBold,
    color: colors.white,
  },

  // Offer info
  offerInfoCard: {
    backgroundColor: colors.amberLight,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.amber,
    alignItems: 'center',
  },
  offerInfoIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  offerInfoTitle: {
    ...typography.h3,
    color: colors.amberDark,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  offerInfoBody: {
    ...typography.caption,
    color: colors.amberDark,
    lineHeight: 20,
    textAlign: 'center',
  },
});
