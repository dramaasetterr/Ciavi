import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { uploadFileToStorage } from "../lib/uploadImage";
import type { AppStackParamList } from "../../App";
import type { Document } from "../shared";
import { colors, shadows, spacing, borderRadius, typography } from "../theme";

const PDF_HTML_WRAPPER = (html: string, title: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page { margin: 0.75in; size: letter; }
    body {
      font-family: "Times New Roman", Georgia, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
    }
    h1 { font-size: 18pt; text-align: center; margin-bottom: 24pt; font-weight: bold; }
    h2 { font-size: 14pt; margin-top: 18pt; margin-bottom: 8pt; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 4pt; }
    h3 { font-size: 12pt; margin-top: 12pt; margin-bottom: 6pt; font-weight: bold; }
    p { margin: 6pt 0; }
    .signature-line { border-bottom: 1px solid #000; width: 250px; display: inline-block; margin: 8pt 4pt; }
    .field-blank { border-bottom: 1px solid #000; display: inline-block; min-width: 150px; margin: 0 4pt; }
  </style>
</head>
<body>
${html}
</body>
</html>`;

export default function DocumentViewerScreen() {
  const route = useRoute<RouteProp<AppStackParamList, "DocumentViewer">>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { document: doc } = route.params;
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const generatePdf = async () => {
    const htmlContent = doc.html_content || `<pre>${doc.content}</pre>`;
    const fullHtml = PDF_HTML_WRAPPER(htmlContent, doc.title || "Document");
    const { uri } = await Print.printToFileAsync({ html: fullHtml });

    // Upload to Supabase Storage
    if (user) {
      try {
        const filePath = `${user.id}/${doc.id}.pdf`;

        await uploadFileToStorage("documents", filePath, uri, "application/pdf", {
          upsert: true,
        });

        const {
          data: { publicUrl },
        } = supabase.storage.from("documents").getPublicUrl(filePath);

        await supabase
          .from("documents")
          .update({ pdf_url: publicUrl })
          .eq("id", doc.id);
      } catch {
        // Upload failure is non-critical; PDF is still available locally
      }
    }

    return uri;
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const uri = await generatePdf();

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Success", "PDF saved successfully.");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const uri = await generatePdf();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Sharing Unavailable", "Sharing is not available on this device.");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to share document. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{"\u2190"} Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {doc.title || "Document"}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.documentWrapper}>
        <ScrollView
          style={styles.documentScroll}
          contentContainerStyle={styles.documentContent}
        >
          <Text style={styles.documentTitle}>{doc.title}</Text>
          <Text style={styles.documentBody}>{doc.content}</Text>
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerButtons}>
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleDownloadPDF}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.downloadButtonText}>Download PDF</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            disabled={sharing}
          >
            {sharing ? (
              <ActivityIndicator size="small" color={colors.primaryLight} />
            ) : (
              <Text style={styles.shareButtonText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  backButton: {
    width: 60,
  },
  backText: {
    ...typography.body,
    color: colors.primaryLight,
    fontWeight: "500",
  },
  headerTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
    textAlign: "center",
    marginHorizontal: spacing.sm,
  },
  documentWrapper: {
    flex: 1,
    margin: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    ...shadows.lg,
  },
  documentScroll: {
    flex: 1,
  },
  documentContent: {
    padding: spacing.lg + 4,
    paddingTop: spacing.xl + 4,
    paddingBottom: spacing.xxl,
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.lg,
    fontFamily: "serif",
  },
  documentBody: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    fontFamily: "serif",
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.sm,
  },
  footerButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  downloadButton: {
    flex: 2,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    ...shadows.sm,
  },
  downloadButtonText: {
    color: colors.white,
    ...typography.bodyBold,
  },
  shareButton: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  shareButtonText: {
    color: colors.primaryLight,
    ...typography.bodyBold,
  },
});

