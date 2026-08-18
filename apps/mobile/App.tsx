import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { registerForPushNotifications } from "./src/lib/notifications";
import OnboardingScreen, { ONBOARDING_KEY } from "./src/screens/OnboardingScreen";
import WelcomeScreen from "./src/screens/WelcomeScreen";
import SignUpScreen from "./src/screens/SignUpScreen";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import PricingScreen from "./src/screens/PricingScreen";
import PricingResultsScreen from "./src/screens/PricingResultsScreen";
import ListingBuilderScreen from "./src/screens/ListingBuilderScreen";
import DocumentsScreen from "./src/screens/DocumentsScreen";
import DocumentViewerScreen from "./src/screens/DocumentViewerScreen";
import ShowingsScreen from "./src/screens/ShowingsScreen";
import ShowingDetailScreen from "./src/screens/ShowingDetailScreen";
import OffersScreen from "./src/screens/OffersScreen";
import OfferInputScreen from "./src/screens/OfferInputScreen";
import OfferAnalysisScreen from "./src/screens/OfferAnalysisScreen";
import OfferCompareScreen from "./src/screens/OfferCompareScreen";
import ClosingScreen from "./src/screens/ClosingScreen";
import ClosingGuideScreen from "./src/screens/ClosingGuideScreen";
import PrepHomeScreen from "./src/screens/PrepHomeScreen";
import MarketplaceScreen from "./src/screens/MarketplaceScreen";
import ListingDetailScreen from "./src/screens/ListingDetailScreen";
import BookShowingScreen from "./src/screens/BookShowingScreen";
import SyndicationScreen from "./src/screens/SyndicationScreen";
import OpenHouseScreen from "./src/screens/OpenHouseScreen";
import UpgradeScreen from "./src/screens/UpgradeScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import MessagesScreen from "./src/screens/MessagesScreen";
import ConversationScreen from "./src/screens/ConversationScreen";
import ContactSellerScreen from "./src/screens/ContactSellerScreen";
import type { PricingInput, PricingResult, Document, OfferAnalysis, OfferInput } from "@chiavi/shared";

export type AuthStackParamList = {
  Onboarding: undefined;
  Welcome: undefined;
  SignUp: undefined;
  Login: undefined;
};

export type AppStackParamList = {
  Home: undefined;
  PrepHome: undefined;
  Pricing: undefined;
  PricingResults: { input: PricingInput; result: PricingResult };
  ListingBuilder: undefined;
  Documents: undefined;
  DocumentViewer: { document: Document };
  Showings: undefined;
  ShowingDetail: { showingId: string };
  Offers: undefined;
  OfferInput: { listingId: string };
  OfferAnalysis: {
    listingId: string;
    offerId?: string;
    analysis?: OfferAnalysis;
    offerInput?: OfferInput;
  };
  OfferCompare: { listingId: string };
  Closing: undefined;
  ClosingGuide: { listingId: string };
  Marketplace: undefined;
  ListingDetail: { listingId: string };
  BookShowing: { listingId: string };
  Syndication: undefined;
  OpenHouse: { listingId: string };
  Messages: undefined;
  Conversation: { listingId: string; otherPartyId: string; otherPartyName: string };
  ContactSeller: { listingId: string };
  Upgrade: undefined;
  Profile: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

function AuthNavigator({ hasSeenOnboarding }: { hasSeenOnboarding: boolean }) {
  return (
    <AuthStack.Navigator
      initialRouteName={hasSeenOnboarding ? "Welcome" : "Onboarding"}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FEF7E4" },
        animation: "slide_from_right",
      }}
    >
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator({ navigationRef }: { navigationRef: React.RefObject<NavigationContainerRef<AppStackParamList>> }) {
  useEffect(() => {
    // Register for push notifications when authenticated
    registerForPushNotifications();
  }, []);

  useEffect(() => {
    // Handle notification taps — navigate to the relevant screen
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (!navigationRef.current) return;

        if (data?.type === "message" && data?.listingId && data?.otherPartyId) {
          navigationRef.current.navigate("Conversation", {
            listingId: data.listingId as string,
            otherPartyId: data.otherPartyId as string,
            otherPartyName: (data.otherPartyName as string) ?? "User",
          });
        } else if (data?.type === "offer") {
          navigationRef.current.navigate("Offers");
        } else if (data?.type === "showing") {
          navigationRef.current.navigate("Showings");
        } else if (data?.type === "message") {
          navigationRef.current.navigate("Messages");
        }
      }
    );

    return () => subscription.remove();
  }, [navigationRef]);

  return (
    <AppStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FEF7E4" },
      }}
    >
      <AppStack.Screen name="Home" component={HomeScreen} />
      <AppStack.Screen name="PrepHome" component={PrepHomeScreen} />
      <AppStack.Screen name="Pricing" component={PricingScreen} />
      <AppStack.Screen name="PricingResults" component={PricingResultsScreen} />
      <AppStack.Screen name="ListingBuilder" component={ListingBuilderScreen} />
      <AppStack.Screen name="Documents" component={DocumentsScreen} />
      <AppStack.Screen name="DocumentViewer" component={DocumentViewerScreen} />
      <AppStack.Screen name="Showings" component={ShowingsScreen} />
      <AppStack.Screen name="ShowingDetail" component={ShowingDetailScreen} />
      <AppStack.Screen name="Offers" component={OffersScreen} />
      <AppStack.Screen name="OfferInput" component={OfferInputScreen} />
      <AppStack.Screen name="OfferAnalysis" component={OfferAnalysisScreen} />
      <AppStack.Screen name="OfferCompare" component={OfferCompareScreen} />
      <AppStack.Screen name="Closing" component={ClosingScreen} />
      <AppStack.Screen name="ClosingGuide" component={ClosingGuideScreen} />
      <AppStack.Screen name="Marketplace" component={MarketplaceScreen} />
      <AppStack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <AppStack.Screen name="BookShowing" component={BookShowingScreen} />
      <AppStack.Screen name="Syndication" component={SyndicationScreen} />
      <AppStack.Screen name="OpenHouse" component={OpenHouseScreen} />
      <AppStack.Screen name="Messages" component={MessagesScreen} />
      <AppStack.Screen name="Conversation" component={ConversationScreen} />
      <AppStack.Screen name="ContactSeller" component={ContactSellerScreen} />
      <AppStack.Screen name="Upgrade" component={UpgradeScreen} />
      <AppStack.Screen name="Profile" component={ProfileScreen} />
    </AppStack.Navigator>
  );
}

function RootNavigator({ navigationRef }: { navigationRef: React.RefObject<NavigationContainerRef<AppStackParamList>> }) {
  const { session, loading: authLoading } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((value) => setHasSeenOnboarding(value === "true"))
      .catch(() => setHasSeenOnboarding(false));
  }, []);

  if (authLoading || hasSeenOnboarding === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FEF7E4" }}>
        <ActivityIndicator size="large" color="#C4A265" />
      </View>
    );
  }

  return session ? (
    <AppNavigator navigationRef={navigationRef} />
  ) : (
    <AuthNavigator hasSeenOnboarding={hasSeenOnboarding} />
  );
}

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<AppStackParamList>>(null);

  return (
    <AuthProvider>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator navigationRef={navigationRef} />
        <StatusBar style="dark" />
      </NavigationContainer>
    </AuthProvider>
  );
}
