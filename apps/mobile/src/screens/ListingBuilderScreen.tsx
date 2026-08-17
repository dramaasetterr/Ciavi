import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AppStackParamList } from "../../App";
import {
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  PropertyType,
} from "../shared";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { uploadPhoto } from "../lib/uploadImage";
import { colors, shadows, spacing, borderRadius, typography } from "../theme";
import AddressAutocomplete from "../components/AddressAutocomplete";
import { useTierAccess } from "../hooks/useTierAccess";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
const SCREEN_WIDTH = Dimensions.get("window").width;
const PHOTO_GAP = spacing.sm;
const PHOTO_PADDING = spacing.lg * 2;
const PHOTO_SIZE = (SCREEN_WIDTH - PHOTO_PADDING - PHOTO_GAP * 2) / 3;

type Props = NativeStackScreenProps<AppStackParamList, "ListingBuilder">;

const STEPS = ["Details", "Photos", "Description", "Review"];

export default function ListingBuilderScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { plan } = useTierAccess();
  const maxPhotos = plan === 'free' ? 5 : plan === 'seller_pro' ? 25 : 25;
  const [step, setStep] = useState(0);

  // Step 1 — Property Details
  const [address, setAddress] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [sqft, setSqft] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("single_family");
  const [hoa, setHoa] = useState(false);
  const [hoaFee, setHoaFee] = useState("");
  const [condition, setCondition] = useState("");
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  // Step 2 — Photos
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0);

  // Step 3 — Description
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [generatingDesc, setGeneratingDesc] = useState(false);

  // Step 4 — Publish
  const [publishing, setPublishing] = useState(false);

  // Pre-fill from pricing data
  useEffect(() => {
    if (prefilled || !user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("pricing_results")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (data) {
          setAddress(data.address || "");
          setBedrooms(String(data.bedrooms || ""));
          setBathrooms(String(data.bathrooms || ""));
          setSqft(String(data.sqft || ""));
          setYearBuilt(String(data.year_built || ""));
          if (data.condition) setCondition(data.condition);
          if (data.selected_price) setSelectedPrice(data.selected_price);
        }
      } catch (err) {
        // Non-critical: user can still fill in details manually
      } finally {
        setPrefilled(true);
      }
    })();
  }, [user, prefilled]);

  // Generate description when entering step 3
  const generateDescription = useCallback(async () => {
    if (description) return; // already generated/edited
    setGeneratingDesc(true);
    try {
      const res = await fetch(`${API_BASE}/api/listing-description`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          bedrooms: parseInt(bedrooms, 10),
          bathrooms: parseInt(bathrooms, 10),
          sqft: parseInt(sqft, 10),
          year_built: parseInt(yearBuilt, 10),
          property_type: propertyType,
          hoa,
          condition: condition || undefined,
          selected_price: selectedPrice || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate description");
      const result = await res.json();
      setTitle(result.title || "");
      setDescription(result.description || "");
    } catch {
      Alert.alert("Error", "Could not generate description. You can write your own below.");
    } finally {
      setGeneratingDesc(false);
    }
  }, [address, bedrooms, bathrooms, sqft, yearBuilt, propertyType, hoa, condition, selectedPrice, description]);

  const getOrderedPhotos = () => {
    if (photos.length === 0) return photos;
    const ordered = [...photos];
    if (mainPhotoIndex > 0 && mainPhotoIndex < ordered.length) {
      const [main] = ordered.splice(mainPhotoIndex, 1);
      ordered.unshift(main);
    }
    return ordered;
  };

  const getOrderedPhotoUrls = () => {
    if (photoUrls.length === 0) return photoUrls;
    const ordered = [...photoUrls];
    if (mainPhotoIndex > 0 && mainPhotoIndex < ordered.length) {
      const [main] = ordered.splice(mainPhotoIndex, 1);
      ordered.unshift(main);
    }
    return ordered;
  };

  const uploadPhotos = async () => {
    if (!user || photos.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    const orderedPhotos = getOrderedPhotos();
    const urls: string[] = [];
    let failedCount = 0;

    for (let i = 0; i < orderedPhotos.length; i++) {
      const photo = orderedPhotos[i];
      const fileName = `${user.id}/${Date.now()}_${i}.jpg`;

      try {
        const publicUrl = await uploadPhoto("listing-photos", fileName, photo.uri);
        urls.push(publicUrl);
      } catch {
        failedCount++;
        continue;
      }

      setUploadProgress(Math.round(((i + 1) / orderedPhotos.length) * 100));
    }

    if (failedCount > 0) {
      Alert.alert("Warning", `${failedCount} photo(s) failed to upload.`);
    }

    setPhotoUrls(urls);
    setUploading(false);
  };

  const pickPhotos = async () => {
    const remaining = maxPhotos - photos.length;
    if (remaining <= 0) {
      Alert.alert("Limit Reached", `Maximum ${maxPhotos} photos allowed.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      setPhotos((prev) => [...prev, ...result.assets].slice(0, maxPhotos));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Adjust mainPhotoIndex
      if (index === mainPhotoIndex) {
        setMainPhotoIndex(0);
      } else if (index < mainPhotoIndex) {
        setMainPhotoIndex((prev) => prev - 1);
      }
      return next;
    });
  };

  const handleSetMainPhoto = (index: number) => {
    setMainPhotoIndex(index);
  };

  const handleNext = async () => {
    if (step === 0) {
      if (!address || !bedrooms || !bathrooms || !sqft || !yearBuilt) {
        Alert.alert("Missing Fields", "Please fill in all property details.");
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (photos.length > 0 && photoUrls.length === 0) {
        await uploadPhotos();
      }
      setStep(2);
      // Trigger description generation after state update
      setTimeout(() => generateDescription(), 100);
    } else if (step === 2) {
      if (!title) {
        Alert.alert("Missing Title", "Please enter a listing headline.");
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 0) {
      navigation.goBack();
    } else {
      setStep(step - 1);
    }
  };

  const handlePublish = async () => {
    if (!user) return;
    setPublishing(true);
    try {
      const orderedUrls = getOrderedPhotoUrls();
      const { error: insertError } = await supabase.from("listings").insert({
        user_id: user.id,
        address,
        bedrooms: parseInt(bedrooms, 10),
        bathrooms: parseInt(bathrooms, 10),
        sqft: parseInt(sqft, 10),
        year_built: parseInt(yearBuilt, 10),
        property_type: propertyType,
        hoa,
        hoa_fee: hoa && hoaFee ? parseFloat(hoaFee) : null,
        title,
        description,
        photos: orderedUrls,
        price: selectedPrice,
        status: "active",
      });

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ current_stage: "manage_showings" })
        .eq("id", user.id);

      if (updateError) throw updateError;

      navigation.navigate("Home");
    } catch {
      Alert.alert("Error", "Could not publish listing. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const formatPrice = (price: number) =>
    "$" + price.toLocaleString("en-US");

  // --- Step Indicator ---
  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          {i > 0 && (
            <View
              style={[
                styles.stepConnector,
                i <= step && styles.stepConnectorActive,
              ]}
            />
          )}
          <View style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                i < step && styles.stepDotComplete,
                i === step && styles.stepDotCurrent,
              ]}
            >
              {i < step ? (
                <Text style={styles.stepCheck}>{"\u2713"}</Text>
              ) : (
                <Text
                  style={[
                    styles.stepNumber,
                    i === step && styles.stepNumberCurrent,
                  ]}
                >
                  {i + 1}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                i === step && styles.stepLabelCurrent,
                i < step && styles.stepLabelComplete,
              ]}
            >
              {label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );

  // --- Step 1: Property Details ---
  const renderStep1 = () => (
    <>
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
        }}
      />

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Bedrooms</Text>
          <TextInput
            style={styles.input}
            value={bedrooms}
            onChangeText={setBedrooms}
            placeholder="3"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />
        </View>
        <View style={styles.halfField}>
          <Text style={styles.label}>Bathrooms</Text>
          <TextInput
            style={styles.input}
            value={bathrooms}
            onChangeText={setBathrooms}
            placeholder="2"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />
        </View>
      </View>

      <Text style={styles.label}>Square Footage</Text>
      <TextInput
        style={styles.input}
        value={sqft}
        onChangeText={setSqft}
        placeholder="e.g. 2000"
        placeholderTextColor={colors.textMuted}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Year Built</Text>
      <TextInput
        style={styles.input}
        value={yearBuilt}
        onChangeText={setYearBuilt}
        placeholder="e.g. 1995"
        placeholderTextColor={colors.textMuted}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Property Type</Text>
      <View style={styles.chipRow}>
        {PROPERTY_TYPES.map((pt) => (
          <TouchableOpacity
            key={pt}
            style={[styles.chip, propertyType === pt && styles.chipActive]}
            onPress={() => setPropertyType(pt)}
          >
            <Text style={[styles.chipText, propertyType === pt && styles.chipTextActive]}>
              {PROPERTY_TYPE_LABELS[pt]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>HOA</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, !hoa && styles.toggleButtonActive]}
          onPress={() => setHoa(false)}
        >
          <Text style={[styles.toggleText, !hoa && styles.toggleTextActive]}>No</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, hoa && styles.toggleButtonActive]}
          onPress={() => setHoa(true)}
        >
          <Text style={[styles.toggleText, hoa && styles.toggleTextActive]}>Yes</Text>
        </TouchableOpacity>
      </View>

      {hoa && (
        <>
          <Text style={styles.label}>HOA Monthly Fee ($)</Text>
          <TextInput
            style={styles.input}
            value={hoaFee}
            onChangeText={setHoaFee}
            placeholder="e.g. 350"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />
        </>
      )}
    </>
  );

  // --- Step 2: Photos ---
  const renderStep2 = () => (
    <>
      <Text style={styles.sectionTitle}>Add Photos</Text>
      <Text style={styles.photoCount}>
        {photos.length} of {maxPhotos} photos
        {photos.length > 0 && " — tap the star to set as main photo"}
      </Text>

      {uploading && (
        <View style={styles.uploadProgress}>
          <View style={[styles.uploadBar, { width: `${uploadProgress}%` }]} />
          <Text style={styles.uploadText}>Uploading... {uploadProgress}%</Text>
        </View>
      )}

      <View style={styles.photoGrid}>
        {photos.map((photo, index) => (
          <View key={index} style={styles.photoContainer}>
            <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
            {index === mainPhotoIndex && (
              <View style={styles.mainPhotoBadge}>
                <Text style={styles.mainPhotoBadgeText}>{"\u2605"} Main</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.setMainButton}
              onPress={() => handleSetMainPhoto(index)}
            >
              <Text style={[
                styles.setMainButtonText,
                index === mainPhotoIndex && styles.setMainButtonTextActive,
              ]}>
                {index === mainPhotoIndex ? "\u2605" : "\u2606"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removePhoto}
              onPress={() => removePhoto(index)}
            >
              <Text style={styles.removePhotoText}>{"\u2715"}</Text>
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < maxPhotos && (
          <TouchableOpacity style={styles.addPhotoButton} onPress={pickPhotos}>
            <Text style={styles.addPhotoPlus}>+</Text>
            <Text style={styles.addPhotoLabel}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  );

  // --- Step 3: Description ---
  const renderStep3 = () => (
    <>
      <Text style={styles.sectionTitle}>Listing Description</Text>
      <View style={styles.aiNote}>
        <Text style={styles.aiNoteText}>
          AI-generated description. Feel free to edit.
        </Text>
      </View>

      {generatingDesc ? (
        <View style={styles.generatingContainer}>
          <ActivityIndicator size="large" color={colors.primaryLight} />
          <Text style={styles.generatingText}>Generating your listing description...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.label}>Headline</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Stunning 3BR Home in Prime Location"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your property..."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />
        </>
      )}
    </>
  );

  // --- Step 4: Review ---
  const renderStep4 = () => {
    const orderedUrls = getOrderedPhotoUrls();
    const heroUrl = orderedUrls.length > 0 ? orderedUrls[0] : null;

    return (
      <>
        <Text style={styles.sectionTitle}>Review Your Listing</Text>

        {/* Hero image */}
        {heroUrl && (
          <View style={styles.heroImageContainer}>
            <Image source={{ uri: heroUrl }} style={styles.heroImage} />
            <View style={styles.heroImageOverlay}>
              <Text style={styles.heroImageLabel}>Main Photo</Text>
            </View>
          </View>
        )}

        {orderedUrls.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.photoCarousel}
          >
            {orderedUrls.slice(1).map((url, i) => (
              <Image key={i} source={{ uri: url }} style={styles.carouselPhoto} />
            ))}
          </ScrollView>
        )}

        {title ? (
          <Text style={styles.reviewTitle}>{title}</Text>
        ) : null}

        {selectedPrice && (
          <Text style={styles.reviewPrice}>{formatPrice(selectedPrice)}</Text>
        )}

        <View style={styles.reviewCard}>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Address</Text>
            <Text style={styles.reviewValue}>{address}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Bedrooms</Text>
            <Text style={styles.reviewValue}>{bedrooms}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Bathrooms</Text>
            <Text style={styles.reviewValue}>{bathrooms}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Square Feet</Text>
            <Text style={styles.reviewValue}>{parseInt(sqft, 10).toLocaleString()}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Year Built</Text>
            <Text style={styles.reviewValue}>{yearBuilt}</Text>
          </View>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>Type</Text>
            <Text style={styles.reviewValue}>{PROPERTY_TYPE_LABELS[propertyType]}</Text>
          </View>
          {hoa && (
            <View style={[styles.reviewRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.reviewLabel}>HOA Fee</Text>
              <Text style={styles.reviewValue}>${hoaFee}/mo</Text>
            </View>
          )}
        </View>

        {description ? (
          <View style={styles.reviewDescSection}>
            <Text style={styles.reviewDescLabel}>Description</Text>
            <Text style={styles.reviewDescText}>{description}</Text>
          </View>
        ) : null}
      </>
    );
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
      >
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>{"\u2190"} Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create Your Listing</Text>
        <Text style={styles.stepText}>Step {step + 1} of {STEPS.length}</Text>

        {renderStepIndicator()}

        {step === 0 && renderStep1()}
        {step === 1 && renderStep2()}
        {step === 2 && renderStep3()}
        {step === 3 && renderStep4()}

        <View style={styles.navButtons}>
          {step < 3 ? (
            <TouchableOpacity
              style={[styles.nextButton, uploading && styles.buttonDisabled]}
              onPress={handleNext}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.nextButtonText}>Next</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.publishButton, publishing && styles.buttonDisabled]}
              onPress={handlePublish}
              disabled={publishing}
            >
              {publishing ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.publishButtonText}>Publish Listing</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  backButton: {
    marginBottom: spacing.sm,
    alignSelf: "flex-start",
  },
  backText: {
    ...typography.body,
    color: colors.primaryLight,
    fontWeight: "500",
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  stepText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  // Step indicator
  stepIndicator: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  stepItem: {
    alignItems: "center",
  },
  stepConnector: {
    height: 2,
    width: 28,
    backgroundColor: colors.border,
    marginTop: 16,
    marginHorizontal: spacing.xs,
  },
  stepConnectorActive: {
    backgroundColor: colors.primaryLight,
  },
  stepDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  stepDotCurrent: {
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primaryLight,
  },
  stepDotComplete: {
    backgroundColor: colors.primaryLight,
  },
  stepCheck: {
    color: colors.white,
    ...typography.captionBold,
  },
  stepNumber: {
    ...typography.captionBold,
    color: colors.textMuted,
  },
  stepNumberCurrent: {
    color: colors.primaryLight,
  },
  stepLabel: {
    ...typography.small,
    color: colors.textMuted,
    fontWeight: "500",
  },
  stepLabelCurrent: {
    color: colors.primaryLight,
    fontWeight: "600",
  },
  stepLabelComplete: {
    color: colors.textSecondary,
  },
  // Form elements
  label: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.xs + 2,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  textArea: {
    height: 200,
    paddingTop: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  chipText: {
    ...typography.caption,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.white,
  },
  toggleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  toggleButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  toggleButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  toggleText: {
    ...typography.caption,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.white,
  },
  // Photos
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  photoCount: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  uploadProgress: {
    height: 36,
    backgroundColor: colors.borderLight,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.md,
    overflow: "hidden",
    justifyContent: "center",
  },
  uploadBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primarySoft,
    borderRadius: borderRadius.sm,
  },
  uploadText: {
    textAlign: "center",
    ...typography.smallBold,
    color: colors.primary,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: PHOTO_GAP,
  },
  photoContainer: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: borderRadius.md,
    overflow: "hidden",
    ...shadows.md,
  },
  photoThumb: {
    width: "100%",
    height: "100%",
  },
  mainPhotoBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.primaryLight,
    paddingVertical: 2,
    alignItems: "center",
  },
  mainPhotoBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "700",
  },
  setMainButton: {
    position: "absolute",
    bottom: spacing.xs,
    left: spacing.xs,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  setMainButtonText: {
    color: colors.white,
    fontSize: 14,
  },
  setMainButtonTextActive: {
    color: colors.amber,
  },
  removePhoto: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  removePhotoText: {
    color: colors.white,
    ...typography.smallBold,
  },
  addPhotoButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.borderLight,
  },
  addPhotoPlus: {
    fontSize: 28,
    color: colors.textMuted,
    fontWeight: "300",
  },
  addPhotoLabel: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Description
  aiNote: {
    backgroundColor: colors.primarySoft,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  aiNoteText: {
    ...typography.caption,
    color: colors.primary,
  },
  generatingContainer: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  generatingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  // Review - Hero image
  heroImageContainer: {
    width: "100%",
    height: 220,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
    ...shadows.lg,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroImageOverlay: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  heroImageLabel: {
    ...typography.smallBold,
    color: colors.white,
  },
  // Review
  photoCarousel: {
    marginBottom: spacing.lg,
  },
  carouselPhoto: {
    width: 120,
    height: 90,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm + 2,
  },
  reviewTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  reviewPrice: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primaryLight,
    marginBottom: spacing.md,
  },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg - 4,
    marginBottom: spacing.md,
    ...shadows.md,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  reviewLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  reviewValue: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  reviewDescSection: {
    marginBottom: spacing.md,
  },
  reviewDescLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  reviewDescText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  // Navigation buttons
  navButtons: {
    marginTop: spacing.lg,
  },
  nextButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    ...shadows.sm,
  },
  nextButtonText: {
    color: colors.white,
    ...typography.bodyBold,
    fontSize: 17,
  },
  publishButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    ...shadows.sm,
  },
  publishButtonText: {
    color: colors.white,
    ...typography.bodyBold,
    fontSize: 17,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});

