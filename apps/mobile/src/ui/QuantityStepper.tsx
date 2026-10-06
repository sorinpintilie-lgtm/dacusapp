import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { colors, fonts, hitSlop, radii } from '../theme/tokens';
import { rollIn } from './motion';
import { Touchable } from './Touchable';

type QuantityStepperProps = {
  value: number;
  onDecrement: () => void;
  onIncrement: () => void;
  /** Icon for the minus button when the value is 1 (e.g. a trash can). */
  minIcon?: 'trash-outline' | 'remove';
  size?: 'sm' | 'md';
};

export function QuantityStepper({ value, onDecrement, onIncrement, minIcon = 'remove', size = 'md' }: QuantityStepperProps) {
  // The number rolls in the direction it changed.
  const previous = useRef(value);
  const direction = value >= previous.current ? 'up' : 'down';
  useEffect(() => {
    previous.current = value;
  }, [value]);
  const buttonSize = size === 'sm' ? 32 : 38;

  return (
    <View style={styles.stepper}>
      <Touchable
        onPress={onDecrement}
        haptic="light"
        hitSlop={hitSlop}
        pressedScale={0.82}
        accessibilityLabel={value <= 1 && minIcon === 'trash-outline' ? 'Elimină produsul' : 'Scade cantitatea'}
        style={[styles.button, { width: buttonSize, height: buttonSize }]}
      >
        <Ionicons
          name={value <= 1 ? minIcon : 'remove'}
          size={18}
          color={value <= 1 && minIcon === 'trash-outline' ? colors.brand : colors.textPrimary}
        />
      </Touchable>
      <View style={styles.valueBox} accessibilityLabel={`Cantitate ${value}`}>
        <Animated.Text key={value} entering={rollIn(direction)} style={styles.value}>
          {value}
        </Animated.Text>
      </View>
      <Touchable
        onPress={onIncrement}
        haptic="light"
        hitSlop={hitSlop}
        pressedScale={0.82}
        accessibilityLabel="Crește cantitatea"
        style={[styles.button, { width: buttonSize, height: buttonSize }]}
      >
        <Ionicons name="add" size={18} color={colors.textPrimary} />
      </Touchable>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    backgroundColor: colors.well,
    padding: 2,
  },
  button: { borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  valueBox: { minWidth: 28, alignItems: 'center', overflow: 'hidden' },
  value: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
});
