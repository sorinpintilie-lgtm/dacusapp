import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Skeleton } from '../components/Skeleton';
import type { ScreenStyles } from './screenTypes';

type AccountScreenProps = {
  styles: ScreenStyles;
  isLoading: boolean;
  renderAccountSection: () => ReactNode;
};

export const AccountScreen = ({ styles, isLoading, renderAccountSection }: AccountScreenProps) =>
  isLoading ? (
    <View style={styles.stackLarge}>
      <Skeleton height={90} />
      <Skeleton height={70} />
      <Skeleton height={70} />
    </View>
  ) : (
    <>{renderAccountSection()}</>
  );

