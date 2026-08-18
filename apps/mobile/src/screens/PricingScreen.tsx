import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Switch,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AppStackParamList } from "../../App";
import type {
  PricingInput,
  PropertyCondition,
  PoolType,
  PoolFeature,
  PremiumFinish,
  OutdoorFeature,
} from "../shared";
import {
  PREMIUM_FINISHES,
  OUTDOOR_FEATURES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
} from "../shared";
import { uploadPhoto } from "../lib/uploadImage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, shadows, spacing, borderRadius, typography } from "../theme";
import AddressAutocomplete from "../components/AddressAutocomplete";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

const CONDITIONS: PropertyCondition[] = ["Excellent", "Good", "Fair", "Needs Work"];
const CONDITION_ICONS: Record<PropertyCondition, string> = {
  Excellent: "\u2728",
  Good: "\u{1F44D}",
  Fair: "\u{1F6E0}",
  "Needs Work": "\u{1F527}",
};

const POOL_TYPES: { key: PoolType; label: string }[] = [
  { key: "none", label: "No Pool" },
  { key: "above_ground", label: "Above Ground" },
  { key: "in_ground", label: "In-Ground" },
];

const POOL_FEATURE_OPTIONS: { key: PoolFeature; label: string }[] = [
  { key: "saltwater", label: "Saltwater" },
  { key: "heated", label: "Heated" },
  { key: "infinity_edge", label: "Infinity Edge" },
  { key: "indoor", label: "Indoor" },
];

const PREMIUM_FINISH_LABELS: Record<PremiumFinish, string> = {
  marble_countertops: "Marble Counters",
  granite_countertops: "Granite Counters",
  quartz_countertops: "Quartz Counters",
  hardwood_floors: "Hardwood Floors",
  heated_floors: "Heated Floors",
  custom_millwork: "Custom Millwork",
  chef_kitchen: "Chef's Kitchen",
  smart_home: "Smart Home",
  wine_cellar: "Wine Cellar",
  home_theater: "Home Theater",
  sauna: "Sauna",
  gym: "Home Gym",
  elevator: "Elevator",
  vaulted_ceilings: "Vaulted Ceilings",
  skylights: "Skylights",
  floor_to_ceiling_windows: "Floor-to-Ceiling Windows",
  fireplace: "Fireplace",
  butler_pantry: "Butler's Pantry",
  walk_in_closets: "Walk-in Closets",
  designer_bathrooms: "Designer Bathrooms",
};

const OUTDOOR_FEATURE_LABELS: Record<OutdoorFeature, string> = {
  fire_pit: "Fire Pit",
  outdoor_kitchen: "Outdoor Kitchen",
  bbq_patio: "BBQ Patio",
  covered_patio: "Covered Patio",
  deck: "Deck",
  pergola: "Pergola",
  gazebo: "Gazebo",
  koi_pond: "Koi Pond",
  water_feature: "Water Feature",
  landscape_lighting: "Landscape Lighting",
  sprinkler_system: "Sprinkler System",
  playground: "Playground",
  sport_court: "Sport Court",
  tennis_court: "Tennis Court",
  fenced_yard: "Fenced Yard",
  gated: "Gated",
  mountain_view: "Mountain View",
  water_view: "Water View",
  city_view: "City View",
  privacy_trees: "Privacy Trees",
};

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const MAX_PRICING_PHOTOS = 8;

