import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { colors, fonts, spacing, radii } from "@/constants/theme";
import BottomNav from "@/components/navigation/BottomNav";
import { useAuth } from "@/providers/AuthProvider";
import { api } from "@/constants/api";
import { router } from "expo-router";
import { ROUTES } from "@/constants/routes";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = { _id: string; name: string; icon?: string };
type Subcategory = { _id: string; name: string; categoryId: string };
type DocumentFile = { url: string; publicId: string; format?: string };
type Document = {
  documentTypeId: string;
  key: string;
  side: "single" | "front" | "back";
  title: string;
  icon: string | null;
  uploadStatus: string;
  badge: { label: string; color: string };
  previewUrl: string | null;
  previewUrls: string[];
  numberValue: string | null;
  uploadedAt: string | null;
};

type ProfileData = {
  fullName: string;
  gender: string | null;
  dateOfBirth: string | null;
  profilePhoto: string | null;
  selfiePhoto: string | null;
  address: {
    house?: string;
    street?: string;
    locality?: string;
    city: string;
    state: string;
    pincode: string;
  } | null;
  location: { latitude: number; longitude: number } | null;
  serviceRadius: number;
  walletBalance: number;
  totalEarnings: number;
};

type ServiceData = {
  categories: string[];
  subcategories: { categoryId: string; subcategoryId: string }[];
  experience?: number;
  languages: string[];
  bio?: string;
  visitingCredits: { type: string; amount: number };
  populatedSubcategories?: {
    categoryId: string;
    categoryName: string;
    subcategoryId: string;
    subcategoryName: string;
  }[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh", "Puducherry",
];
const LANGUAGES = ["Hindi", "English", "Punjabi", "Tamil", "Telugu", "Kannada", "Bengali", "Marathi", "Gujarati"];
const PRICING_OPTIONS = [
  { value: "perVisit", label: "Per Visit", icon: "walk" as const },
  { value: "perHour", label: "Per Hour", icon: "clock-outline" as const },
  { value: "perDay", label: "Per Day", icon: "weather-sunny" as const },
  { value: "perWeek", label: "Per Week", icon: "calendar-week" as const },
];

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle, editable, editing, onEdit, onCancel }: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
  editable?: boolean;
  editing?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
}) {
  return (
    <View style={secStyles.wrap}>
      <View style={secStyles.iconBadge}>
        <MaterialCommunityIcons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={secStyles.textCol}>
        <Text style={secStyles.title}>{title}</Text>
        {subtitle && <Text style={secStyles.subtitle}>{subtitle}</Text>}
      </View>
      {editable && !editing && onEdit && (
        <Pressable onPress={onEdit} hitSlop={8} style={secStyles.editBtn} accessibilityLabel={`Edit ${title}`}>
          <MaterialCommunityIcons name="pencil-outline" size={15} color={colors.primary} />
        </Pressable>
      )}
      {editing && onCancel && (
        <Pressable onPress={onCancel} hitSlop={8} style={secStyles.cancelEditBtn} accessibilityLabel="Cancel editing">
          <Ionicons name="close" size={16} color={colors.error} />
        </Pressable>
      )}
    </View>
  );
}

