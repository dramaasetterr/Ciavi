import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { AppStackParamList } from "../../App";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { sendPush } from "../lib/notify";
import { colors, shadows, spacing, borderRadius, typography } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string;
  listing_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (isToday) return time;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return `Yesterday ${time}`;
  return `${date.toLocaleDateString()} ${time}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConversationScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, "Conversation">>();
  const { listingId, otherPartyId, otherPartyName } = route.params;
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [listingAddress, setListingAddress] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);

  // Fetch listing address
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("listings")
          .select("address")
          .eq("id", listingId)
          .single();
        if (data?.address) setListingAddress(data.address);
      } catch (err) {
        // Non-critical: address is supplementary info
      }
    })();
  }, [listingId]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("listing_id", listingId)
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherPartyId}),and(sender_id.eq.${otherPartyId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });

      if (error) {
        // Fetch failed — leave messages as-is
      } else {
        setMessages((data as Message[]) || []);
      }

      // Mark received messages as read
      await supabase
        .from("messages")
        .update({ read: true })
        .eq("listing_id", listingId)
        .eq("sender_id", otherPartyId)
        .eq("receiver_id", user.id)
        .eq("read", false);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, [user, listingId, otherPartyId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`messages:${listingId}:${otherPartyId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `listing_id=eq.${listingId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Only add if it belongs to this conversation
          const isMine = newMsg.sender_id === user.id && newMsg.receiver_id === otherPartyId;
          const isTheirs = newMsg.sender_id === otherPartyId && newMsg.receiver_id === user.id;
          if (isMine || isTheirs) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            // Mark as read if received
            if (isTheirs) {
              supabase
                .from("messages")
                .update({ read: true })
                .eq("id", newMsg.id)
                .then(() => {});
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, listingId, otherPartyId]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Send message
  const handleSend = async () => {
    if (!text.trim() || !user || sending) return;

    const content = text.trim();
    setText("");
    setSending(true);

    try {
      const { error } = await supabase.from("messages").insert({
        listing_id: listingId,
        sender_id: user.id,
        receiver_id: otherPartyId,
        content,
        read: false,
      });

      if (error) {
        setText(content); // Restore text on failure
      } else {
        sendPush(
          otherPartyId,
          "New message on Chiavi",
          content.slice(0, 140),
          { type: "message", listingId, otherPartyId: user.id }
        );
      }
    } catch (err) {
      setText(content);
      Alert.alert("Error", "Could not send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderMessage = ({ item }: { item: Message }) => {
    const isSent = item.sender_id === user?.id;

    return (
      <View
        style={[
          styles.messageBubbleRow,
          isSent ? styles.messageBubbleRowSent : styles.messageBubbleRowReceived,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isSent ? styles.messageBubbleSent : styles.messageBubbleReceived,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isSent ? styles.messageTextSent : styles.messageTextReceived,
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isSent ? styles.messageTimeSent : styles.messageTimeReceived,
            ]}
          >
            {formatMessageTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{"\u2190"}</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>
            {otherPartyName}
          </Text>
          {listingAddress ? (
            <Text style={styles.headerListing} numberOfLines={1}>
              {listingAddress}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primaryLight} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              scrollViewRef.current?.scrollToEnd({ animated: false })
            }
          >
            {messages.map((item) => (
              <View key={item.id}>
                {renderMessage({ item })}
              </View>
            ))}
          </ScrollView>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!text.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.sendButtonText}>{"\u2191"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  backButton: {
    paddingRight: spacing.md,
    paddingVertical: spacing.xs,
  },
  backText: {
    fontSize: 22,
    color: colors.primaryLight,
    fontWeight: "600",
  },
  headerCenter: {
    flex: 1,
  },
  headerName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  headerListing: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 1,
  },
  headerSpacer: {
    width: 32,
  },

  // Messages list
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  // Message bubble
  messageBubbleRow: {
    marginBottom: spacing.sm,
    flexDirection: "row",
  },
  messageBubbleRowSent: {
    justifyContent: "flex-end",
  },
  messageBubbleRowReceived: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "78%",
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  messageBubbleSent: {
    backgroundColor: colors.primaryLight,
    borderBottomRightRadius: 4,
  },
  messageBubbleReceived: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    ...shadows.sm,
  },
  messageText: {
    ...typography.body,
    lineHeight: 22,
  },
  messageTextSent: {
    color: colors.white,
  },
  messageTextReceived: {
    color: colors.textPrimary,
  },
  messageTime: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  messageTimeSent: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "right",
  },
  messageTimeReceived: {
    color: colors.textMuted,
  },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.white,
  },
  textInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    maxHeight: 120,
    marginRight: spacing.sm,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
  sendButtonText: {
    fontSize: 20,
    color: colors.white,
    fontWeight: "700",
  },
});
