import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { colors, spacing, borderRadius, typography, shadows } from "../theme";

interface AddressAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (result: {
    address: string;
    city: string;
    state: string;
    zip: string;
  }) => void;
  onPropertyData?: (data: {
    sqft: number;
    bedrooms: number;
    bathrooms: number;
    year_built: number;
    lot_size_sqft?: number;
    property_type?: string;
  }) => void;
  placeholder?: string;
  style?: any;
}

interface Prediction {
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  description: string;
}

const API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export default function AddressAutocomplete({
  value,
  onChangeText,
  onSelect,
  onPropertyData,
  placeholder = "Enter address",
  style,
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const fetchPredictions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(input)}` +
        `&types=address` +
        `&components=country:us` +
        `&key=${API_KEY}`;

      const res = await fetch(url, { signal: abortRef.current.signal });
      const data = await res.json();

      if (data.status === "OK" && data.predictions?.length) {
        setPredictions(data.predictions);
        setShowDropdown(true);
      } else {
        setPredictions([]);
        setShowDropdown(false);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setPredictions([]);
        setShowDropdown(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText(text);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchPredictions(text);
      }, 300);
    },
    [onChangeText, fetchPredictions]
  );

  const handleSelect = useCallback(
    async (prediction: Prediction) => {
      setShowDropdown(false);
      setPredictions([]);
      onChangeText(prediction.description);

      try {
        // Fetch place details to get structured address components
        const detailsUrl =
          `https://maps.googleapis.com/maps/api/place/details/json` +
          `?place_id=${prediction.place_id}` +
          `&fields=address_component,formatted_address` +
          `&key=${API_KEY}`;

        const res = await fetch(detailsUrl);
        const data = await res.json();

        if (data.status === "OK" && data.result) {
          const components: Array<{ long_name: string; short_name: string; types: string[] }> =
            data.result.address_components ?? [];

          const get = (type: string) =>
            components.find((c) => c.types.includes(type));

          const streetNumber = get("street_number")?.long_name ?? "";
          const route = get("route")?.long_name ?? "";
          const city =
            get("locality")?.long_name ??
            get("sublocality")?.long_name ??
            "";
          const state = get("administrative_area_level_1")?.short_name ?? "";
          const zip = get("postal_code")?.long_name ?? "";
          const address = `${streetNumber} ${route}`.trim();

          const result = { address, city, state, zip };
          onSelect(result);

          // Optionally fetch property data
          if (onPropertyData) {
            fetchPropertyData(result);
          }
        }
      } catch {
        // Silently fail — the user can still manually enter the address
      }
    },
    [onChangeText, onSelect, onPropertyData]
  );

  const fetchPropertyData = useCallback(
    async (result: { address: string; city: string; state: string; zip: string }) => {
      try {
        const fullAddress = `${result.address}, ${result.city}, ${result.state} ${result.zip}`;
        const res = await fetch(`${API_URL}/api/property-lookup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: fullAddress }),
        });
        const data = await res.json();
        if (data && onPropertyData) {
          onPropertyData(data);
        }
      } catch {
        // Property data is optional — fail silently
      }
    },
    [onPropertyData]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.inputWrapper, style]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading && (
          <ActivityIndicator
            size="small"
            color={colors.primaryLight}
            style={styles.spinner}
          />
        )}
      </View>

      {showDropdown && predictions.length > 0 && (
        <View style={styles.dropdown}>
          {predictions.map((item) => (
            <TouchableOpacity
              key={item.place_id}
              style={styles.suggestion}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.mainText} numberOfLines={1}>
                {item.structured_formatting.main_text}
              </Text>
              <Text style={styles.secondaryText} numberOfLines={1}>
                {item.structured_formatting.secondary_text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    zIndex: 999,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: Platform.OS === "ios" ? spacing.md : spacing.sm,
  },
  spinner: {
    marginLeft: spacing.sm,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
    zIndex: 1000,
    ...shadows.lg,
  },
  suggestion: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  mainText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  secondaryText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