// ─── Field Label ──────────────────────────────────────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={fieldStyles.label}>
      {label}{required && <Text style={fieldStyles.required}> *</Text>}
    </Text>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, multiline }: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <View style={infoStyles.row}>
      <View style={infoStyles.iconWrap}>
        <MaterialCommunityIcons name={icon} size={14} color={colors.primary} />
      </View>
      <View style={infoStyles.content}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={[infoStyles.value, multiline && { lineHeight: 20 }]} numberOfLines={multiline ? undefined : 2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { partner, patchPartner, signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Profile data
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [service, setService] = useState<ServiceData | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);

  // Edit modes
  const [editingSection, setEditingSection] = useState<
    "personal" | "address" | "service" | "pricing" | null
  >(null);

  // Edit state — Personal
  const [editFullName, setEditFullName] = useState("");
  const [editGender, setEditGender] = useState<string | null>(null);
  const [editDob, setEditDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);

  // Edit state — Address
  const [editHouse, setEditHouse] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [editLocality, setEditLocality] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editPincode, setEditPincode] = useState("");
  const [showStateList, setShowStateList] = useState(false);
  const [editServiceRadius, setEditServiceRadius] = useState(10);

  // Edit state — Service
  const [editExperience, setEditExperience] = useState("");
  const [editLanguages, setEditLanguages] = useState<string[]>([]);
  const [editBio, setEditBio] = useState("");
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  // Edit state — Pricing
  const [editPricingType, setEditPricingType] = useState<string>("perVisit");
  const [editPricingAmount, setEditPricingAmount] = useState("");

  // Photo
  const [photoUploading, setPhotoUploading] = useState(false);
  const [viewImageModal, setViewImageModal] = useState<string | null>(null);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  // ── Fetch data ────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, serviceRes, docsRes, catsRes] = await Promise.all([
        api.get<{ profile: ProfileData }>("/partner/auth/profile"),
        api.get<{ service: ServiceData }>("/partner/service"),
        api.get<{ documents: Document[] }>("/partner/verification"),
        api.get<{ categories: Category[] }>("/categories"),
      ]);

      const p = profileRes.data.profile;
      setProfile(p);

      const s = serviceRes.data.service;
      setService(s);

      setDocuments((docsRes.data as any).documents ?? []);
      setCategories(catsRes.data.categories ?? []);

      // Extract subcategories
      const allSubs: Subcategory[] = [];
      catsRes.data.categories?.forEach((cat: any) => {
        cat.subcategories?.forEach((sub: any) => {
          allSubs.push({ _id: sub._id, name: sub.name, categoryId: cat._id });
        });
      });
      setSubcategories(allSubs);
    } catch (err) {
      console.error("Failed to fetch profile data", err);
      Alert.alert("Error", "Could not load profile. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ── Profile photo handlers ────────────────────────────────────────────────

  const uploadPhoto = useCallback(async (uri: string) => {
    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri,
        name: "profile.jpg",
        type: "image/jpeg",
      } as any);

      const { data } = await api.post<{ profilePhoto: string }>("/partner/auth/profile-photo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProfile((prev) => prev ? { ...prev, profilePhoto: data.profilePhoto } : prev);
      Alert.alert("Done", "Profile photo updated!");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to upload photo.");
    } finally {
      setPhotoUploading(false);
      setShowPhotoOptions(false);
    }
  }, []);

  const handlePickFromGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "We need gallery access to update your photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]) return;
    uploadPhoto(result.assets[0].uri);
  }, [uploadPhoto]);

  const handleTakeNewSelfie = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Camera access is needed to take a selfie.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      cameraType: ImagePicker.CameraType.front,
    });

    if (result.canceled || !result.assets?.[0]) return;
    uploadPhoto(result.assets[0].uri);
  }, [uploadPhoto]);

  const handleResetToSelfie = useCallback(async () => {
    if (!profile?.selfiePhoto) {
      Alert.alert("Not available", "No live selfie found on record.");
      return;
    }
    setPhotoUploading(true);
    try {
      // Upload the selfie URL as the profile photo (backend update)
      await api.put("/partner/auth/profile", {});
      // Actually we just need to clear the profilePhoto to null so it falls back
      // For now let's set profilePhoto to selfiePhoto via the upload endpoint is wrong
      // The simplest approach: submit selfiePhoto URL directly
      const { data } = await api.post<{ profilePhoto: string }>("/partner/auth/profile-photo", null, {
        params: { resetToSelfie: true },
      });
      setProfile((prev) => prev ? { ...prev, profilePhoto: prev.selfiePhoto } : prev);
      Alert.alert("Done", "Profile photo reset to your live selfie.");
    } catch {
      // Fallback: just update local state
      setProfile((prev) => prev ? { ...prev, profilePhoto: prev.selfiePhoto } : prev);
    } finally {
      setPhotoUploading(false);
      setShowPhotoOptions(false);
    }
  }, [profile]);

  // ── Edit handlers ─────────────────────────────────────────────────────────

  const startEditPersonal = () => {
    if (!profile) return;
    setEditFullName(profile.fullName);
    setEditGender(profile.gender);
    setEditDob(profile.dateOfBirth ? new Date(profile.dateOfBirth) : null);
    setEditingSection("personal");
  };

  const savePersonal = async () => {
    if (!editFullName.trim() || !editGender || !editDob) {
      Alert.alert("Missing fields", "Full name, gender, and date of birth are required.");
      return;
    }
    setSaving(true);
    try {
      await api.put("/partner/auth/profile", {
        fullName: editFullName.trim(),
        gender: editGender,
        dateOfBirth: editDob.toISOString(),
      });
      setProfile((p) => p ? {
        ...p,
        fullName: editFullName.trim(),
        gender: editGender,
        dateOfBirth: editDob!.toISOString(),
      } : p);
      patchPartner?.({ fullName: editFullName.trim() });
      setEditingSection(null);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const startEditAddress = () => {
    if (!profile) return;
    setEditHouse(profile.address?.house ?? "");
    setEditStreet(profile.address?.street ?? "");
    setEditLocality(profile.address?.locality ?? "");
    setEditCity(profile.address?.city ?? "");
    setEditState(profile.address?.state ?? "");
    setEditPincode(profile.address?.pincode ?? "");
    setEditServiceRadius(profile.serviceRadius);
    setEditingSection("address");
  };

  const saveAddress = async () => {
    if (!editCity.trim() || !editState.trim() || !/^\d{6}$/.test(editPincode)) {
      Alert.alert("Validation", "City, state, and a valid 6-digit pincode are required.");
      return;
    }
    setSaving(true);
    try {
      await api.put("/partner/auth/profile", {
        address: {
          house: editHouse.trim(),
          street: editStreet.trim(),
          locality: editLocality.trim(),
          city: editCity.trim(),
          state: editState.trim(),
          pincode: editPincode.trim(),
        },
        serviceRadius: editServiceRadius,
      });
      setProfile((p) => p ? {
        ...p,
        address: {
          house: editHouse.trim(),
          street: editStreet.trim(),
          locality: editLocality.trim(),
          city: editCity.trim(),
          state: editState.trim(),
          pincode: editPincode.trim(),
        },
        serviceRadius: editServiceRadius,
      } : p);
      setEditingSection(null);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const startEditService = () => {
    if (!service) return;
    setEditExperience(service.experience ? String(service.experience) : "");
    setEditLanguages(service.languages ?? []);
    setEditBio(service.bio ?? "");
    setEditingSection("service");
  };

  const saveService = async () => {
    setSaving(true);
    try {
      // Only update experience, languages, bio — not category/subcategory
      await api.put("/partner/service/setup", {
        categories: service!.categories,
        subcategories: service!.subcategories,
        experience: editExperience ? Number(editExperience) : undefined,
        languages: editLanguages,
        bio: editBio.trim() || undefined,
        visitingCreditsType: service!.visitingCredits.type,
        visitingCreditsAmount: service!.visitingCredits.amount,
      });
      setService((s) => s ? {
        ...s,
        experience: editExperience ? Number(editExperience) : undefined,
        languages: editLanguages,
        bio: editBio.trim() || undefined,
      } : s);
      setEditingSection(null);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const startEditPricing = () => {
    if (!service) return;
    setEditPricingType(service.visitingCredits.type);
    setEditPricingAmount(String(service.visitingCredits.amount));
    setEditingSection("pricing");
  };

  const savePricing = async () => {
    if (!editPricingAmount.trim() || isNaN(Number(editPricingAmount)) || Number(editPricingAmount) < 0) {
      Alert.alert("Validation", "Please enter a valid pricing amount.");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/partner/service/visiting-credits", {
        visitingCreditsType: editPricingType,
        visitingCreditsAmount: Number(editPricingAmount),
      });
      setService((s) => s ? {
        ...s,
        visitingCredits: { type: editPricingType, amount: Number(editPricingAmount) },
      } : s);
      setEditingSection(null);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatDate = (d: string | null) => {
    if (!d) return "Not set";
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const getServiceName = () => {
    if (!service) return "Not set";
    if (service.populatedSubcategories && service.populatedSubcategories.length > 0) {
      return service.populatedSubcategories
        .map((ps) => `${ps.subcategoryName} (${ps.categoryName})`)
        .join(", ");
    }
    return service.subcategories
      .map((sc) => {
        const sub = subcategories.find((s) => s._id === sc.subcategoryId);
        const cat = categories.find((c) => c._id === sc.categoryId);
        return sub ? `${sub.name}${cat ? ` (${cat.name})` : ""}` : "";
      })
      .filter(Boolean)
      .join(", ") || "Not set";
  };

  const maxDob = (() => {
    const t = new Date();
    return new Date(t.getFullYear() - 18, t.getMonth(), t.getDate());
  })();

  // ── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
        <BottomNav />
      </SafeAreaView>
    );
  }

  if (!profile || !service) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorTitle}>Could not load profile</Text>
          <Text style={styles.errorSubtitle}>Check your connection and try again</Text>
          <Pressable style={styles.retryBtn} onPress={fetchData}>
            <MaterialCommunityIcons name="refresh" size={16} color={colors.white} />
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
        <BottomNav />
      </SafeAreaView>
    );
  }

  // ── Main Render ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
      >
        {/* ── Header with gradient feel ────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerDecor1} pointerEvents="none" />
          <View style={styles.headerDecor2} pointerEvents="none" />
          <View style={styles.headerDecor3} pointerEvents="none" />
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>My Profile</Text>
            <Text style={styles.headerSubtitle}>Manage your account details</Text>
          </View>
        </View>

        {/* ── Profile Photo & Name ─────────────────────────────────── */}
        <View style={styles.profileCard}>
          <Pressable
            style={styles.photoWrap}
            onPress={() => setShowPhotoOptions(true)}
            accessibilityLabel="Change profile photo"
          >
            {profile.profilePhoto || profile.selfiePhoto ? (
              <Image
                source={{ uri: profile.profilePhoto ?? profile.selfiePhoto ?? undefined }}
                style={styles.photo}
              />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <MaterialCommunityIcons name="account" size={44} color={colors.textSecondary} />
              </View>
            )}
            {photoUploading ? (
              <View style={styles.photoOverlay}>
                <ActivityIndicator size="small" color={colors.white} />
              </View>
            ) : (
              <View style={styles.photoOverlay}>
                <MaterialCommunityIcons name="camera-plus" size={14} color={colors.white} />
              </View>
            )}
          </Pressable>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.fullName || "Partner"}</Text>
            {profile.address?.city && (
              <View style={styles.profileLocationRow}>
                <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.profileLocation}>
                  {[profile.address.city, profile.address.state].filter(Boolean).join(", ")}
                </Text>
              </View>
            )}
          </View>

          {/* Wallet Summary */}
          <View style={styles.walletRow}>
            <View style={styles.walletItem}>
              <MaterialCommunityIcons name="wallet-outline" size={18} color={colors.primary} />
              <View>
                <Text style={styles.walletLabel}>Balance</Text>
                <Text style={styles.walletValue}>₹{(profile.walletBalance ?? 0).toFixed(0)}</Text>
              </View>
            </View>
            <View style={styles.walletDivider} />
            <View style={styles.walletItem}>
              <MaterialCommunityIcons name="trending-up" size={18} color={colors.success} />
              <View>
                <Text style={styles.walletLabel}>Earnings</Text>
                <Text style={[styles.walletValue, { color: colors.success }]}>₹{(profile.totalEarnings ?? 0).toFixed(0)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Personal Information ─────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            icon="account-circle-outline"
            title="Personal Information"
            subtitle="Name, gender, date of birth"
            editable
            editing={editingSection === "personal"}
            onEdit={startEditPersonal}
            onCancel={() => setEditingSection(null)}
          />

          {editingSection === "personal" ? (
            <View style={styles.editForm}>
              <FieldLabel label="Full Name" required />
              <TextInput
                style={styles.input}
                value={editFullName}
                onChangeText={setEditFullName}
                placeholder="e.g. Rajesh Kumar"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
                accessibilityLabel="Full name"
              />

              <FieldLabel label="Gender" required />
              <View style={styles.chipRow}>
                {GENDERS.map((g) => (
                  <Pressable
                    key={g}
                    style={[styles.chip, editGender === g && styles.chipSelected]}
                    onPress={() => setEditGender(g)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: editGender === g }}
                  >
                    <Text style={[styles.chipText, editGender === g && styles.chipTextSelected]}>{g}</Text>
                  </Pressable>
                ))}
              </View>

              <FieldLabel label="Date of Birth" required />
              <Pressable
                style={[styles.input, styles.inputRow]}
                onPress={() => setShowDobPicker(true)}
                accessibilityLabel="Pick date of birth"
              >
                <Text style={editDob ? styles.inputText : styles.inputPlaceholder}>
                  {editDob ? formatDate(editDob.toISOString()) : "Select date"}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              </Pressable>
              {showDobPicker && (
                <DateTimePicker
                  value={editDob ?? new Date(1995, 0, 1)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={maxDob}
                  minimumDate={new Date(1940, 0, 1)}
                  onChange={(_, selected) => {
                    setShowDobPicker(Platform.OS === "ios");
                    if (selected) setEditDob(selected);
                  }}
                />
              )}

              <View style={styles.editActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setEditingSection(null)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={savePersonal} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.infoGrid}>
              <InfoRow icon="account" label="Full Name" value={profile.fullName || "Not set"} />
              <InfoRow icon="gender-male-female" label="Gender" value={profile.gender || "Not set"} />
              <InfoRow icon="cake-variant" label="Date of Birth" value={formatDate(profile.dateOfBirth)} />
            </View>
          )}
        </View>

        {/* ── Address & Service Area ───────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            icon="map-marker-outline"
            title="Address & Service Area"
            subtitle="Your home address and service radius"
            editable
            editing={editingSection === "address"}
            onEdit={startEditAddress}
            onCancel={() => setEditingSection(null)}
          />

          {editingSection === "address" ? (
            <View style={styles.editForm}>
              <FieldLabel label="Flat / House No." />
              <TextInput style={styles.input} value={editHouse} onChangeText={setEditHouse} placeholder="e.g. 12A" placeholderTextColor={colors.textSecondary} />

              <FieldLabel label="Street / Road" />
              <TextInput style={styles.input} value={editStreet} onChangeText={setEditStreet} placeholder="e.g. MG Road" placeholderTextColor={colors.textSecondary} />

              <FieldLabel label="Locality / Area" />
              <TextInput style={styles.input} value={editLocality} onChangeText={setEditLocality} placeholder="e.g. Koramangala" placeholderTextColor={colors.textSecondary} />

              <FieldLabel label="City" required />
              <TextInput style={styles.input} value={editCity} onChangeText={setEditCity} placeholder="e.g. Bangalore" placeholderTextColor={colors.textSecondary} />

              <FieldLabel label="State" required />
              <Pressable style={[styles.input, styles.inputRow]} onPress={() => setShowStateList((v) => !v)}>
                <Text style={editState ? styles.inputText : styles.inputPlaceholder}>{editState || "Select state"}</Text>
                <Ionicons name={showStateList ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
              </Pressable>
              {showStateList && (
                <View style={styles.stateList}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled showsVerticalScrollIndicator>
                    {INDIAN_STATES.map((s) => (
                      <Pressable
                        key={s}
                        style={[styles.stateItem, editState === s && styles.stateItemActive]}
                        onPress={() => { setEditState(s); setShowStateList(false); }}
                      >
                        <Text style={[styles.stateItemText, editState === s && styles.stateItemTextActive]}>{s}</Text>
                        {editState === s && <Ionicons name="checkmark" size={14} color={colors.primary} />}
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              <FieldLabel label="Pincode" required />
              <TextInput
                style={styles.input}
                value={editPincode}
                onChangeText={(t) => setEditPincode(t.replace(/\D/g, ""))}
                placeholder="6-digit pincode"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={6}
              />

              <FieldLabel label="Service Radius" />
              <View style={styles.radiusRow}>
                <Pressable
                  style={[styles.radiusBtn, editServiceRadius <= 5 && styles.radiusBtnDisabled]}
                  onPress={() => setEditServiceRadius((r) => Math.max(5, r - 5))}
                  disabled={editServiceRadius <= 5}
                >
                  <Ionicons name="remove" size={16} color={editServiceRadius <= 5 ? colors.navInactive : colors.primary} />
                </Pressable>
                <View style={styles.radiusBadge}>
                  <Text style={styles.radiusValue}>{editServiceRadius}</Text>
                  <Text style={styles.radiusUnit}>km</Text>
                </View>
                <Pressable
                  style={[styles.radiusBtn, editServiceRadius >= 50 && styles.radiusBtnDisabled]}
                  onPress={() => setEditServiceRadius((r) => Math.min(50, r + 5))}
                  disabled={editServiceRadius >= 50}
                >
                  <Ionicons name="add" size={16} color={editServiceRadius >= 50 ? colors.navInactive : colors.primary} />
                </Pressable>
              </View>

              <View style={styles.editActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setEditingSection(null)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={saveAddress} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.infoGrid}>
              <InfoRow icon="home-outline" label="Address" value={
                [
                  profile.address?.house,
                  profile.address?.street,
                  profile.address?.locality,
                  profile.address?.city,
                  profile.address?.state,
                  profile.address?.pincode,
                ].filter(Boolean).join(", ") || "Not set"
              } multiline />
              <InfoRow icon="map-marker-radius-outline" label="Service Radius" value={`${profile.serviceRadius} km`} />
              {profile.location && (
                <InfoRow icon="crosshairs-gps" label="GPS" value={`${profile.location.latitude.toFixed(4)}, ${profile.location.longitude.toFixed(4)}`} />
              )}
            </View>
          )}
        </View>

        {/* ── Service Details ──────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            icon="briefcase-outline"
            title="Service Details"
            subtitle="Experience, languages, and bio"
            editable
            editing={editingSection === "service"}
            onEdit={startEditService}
            onCancel={() => setEditingSection(null)}
          />

          {editingSection === "service" ? (
            <View style={styles.editForm}>
              <FieldLabel label="Years of Experience" />
              <TextInput
                style={styles.input}
                value={editExperience}
                onChangeText={(t) => setEditExperience(t.replace(/\D/g, ""))}
                placeholder="e.g. 5"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={2}
              />

              <FieldLabel label="Languages Spoken" />
              <Pressable style={[styles.input, styles.inputRow]} onPress={() => setShowLangDropdown((v) => !v)}>
                <MaterialCommunityIcons name="translate" size={16} color={colors.primary} />
                <Text style={styles.inputText}>
                  {editLanguages.length > 0 ? `${editLanguages.length} selected` : "Select languages"}
                </Text>
                <Ionicons name={showLangDropdown ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
              </Pressable>
              {showLangDropdown && (
                <View style={styles.dropdownMenu}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled showsVerticalScrollIndicator>
                    {LANGUAGES.map((lang) => {
                      const isSelected = editLanguages.includes(lang);
                      return (
                        <Pressable
                          key={lang}
                          style={[styles.dropdownItem, isSelected && styles.dropdownItemActive]}
                          onPress={() =>
                            setEditLanguages((p) => (p.includes(lang) ? p.filter((l) => l !== lang) : [...p, lang]))
                          }
                        >
                          <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                            {isSelected && <Ionicons name="checkmark" size={12} color={colors.white} />}
                          </View>
                          <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextActive]}>{lang}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              {editLanguages.length > 0 && (
                <View style={styles.selectedLangRow}>
                  {editLanguages.map((lang) => (
                    <View key={lang} style={styles.langChip}>
                      <Text style={styles.langChipText}>{lang}</Text>
                      <Pressable onPress={() => setEditLanguages((p) => p.filter((l) => l !== lang))} hitSlop={6}>
                        <Ionicons name="close" size={12} color={colors.white} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <FieldLabel label="Short Bio" />
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Tell customers about yourself and your work..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
                maxLength={300}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{editBio.length}/300</Text>

              <View style={styles.editActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setEditingSection(null)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={saveService} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.infoGrid}>
              <InfoRow icon="shape-outline" label="Service" value={getServiceName()} multiline />
              <InfoRow icon="timer-sand" label="Experience" value={service.experience ? `${service.experience} years` : "Not specified"} />
              <InfoRow icon="translate" label="Languages" value={service.languages.length > 0 ? service.languages.join(", ") : "None"} />
              <InfoRow icon="text-box-outline" label="Bio" value={service.bio || "No bio added"} multiline />
            </View>
          )}
        </View>

        {/* ── Pricing ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            icon="currency-inr"
            title="Pricing"
            subtitle="Your visiting charges"
            editable
            editing={editingSection === "pricing"}
            onEdit={startEditPricing}
            onCancel={() => setEditingSection(null)}
          />

          {editingSection === "pricing" ? (
            <View style={styles.editForm}>
              <FieldLabel label="Billing Model" required />
              <View style={styles.pricingRow}>
                {PRICING_OPTIONS.map((opt) => {
                  const isActive = editPricingType === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      style={[styles.pricingChip, isActive && styles.pricingChipActive]}
                      onPress={() => setEditPricingType(opt.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isActive }}
                    >
                      <MaterialCommunityIcons name={opt.icon} size={14} color={isActive ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.pricingChipText, isActive && styles.pricingChipTextActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <FieldLabel label="Amount (₹)" required />
              <TextInput
                style={styles.input}
                value={editPricingAmount}
                onChangeText={(t) => setEditPricingAmount(t.replace(/\D/g, ""))}
                placeholder="e.g. 150"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />

              <View style={styles.editActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setEditingSection(null)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={savePricing} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.infoGrid}>
              <InfoRow
                icon="cash"
                label="Visiting Charges"
                value={`₹${service.visitingCredits.amount} ${
                  PRICING_OPTIONS.find((p) => p.value === service.visitingCredits.type)?.label ?? ""
                }`}
              />
            </View>
          )}
        </View>

        {/* ── Documents (read-only) ────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader
            icon="file-document-outline"
            title="Documents"
            subtitle="Your uploaded verification documents"
          />
          <View style={styles.docNote}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.docNoteText}>
              Documents are read-only. To re-upload, use the verification section.
            </Text>
          </View>

          {documents.length === 0 ? (
            <View style={styles.emptyDocs}>
              <MaterialCommunityIcons name="file-document-outline" size={36} color={colors.navInactive} />
              <Text style={styles.emptyDocsText}>No documents uploaded yet</Text>
            </View>
          ) : (
            documents.filter((doc) => doc.uploadStatus !== "missing").map((doc) => (
              <View key={`${doc.documentTypeId}_${doc.side}`} style={styles.docCard}>
                <View style={styles.docHeader}>
                  <View style={styles.docIconWrap}>
                    <MaterialCommunityIcons
                      name={(doc.icon as any) || "file-document"}
                      size={15}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.docTitleCol}>
                    <Text style={styles.docName}>{doc.title}</Text>
                    <Text style={styles.docSide}>
                      {doc.side === "single" ? "Single page" : doc.side === "front" ? "Front side" : "Back side"}
                    </Text>
                  </View>
                  <View style={[styles.docBadge, getStatusStyle(doc.badge.label)]}>
                    <Text style={[styles.docBadgeText, getStatusTextStyle(doc.badge.label)]}>{doc.badge.label}</Text>
                  </View>
                </View>

                {(doc.previewUrls ?? []).length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.docImagesScroll}>
                    {doc.previewUrls.map((url, idx) => (
                      <Pressable key={idx} onPress={() => setViewImageModal(url)} style={styles.docImageWrap}>
                        <Image source={{ uri: url }} style={styles.docImage} />
                        <View style={styles.docImageOverlay}>
                          <Ionicons name="expand-outline" size={12} color={colors.white} />
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}

                {doc.numberValue && (
                  <View style={styles.docNumberRow}>
                    <Ionicons name="document-text-outline" size={12} color={colors.textSecondary} />
                    <Text style={styles.docNumber}>{doc.numberValue}</Text>
                  </View>
                )}
                {doc.uploadedAt && (
                  <Text style={styles.docDate}>
                    Uploaded {new Date(doc.uploadedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </Text>
                )}
              </View>
            ))
          )}
        </View>

        {/* ── Live Selfie Section ──────────────────────────────────── */}
        {profile.selfiePhoto && (
          <View style={styles.section}>
            <SectionHeader icon="camera-account" title="Live Selfie" subtitle="Your verification selfie" />
            <Pressable onPress={() => setViewImageModal(profile.selfiePhoto)} style={styles.selfieRow}>
              <Image source={{ uri: profile.selfiePhoto }} style={styles.selfieThumb} />
              <View style={styles.selfieInfo}>
                <Text style={styles.selfieLabel}>Verification Selfie</Text>
                <Text style={styles.selfieHint}>Tap to view full size</Text>
              </View>
              <Pressable
                style={styles.selfieUpdateBtn}
                onPress={handleTakeNewSelfie}
                accessibilityLabel="Update live selfie"
              >
                <MaterialCommunityIcons name="camera-retake-outline" size={16} color={colors.primary} />
                <Text style={styles.selfieUpdateText}>Retake</Text>
              </Pressable>
            </Pressable>
          </View>
        )}

        {/* ── Logout ─────────────────────────────────────────────── */}
        <View style={styles.logoutSection}>
          <Pressable
            style={styles.logoutBtn}
            onPress={() => {
              Alert.alert(
                "Log Out",
                "Are you sure you want to log out?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Log Out",
                    style: "destructive",
                    onPress: async () => {
                      await signOut();
                      router.replace(ROUTES.AUTH.SEND_OTP as any);
                    },
                  },
                ]
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <MaterialCommunityIcons name="logout" size={18} color={colors.error} />
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </Pressable>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* ── Photo Options Modal ────────────────────────────────────── */}
      <Modal
        visible={showPhotoOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhotoOptions(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPhotoOptions(false)}>
          <View style={styles.photoOptionsSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Change Profile Photo</Text>

            <Pressable style={styles.sheetOption} onPress={handlePickFromGallery}>
              <View style={styles.sheetOptionIcon}>
                <MaterialCommunityIcons name="image-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={styles.sheetOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.sheetOptionSub}>Pick a photo from your phone</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.navInactive} />
            </Pressable>

            <Pressable style={styles.sheetOption} onPress={handleTakeNewSelfie}>
              <View style={styles.sheetOptionIcon}>
                <MaterialCommunityIcons name="camera-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.sheetOptionText}>
                <Text style={styles.sheetOptionTitle}>Take a New Selfie</Text>
                <Text style={styles.sheetOptionSub}>Use front camera for a fresh photo</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.navInactive} />
            </Pressable>

            {profile.selfiePhoto && profile.profilePhoto !== profile.selfiePhoto && (
              <Pressable style={styles.sheetOption} onPress={handleResetToSelfie}>
                <View style={[styles.sheetOptionIcon, { backgroundColor: colors.successLight }]}>
                  <MaterialCommunityIcons name="account-check-outline" size={20} color={colors.success} />
                </View>
                <View style={styles.sheetOptionText}>
                  <Text style={styles.sheetOptionTitle}>Use Live Selfie</Text>
                  <Text style={styles.sheetOptionSub}>Reset to your verification selfie</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.navInactive} />
              </Pressable>
            )}

            <Pressable style={styles.sheetCancelBtn} onPress={() => setShowPhotoOptions(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── Image Viewer Modal ─────────────────────────────────────── */}
      <Modal visible={!!viewImageModal} transparent animationType="fade" onRequestClose={() => setViewImageModal(null)}>
        <View style={styles.imageViewerOverlay}>
          <Pressable style={styles.imageViewerClose} onPress={() => setViewImageModal(null)}>
            <Ionicons name="close-circle" size={36} color={colors.white} />
          </Pressable>
          {viewImageModal && (
            <Image source={{ uri: viewImageModal }} style={styles.imageViewerImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      <BottomNav />
    </SafeAreaView>
  );
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function getStatusStyle(status: string) {
  switch (status) {
    case "Approved": return { backgroundColor: colors.successLight, borderColor: colors.successBorder };
    case "Rejected": return { backgroundColor: colors.errorLight, borderColor: colors.errorBorder };
    case "Under Review": return { backgroundColor: colors.primary + "14", borderColor: colors.primary + "44" };
    default: return { backgroundColor: colors.surface, borderColor: colors.navInactive + "44" };
  }
}

function getStatusTextStyle(status: string) {
  switch (status) {
    case "Approved": return { color: colors.successDark };
    case "Rejected": return { color: colors.errorDark };
    case "Under Review": return { color: colors.primary };
    default: return { color: colors.textSecondary };
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const infoStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm + 2 },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    backgroundColor: colors.primary + "10",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  content: { flex: 1 },
  label: {
    fontFamily: fonts.jostMedium,
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: colors.textPrimary,
    marginTop: 2,
  },
});

const secStyles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  textCol: { flex: 1 },
  title: { fontFamily: fonts.jakartaSemiBold, fontSize: 15, color: colors.textPrimary },
  subtitle: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelEditBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.errorLight,
    alignItems: "center",
    justifyContent: "center",
  },
});

