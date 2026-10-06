import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { buildQrShape } from '../utils/qrShape';

type QRCodeMatrixProps = {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
  quietZone?: number;
};

function QRCodeMatrix({
  value,
  size = 220,
  color = '#111827',
  backgroundColor = '#FFFFFF',
  quietZone = 4,
}: QRCodeMatrixProps) {
  // Generated locally so the loyalty token is never sent to a third-party QR service.
  const shape = useMemo(() => {
    const payload = value.trim();
    if (!payload) return null;
    try {
      return buildQrShape(payload, Math.max(0, Math.round(quietZone)));
    } catch {
      return null;
    }
  }, [quietZone, value]);

  if (!shape) {
    return <View style={[styles.fallback, { width: size, height: size, backgroundColor }]} />;
  }

  return (
    <View
      style={[styles.canvas, { width: size, height: size, backgroundColor }]}
      accessibilityRole="image"
      accessibilityLabel="Cod QR"
    >
      <Svg width={size} height={size} viewBox={`0 0 ${shape.dimension} ${shape.dimension}`}>
        <Path d={shape.path} fill={color} />
      </Svg>
    </View>
  );
}

export default memo(QRCodeMatrix);

const styles = StyleSheet.create({
  canvas: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  fallback: {
    borderRadius: 12,
  },
});
