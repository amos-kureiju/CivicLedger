import React, { useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppPalette, fs } from "../theme";
import { Merchant } from "../types";

interface KedaiScreenProps {
  palette: AppPalette;
  largeText: boolean;
  merchants: Merchant[];
}

export default function KedaiScreen({
  palette,
  largeText,
  merchants,
}: KedaiScreenProps) {
  const [query, setQuery] = useState("");

  const filteredMerchants = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return merchants;
    return merchants.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.owner.toLowerCase().includes(q) ||
        m.rt_rw.toLowerCase().includes(q)
    );
  }, [merchants, query]);

  const openMaps = (merchant: Merchant) => {
    const mapQuery = encodeURIComponent(`${merchant.rt_rw}, Kabupaten Toba`);
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${mapQuery}`
    ).catch(() => {});
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Kotak Pencarian */}
      <View
        style={[
          styles.searchWrap,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Ionicons name="search-outline" size={18} color={palette.inkMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Cari nama kedai atau kecamatan..."
          placeholderTextColor={palette.inkMuted}
          style={{
            flex: 1,
            color: palette.inkPrimary,
            fontSize: fs(14, largeText),
            paddingVertical: 10,
          }}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
          </Pressable>
        )}
      </View>

      <Text
        style={{
          color: palette.inkSecondary,
          fontSize: fs(13, largeText),
        }}
      >
        Tunjukkan QR atau kode kupon Anda di salah satu kedai sembako mitra
        berikut.
      </Text>

      <View style={{ gap: 12 }}>
        {filteredMerchants.map((m) => (
          <View
            key={m.id}
            style={[
              styles.card,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <View style={styles.cardTop}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: palette.primarySoft },
                ]}
              >
                <Ionicons
                  name="storefront-outline"
                  size={22}
                  color={palette.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: palette.inkPrimary,
                    fontSize: fs(16, largeText),
                    fontWeight: "800",
                  }}
                >
                  {m.name}
                </Text>
                <Text
                  style={{
                    color: palette.inkSecondary,
                    fontSize: fs(13, largeText),
                    marginTop: 2,
                  }}
                >
                  Pemilik: {m.owner}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.addrBox,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                },
              ]}
            >
              <Ionicons
                name="location-outline"
                size={16}
                color={palette.primary}
              />
              <Text
                style={{
                  color: palette.inkBody,
                  fontSize: fs(13, largeText),
                  flex: 1,
                }}
              >
                {m.rt_rw}
              </Text>
              <View
                style={[
                  styles.readyPill,
                  { backgroundColor: palette.primarySoft },
                ]}
              >
                <Text
                  style={{
                    color: palette.primary,
                    fontSize: fs(11, largeText),
                    fontWeight: "700",
                  }}
                >
                  Terima Kupon
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => openMaps(m)}
              style={({ pressed }) => [
                styles.mapBtn,
                {
                  backgroundColor: pressed ? palette.elevated : palette.nested,
                  borderColor: palette.border,
                },
              ]}
            >
              <Ionicons
                name="navigate-outline"
                size={17}
                color={palette.primary}
              />
              <Text
                style={{
                  color: palette.primary,
                  fontSize: fs(13, largeText),
                  fontWeight: "700",
                }}
              >
                Buka Lokasi di Google Maps
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  addrBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  readyPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  mapBtn: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
});