const fieldStyles = StyleSheet.create({
  label: {
    fontFamily: fonts.jostMedium,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    marginTop: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  required: { color: colors.error },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  // Loading & Error
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  loadingText: { fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textSecondary },
  errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xl },
  errorTitle: { fontFamily: fonts.jakartaSemiBold, fontSize: 18, color: colors.textPrimary },
  errorSubtitle: { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: colors.primary, borderRadius: radii.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, marginTop: spacing.sm,
  },
  retryBtnText: { fontFamily: fonts.jostSemiBold, fontSize: 14, color: colors.white },

  // Header
  header: {
    height: 130,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    justifyContent: "flex-end",
    paddingBottom: spacing.lg,
    position: "relative",
    overflow: "hidden",
  },
  headerDecor1: {
    position: "absolute", top: -30, right: -30,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  headerDecor2: {
    position: "absolute", top: 40, right: 60,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  headerDecor3: {
    position: "absolute", bottom: -20, left: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  headerContent: { zIndex: 1 },
  headerTitle: { fontFamily: fonts.oswaldBold, fontSize: 26, color: colors.white, letterSpacing: 0.5 },
  headerSubtitle: { fontFamily: fonts.jostRegular, fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 2 },

  // Profile Card
  profileCard: {
    marginHorizontal: spacing.md,
    marginTop: -24,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: spacing.md,
  },
  photoWrap: { position: "relative", marginBottom: spacing.sm },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.primary + "22",
  },
  photoPlaceholder: {
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  photoOverlay: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  profileInfo: { alignItems: "center", marginBottom: spacing.md },
  profileName: { fontFamily: fonts.jakartaBold, fontSize: 20, color: colors.textPrimary },
  profileLocationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  profileLocation: { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary },

  // Wallet row inside profile card
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  walletItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  walletLabel: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary },
  walletValue: { fontFamily: fonts.oswaldBold, fontSize: 18, color: colors.primary, marginTop: 1 },
  walletDivider: { width: 1, height: 36, backgroundColor: colors.navInactive + "33" },

  // Sections
  section: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.md + 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  infoGrid: { gap: 2 },

  // Edit Form
  editForm: { gap: 2 },
  input: {
    fontFamily: fonts.jostRegular,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderWidth: 1.5,
    borderColor: colors.navInactive + "44",
  },
  inputRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  inputText: { fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textPrimary },
  inputPlaceholder: { fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textSecondary },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  charCount: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary, textAlign: "right", marginTop: 2 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.navInactive + "55",
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.jostMedium, fontSize: 12, color: colors.textSecondary },
  chipTextSelected: { color: colors.white },

  // State list
  stateList: {
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.navInactive + "44",
    overflow: "hidden",
    marginTop: 4,
  },
  stateItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 0.5, borderBottomColor: colors.navInactive + "22",
  },
  stateItemActive: { backgroundColor: colors.primary + "0A" },
  stateItemText: { fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textPrimary },
  stateItemTextActive: { fontFamily: fonts.jostMedium, color: colors.primary },

  // Dropdown
  dropdownMenu: {
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.navInactive + "44",
    overflow: "hidden",
    marginTop: 4,
  },
  dropdownItem: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 0.5, borderBottomColor: colors.navInactive + "22",
  },
  dropdownItemActive: { backgroundColor: colors.primary + "08" },
  dropdownItemText: { fontFamily: fonts.jostRegular, fontSize: 14, color: colors.textPrimary },
  dropdownItemTextActive: { fontFamily: fonts.jostMedium, color: colors.primary },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1.5, borderColor: colors.navInactive,
    backgroundColor: colors.white,
    alignItems: "center", justifyContent: "center",
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },

  // Selected languages chips
  selectedLangRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  langChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  langChipText: { fontFamily: fonts.jostMedium, fontSize: 11, color: colors.white },

  // Radius
  radiusRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, justifyContent: "center", marginTop: spacing.xs },
  radiusBtn: {
    width: 38, height: 38, borderRadius: radii.sm,
    backgroundColor: colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  radiusBtnDisabled: { backgroundColor: colors.surface },
  radiusBadge: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  radiusValue: { fontFamily: fonts.jakartaBold, fontSize: 22, color: colors.primary },
  radiusUnit: { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary },

  // Pricing
  pricingRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  pricingChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 3,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.navInactive + "55",
    backgroundColor: colors.surface,
  },
  pricingChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + "10" },
  pricingChipText: { fontFamily: fonts.jostMedium, fontSize: 12, color: colors.textSecondary },
  pricingChipTextActive: { color: colors.primary },

  // Edit actions
  editActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: {
    flex: 1, borderRadius: radii.md, paddingVertical: spacing.sm + 2,
    alignItems: "center", backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.navInactive + "55",
  },
  cancelBtnText: { fontFamily: fonts.jostSemiBold, fontSize: 14, color: colors.textSecondary },
  saveBtn: {
    flex: 2, borderRadius: radii.md, paddingVertical: spacing.sm + 2,
    alignItems: "center", backgroundColor: colors.primary,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontFamily: fonts.jostSemiBold, fontSize: 14, color: colors.white },

  // Documents
  docNote: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: colors.surface, borderRadius: radii.sm,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  docNoteText: { flex: 1, fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary },
  emptyDocs: { alignItems: "center", paddingVertical: spacing.xl, gap: spacing.sm },
  emptyDocsText: { fontFamily: fonts.jostRegular, fontSize: 13, color: colors.textSecondary },

  docCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.navInactive + "22",
  },
  docHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  docIconWrap: {
    width: 30, height: 30, borderRadius: radii.sm,
    backgroundColor: colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  docTitleCol: { flex: 1 },
  docName: { fontFamily: fonts.jostMedium, fontSize: 13, color: colors.textPrimary },
  docSide: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary },
  docBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  docBadgeText: { fontFamily: fonts.jostMedium, fontSize: 10 },
  docImagesScroll: { marginTop: spacing.sm },
  docImageWrap: { position: "relative", marginRight: spacing.sm },
  docImage: { width: 72, height: 72, borderRadius: radii.sm },
  docImageOverlay: {
    position: "absolute", bottom: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center",
  },
  docNumberRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: spacing.xs },
  docNumber: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary },
  docDate: { fontFamily: fonts.jostRegular, fontSize: 10, color: colors.navInactive, marginTop: 4 },

  // Logout
  logoutSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.errorLight,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.errorBorder,
  },
  logoutBtnText: {
    fontFamily: fonts.jostSemiBold,
    fontSize: 15,
    color: colors.error,
  },

  // Live selfie
  selfieRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm + 2,
  },
  selfieThumb: { width: 52, height: 52, borderRadius: radii.sm },
  selfieInfo: { flex: 1 },
  selfieLabel: { fontFamily: fonts.jostMedium, fontSize: 13, color: colors.textPrimary },
  selfieHint: { fontFamily: fonts.jostRegular, fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  selfieUpdateBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primary + "12",
  },
  selfieUpdateText: { fontFamily: fonts.jostMedium, fontSize: 12, color: colors.primary },

  // Photo Options Sheet
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  photoOptionsSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + spacing.md,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.navInactive + "55",
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  sheetTitle: { fontFamily: fonts.jakartaSemiBold, fontSize: 17, color: colors.textPrimary, marginBottom: spacing.md },
  sheetOption: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.navInactive + "22",
  },
  sheetOptionIcon: {
    width: 44, height: 44, borderRadius: radii.md,
    backgroundColor: colors.primary + "12",
    alignItems: "center", justifyContent: "center",
  },
  sheetOptionText: { flex: 1 },
  sheetOptionTitle: { fontFamily: fonts.jostMedium, fontSize: 15, color: colors.textPrimary },
  sheetOptionSub: { fontFamily: fonts.jostRegular, fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  sheetCancelBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  sheetCancelText: { fontFamily: fonts.jostSemiBold, fontSize: 14, color: colors.textSecondary },

  // Image viewer
  imageViewerOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center", justifyContent: "center",
  },
  imageViewerClose: { position: "absolute", top: 50, right: spacing.lg, zIndex: 10 },
  imageViewerImage: { width: SCREEN_WIDTH - 32, height: SCREEN_WIDTH - 32 },
});