export default function PricingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();

  // Basics
  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState<(typeof PROPERTY_TYPES)[number]>("single_family");
  const [sqft, setSqft] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [condition, setCondition] = useState<PropertyCondition>("Good");

  // Lot & parking
  const [lotSize, setLotSize] = useState("");
  const [garageSpaces, setGarageSpaces] = useState("");
  const [parkingSpaces, setParkingSpaces] = useState("");

  // Pool
  const [poolType, setPoolType] = useState<PoolType>("none");
  const [poolFeatures, setPoolFeatures] = useState<PoolFeature[]>([]);
  const [poolHasSpa, setPoolHasSpa] = useState(false);
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const [autofilledFromRecords, setAutofilledFromRecords] = useState(false);

  const togglePoolFeature = (feature: PoolFeature) => {
    setPoolFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature]
    );
  };

  // Basement
  const [finishedBasementSqft, setFinishedBasementSqft] = useState("");
  const [basementIsAdu, setBasementIsAdu] = useState(false);

  // Premium / outdoor
  const [premiumFinishes, setPremiumFinishes] = useState<PremiumFinish[]>([]);
  const [outdoorFeatures, setOutdoorFeatures] = useState<OutdoorFeature[]>([]);

  // Appraisal anchor
  const [appraisalValue, setAppraisalValue] = useState("");
  const [appraisalDate, setAppraisalDate] = useState("");

  // Photos
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // Free text
  const [features, setFeatures] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const togglePremium = (f: PremiumFinish) => {
    setPremiumFinishes((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };
  const toggleOutdoor = (f: OutdoorFeature) => {
    setOutdoorFeatures((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
    );
  };

  const pickPhotos = async () => {
    const remaining = MAX_PRICING_PHOTOS - photos.length;
    if (remaining <= 0) {
      Alert.alert("Limit Reached", `Maximum ${MAX_PRICING_PHOTOS} photos.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Needed", "Please allow photo access to upload images.");
      return;
    }
    setProcessingPhotos(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.75,
      });
      if (!result.canceled && result.assets) {
        setPhotos((prev) => [...prev, ...result.assets].slice(0, MAX_PRICING_PHOTOS));
      }
    } finally {
      setProcessingPhotos(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPhotosToSupabase = async (): Promise<string[]> => {
    if (!user || photos.length === 0) return [];
    setUploadingPhotos(true);
    const urls: string[] = [];
    let failedCount = 0;
    try {
      for (let i = 0; i < photos.length; i++) {
        try {
          const fileName = `${user.id}/pricing_${Date.now()}_${i}.jpg`;
          const publicUrl = await uploadPhoto("listing-photos", fileName, photos[i].uri);
          urls.push(publicUrl);
        } catch {
          failedCount++;
        }
      }
    } finally {
      setUploadingPhotos(false);
    }
    if (failedCount > 0) {
      Alert.alert(
        "Photo Upload",
        `${failedCount} photo(s) could not be uploaded. The analysis will use the ${urls.length} that succeeded.`
      );
    }
    return urls;
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!address || !sqft || !bedrooms || !bathrooms || !yearBuilt) {
      setErrorMessage(
        "Please fill in address, square footage, bedrooms, bathrooms, and year built."
      );
      return;
    }

    setLoading(true);
    try {
      const photoUrls = await uploadPhotosToSupabase();

      const input: PricingInput = {
        address,
        property_type: propertyType,
        sqft: parseInt(sqft, 10),
        bedrooms: parseInt(bedrooms, 10),
        bathrooms: parseFloat(bathrooms),
        year_built: parseInt(yearBuilt, 10),
        condition,
        ...(lotSize ? { lot_size_sqft: parseInt(lotSize, 10) } : {}),
        ...(garageSpaces ? { garage_spaces: parseInt(garageSpaces, 10) } : {}),
        ...(parkingSpaces ? { parking_spaces: parseInt(parkingSpaces, 10) } : {}),
        ...(poolType !== "none"
          ? {
              pool_type: poolType,
              pool_has_spa: poolHasSpa,
              ...(poolFeatures.length > 0 ? { pool_features: poolFeatures } : {}),
            }
          : {}),
        ...(finishedBasementSqft
          ? {
              finished_basement_sqft: parseInt(finishedBasementSqft, 10),
              basement_is_adu: basementIsAdu,
            }
          : {}),
        ...(premiumFinishes.length ? { premium_finishes: premiumFinishes } : {}),
        ...(outdoorFeatures.length ? { outdoor_features: outdoorFeatures } : {}),
        ...(appraisalValue
          ? {
              recent_appraisal_value: parseInt(appraisalValue, 10),
              ...(appraisalDate ? { recent_appraisal_date: appraisalDate } : {}),
            }
          : {}),
        ...(photoUrls.length ? { photos: photoUrls } : {}),
        ...(features.trim() ? { features: features.trim() } : {}),
      };

      const res = await fetch(`${API_BASE}/api/pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) throw new Error("Failed to get pricing");
      const result = await res.json();

      // Persist the full input so Create Listing can prefill everything,
      // including property type and already-uploaded photos.
      AsyncStorage.setItem("chiavi:lastPricingInput", JSON.stringify(input)).catch(
        () => {}
      );

      navigation.navigate("PricingResults", { input, result });
    } catch {
      setErrorMessage(
        "Could not generate pricing. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButtonTouch}
            >
              <Text style={styles.backText}>{"\u2190"} Back</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Price Your Home</Text>
          <Text style={styles.subtitle}>
            Our AI acts as your elite appraiser — the more detail you share, the sharper the price.
          </Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>{"\u{1F4A1}"}</Text>
            <Text style={styles.infoText}>
              Start with the address and fill in every section you can. Photos help our AI judge quality, finish, and curb appeal — especially for luxury homes.
            </Text>
          </View>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorIcon}>{"\u26A0"}</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* BASICS */}
          <Text style={styles.sectionHeader}>Basics</Text>
          <View style={styles.formSection}>
            <Text style={styles.label}>Address</Text>
            <AddressAutocomplete
              value={address}
              onChangeText={setAddress}
              placeholder="Start typing an address..."
              onSelect={({ address: addr, city, state, zip }) => {
                setAddress(`${addr}, ${city}, ${state} ${zip}`);
              }}
              onPropertyData={(data) => {
                if (data.sqft && !sqft) setSqft(String(data.sqft));
                if (data.bedrooms && !bedrooms) setBedrooms(String(data.bedrooms));
                if (data.bathrooms && !bathrooms) setBathrooms(String(data.bathrooms));
                if (data.year_built && !yearBuilt) setYearBuilt(String(data.year_built));
                if (data.lot_size_sqft && !lotSize) setLotSize(String(data.lot_size_sqft));
                if (data.property_type && PROPERTY_TYPES.includes(data.property_type as any)) {
                  setPropertyType(data.property_type as (typeof PROPERTY_TYPES)[number]);
                }
                if (data.sqft || data.lot_size_sqft) {
                  setAutofilledFromRecords(true);
                }
              }}
            />

            {autofilledFromRecords && (
              <View style={styles.verifyBanner}>
                <Text style={styles.verifyBannerIcon}>{"✏️"}</Text>
                <Text style={styles.verifyBannerText}>
                  Square footage and lot size were auto-filled from public
                  records, which can be outdated or wrong. Tap the fields below
                  to correct them — accurate numbers matter most for pricing.
                </Text>
              </View>
            )}

            <Text style={styles.label}>Property Type</Text>
            <View style={styles.pillRow}>
              {PROPERTY_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.pill, propertyType === t && styles.pillActive]}
                  onPress={() => setPropertyType(t)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pillText,
                      propertyType === t && styles.pillTextActive,
                    ]}
                  >
                    {PROPERTY_TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Above-Ground Square Footage (excludes basement)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={sqft}
                onChangeText={setSqft}
                placeholder="e.g. 2400"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Bedrooms</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={bedrooms}
                    onChangeText={setBedrooms}
                    placeholder="3"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Bathrooms</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={bathrooms}
                    onChangeText={setBathrooms}
                    placeholder="2.5"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>

            <Text style={styles.label}>Year Built</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={yearBuilt}
                onChangeText={setYearBuilt}
                placeholder="e.g. 1995"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            <Text style={styles.label}>Condition</Text>
            <View style={styles.pillRow}>
              {CONDITIONS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.pill, condition === c && styles.pillActive]}
                  onPress={() => setCondition(c)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pillIcon}>{CONDITION_ICONS[c]}</Text>
                  <Text
                    style={[styles.pillText, condition === c && styles.pillTextActive]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* LOT & PARKING */}
          <Text style={styles.sectionHeader}>Lot & Parking</Text>
          <View style={styles.formSection}>
            <Text style={styles.label}>Lot Size (sqft, optional)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={lotSize}
                onChangeText={setLotSize}
                placeholder="e.g. 21780 for 0.5 acres"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Garage Spaces</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={garageSpaces}
                    onChangeText={setGarageSpaces}
                    placeholder="2"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Extra Parking</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={parkingSpaces}
                    onChangeText={setParkingSpaces}
                    placeholder="driveway/lot"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          </View>

          {/* POOL */}
          <Text style={styles.sectionHeader}>Pool</Text>
          <View style={styles.formSection}>
            <View style={styles.pillRow}>
              {POOL_TYPES.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  style={[styles.pill, poolType === p.key && styles.pillActive]}
                  onPress={() => setPoolType(p.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pillText,
                      poolType === p.key && styles.pillTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {poolType !== "none" && (
              <>
                <Text style={[styles.label, { marginTop: spacing.sm }]}>
                  Pool features (select all that apply)
                </Text>
                <View style={styles.pillRow}>
                  {POOL_FEATURE_OPTIONS.map((f) => (
                    <TouchableOpacity
                      key={f.key}
                      style={[
                        styles.pill,
                        poolFeatures.includes(f.key) && styles.pillActive,
                      ]}
                      onPress={() => togglePoolFeature(f.key)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          poolFeatures.includes(f.key) && styles.pillTextActive,
                        ]}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Attached spa / hot tub</Text>
                  <Switch
                    value={poolHasSpa}
                    onValueChange={setPoolHasSpa}
                    trackColor={{ false: colors.border, true: colors.primaryLight }}
                    thumbColor={poolHasSpa ? colors.primary : colors.white}
                  />
                </View>
              </>
            )}
          </View>

          {/* BASEMENT */}
          <Text style={styles.sectionHeader}>Finished Basement</Text>
          <View style={styles.formSection}>
            <Text style={styles.label}>Finished Basement Sqft (optional)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={finishedBasementSqft}
                onChangeText={setFinishedBasementSqft}
                placeholder="e.g. 1500"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
            {finishedBasementSqft ? (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>
                  Full ADU / mother-in-law suite (separate kitchen + bath + bed)
                </Text>
                <Switch
                  value={basementIsAdu}
                  onValueChange={setBasementIsAdu}
                  trackColor={{ false: colors.border, true: colors.primaryLight }}
                  thumbColor={basementIsAdu ? colors.primary : colors.white}
                />
              </View>
            ) : null}
          </View>

          {/* OUTDOOR FEATURES */}
          <Text style={styles.sectionHeader}>Outdoor Features</Text>
          <View style={styles.formSection}>
            <View style={styles.pillRow}>
              {OUTDOOR_FEATURES.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.pillSmall,
                    outdoorFeatures.includes(f) && styles.pillActive,
                  ]}
                  onPress={() => toggleOutdoor(f)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pillText,
                      outdoorFeatures.includes(f) && styles.pillTextActive,
                    ]}
                  >
                    {OUTDOOR_FEATURE_LABELS[f]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* PREMIUM FINISHES */}
          <Text style={styles.sectionHeader}>Premium Interior Finishes</Text>
          <View style={styles.formSection}>
            <View style={styles.pillRow}>
              {PREMIUM_FINISHES.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.pillSmall,
                    premiumFinishes.includes(f) && styles.pillActive,
                  ]}
                  onPress={() => togglePremium(f)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.pillText,
                      premiumFinishes.includes(f) && styles.pillTextActive,
                    ]}
                  >
                    {PREMIUM_FINISH_LABELS[f]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* RECENT APPRAISAL */}
          <Text style={styles.sectionHeader}>Recent Appraisal (optional)</Text>
          <View style={styles.formSection}>
            <Text style={styles.label}>Appraised Value</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={appraisalValue ? `$${Number(appraisalValue).toLocaleString("en-US")}` : ""}
                onChangeText={(text) => {
                  const digits = text.replace(/[^0-9]/g, "");
                  setAppraisalValue(digits);
                }}
                placeholder="$1,200,000"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
            <Text style={styles.label}>Appraisal Date (MM/DD/YYYY)</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={appraisalDate}
                onChangeText={(text) => {
                  // Auto-insert slashes as the user types digits
                  const digits = text.replace(/[^0-9]/g, "").slice(0, 8);
                  let formatted = digits;
                  if (digits.length > 4) {
                    formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                  } else if (digits.length > 2) {
                    formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                  }
                  setAppraisalDate(formatted);
                }}
                placeholder="11/15/2025"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>

          {/* PHOTOS */}
          <Text style={styles.sectionHeader}>Photos (for vision analysis)</Text>
          <View style={styles.formSection}>
            <Text style={styles.helperText}>
              Upload up to {MAX_PRICING_PHOTOS} photos. Our AI will examine them to judge quality and curb appeal.
            </Text>
            {photos.length > 0 && (
              <View style={styles.photoGrid}>
                {photos.map((p, i) => (
                  <View key={`${p.uri}-${i}`} style={styles.photoItem}>
                    <Image source={{ uri: p.uri }} style={styles.photoImg} />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => removePhoto(i)}
                    >
                      <Text style={styles.photoRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={pickPhotos}
              activeOpacity={0.8}
              disabled={processingPhotos}
            >
              {processingPhotos ? (
                <View style={styles.photoLoadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.addPhotoText}>  Loading photos...</Text>
                </View>
              ) : (
                <Text style={styles.addPhotoText}>
                  {photos.length === 0 ? "+ Add Photos" : "+ Add More Photos"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* FREE TEXT */}
          <Text style={styles.sectionHeader}>Anything Else</Text>
          <View style={styles.formSection}>
            <Text style={styles.label}>Describe your home's best features</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.featuresInput]}
                value={features}
                onChangeText={setFeatures}
                placeholder="e.g., gut renovation in 2023, new roof, 7-foot basement ceilings, imported Italian tile..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading || uploadingPhotos}
            activeOpacity={0.8}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.textOnPrimary} />
                <Text style={styles.submitText}>
                  {uploadingPhotos ? "Uploading photos..." : "Analyzing..."}
                </Text>
              </View>
            ) : (
              <Text style={styles.submitText}>{"\u{1F916}"} Get AI Pricing</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: { marginBottom: spacing.sm },
  backButtonTouch: { alignSelf: "flex-start", paddingVertical: spacing.xs },
  backText: { ...typography.bodyBold, color: colors.primaryLight },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  infoCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight + "30",
  },
  infoIcon: { fontSize: 18, marginRight: spacing.sm, marginTop: 1 },
  infoText: {
    ...typography.caption,
    color: colors.primary,
    flex: 1,
    lineHeight: 20,
  },
  errorBanner: {
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.error + "40",
  },
  errorIcon: { fontSize: 16, marginRight: spacing.sm, marginTop: 1 },
  errorText: {
    ...typography.caption,
    color: colors.errorDark,
    flex: 1,
    lineHeight: 20,
  },
  verifyBanner: {
    backgroundColor: colors.primaryLight + "30",
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary + "40",
  },
  verifyBannerIcon: { fontSize: 16, marginRight: spacing.sm, marginTop: 1 },
  verifyBannerText: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  photoLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  formSection: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  label: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  helperText: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    ...typography.body,
    color: colors.textPrimary,
  },
  featuresInput: { minHeight: 100, paddingTop: spacing.sm + 4 },
  row: { flexDirection: "row", gap: spacing.sm },
  halfField: { flex: 1 },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: spacing.xs,
  },
  pillSmall: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: spacing.xs,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillIcon: { fontSize: 14 },
  pillText: { ...typography.captionBold, color: colors.textSecondary },
  pillTextActive: { color: colors.textOnPrimary },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  switchLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    flex: 1,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  photoItem: {
    width: 90,
    height: 90,
    borderRadius: borderRadius.md,
    overflow: "hidden",
    position: "relative",
  },
  photoImg: { width: "100%", height: "100%" },
  photoRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemoveText: {
    color: colors.white,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: "600",
  },
  addPhotoButton: {
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    borderStyle: "dashed",
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    backgroundColor: colors.primarySoft,
  },
  addPhotoText: { ...typography.bodyBold, color: colors.primary },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.xl,
    ...shadows.md,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: {
    ...typography.bodyBold,
    color: colors.textOnPrimary,
    fontSize: 17,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
