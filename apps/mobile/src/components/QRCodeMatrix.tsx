import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

type QRCodeMatrixProps = {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  quietZone?: number;
};

export default function QRCodeMatrix({
  value,
  size = 220,
  color = '#111827',
  backgroundColor = '#FFFFFF',
  quietZone = 4,
}: QRCodeMatrixProps) {
  const qrUri = useMemo(() => {
    const payload = value.trim();
    if (!payload) return null;
    const encoded = encodeURIComponent(payload);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=M&margin=${Math.max(0, quietZone)}&color=${color.replace('#', '')}&bgcolor=${backgroundColor.replace('#', '')}&data=${encoded}`;
  }, [backgroundColor, color, quietZone, size, value]);

  if (!qrUri) {
    return <View style={[styles.fallback, { width: size, height: size, backgroundColor }]} />;
  }

  return (
    <Image
      source={{ uri: qrUri }}
      style={[styles.canvas, { width: size, height: size, backgroundColor }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  canvas: {
    borderRadius: 8,
  },
  fallback: {
    borderRadius: 12,
  },
});
