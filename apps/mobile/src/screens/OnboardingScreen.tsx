import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  FlatList,
  Image,
  type ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
type IconName = React.ComponentProps<typeof Ionicons>['name'];
import { colors, spacing, typography, radii } from '../theme/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ICON_SOURCE = require('../assets/icon.png');

export type OnboardingSlide = {
  id: string;
  title: string;
  subtitle: string;
  icon: IconName;
  iconColor?: string;
};

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Bine ai venit la Dacus',
    subtitle: 'Descoperă cele mai bune scule, echipamente și consumabile pentru proiectele tale.',
    icon: 'construct-outline',
    iconColor: colors.brandRed,
  },
  {
    id: '2',
    title: 'Comenzi rapide',
    subtitle: 'Adaugă produse în coș cu un singur tap. Comandă și primește livrare în 24-48 ore.',
    icon: 'cart-outline',
    iconColor: colors.success,
  },
  {
    id: '3',
    title: 'Program de fidelitate',
    subtitle:
      'Acumulează puncte pentru fiecare comandă și rabdă vouchere valoroase. Fii Silver sau Gold!',
    icon: 'star-outline',
    iconColor: colors.brandAmber,
  },
  {
    id: '4',
    title: 'Scanare în magazin',
    subtitle:
      'Folosește codul QR din aplicație pentru a câștiga puncte și la cumpărăturile din magazin.',
    icon: 'qr-code-outline',
    iconColor: colors.info,
  },
];

type OnboardingScreenProps = {
  onComplete: () => void;
  onSkip?: () => void;
};

export function OnboardingScreen({ onComplete, onSkip }: OnboardingScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onSkip?.();
    onComplete();
  };

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: false,
  });

  const renderSlide = ({ item }: { item: OnboardingSlide }) => (
    <View style={styles.slide}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: `${item.iconColor ?? colors.brandRed}15` },
        ]}
      >
        <Ionicons
          name={item.icon as IconName}
          size={80}
          color={item.iconColor ?? colors.brandRed}
        />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {ONBOARDING_SLIDES.map((_, index) => {
        const inputRange = [
          (index - 1) * SCREEN_WIDTH,
          index * SCREEN_WIDTH,
          (index + 1) * SCREEN_WIDTH,
        ];
        const scale = scrollX.interpolate({
          inputRange,
          outputRange: [0.8, 1.2, 0.8],
          extrapolate: 'clamp',
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.4, 1, 0.4],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                transform: [{ scale }],
                opacity,
              },
            ]}
          />
        );
      })}
    </View>
  );

  const renderButtons = () => (
    <View style={styles.buttonsContainer}>
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipButtonText}>Sară peste</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>
          {currentIndex === ONBOARDING_SLIDES.length - 1 ? 'Începe acum' : 'Următorul'}
        </Text>
        {currentIndex < ONBOARDING_SLIDES.length - 1 && (
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  );

  const onViewableItemsChanged = useRef((info: { viewableItems: ViewToken[] }) => {
    if (info.viewableItems.length > 0) {
      const first = info.viewableItems[0];
      if (first?.index !== undefined && first.index !== null) {
        setCurrentIndex(first.index);
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image source={ICON_SOURCE} style={styles.logo} resizeMode="contain" />
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />

      {renderDots()}
      {renderButtons()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xl,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  logo: {
    width: 100,
    height: 40,
  },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.h1,
    fontWeight: '900',
    color: colors.brandBlack,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brandRed,
    marginHorizontal: 4,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  skipButtonText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: colors.brandRed,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    gap: spacing.xs,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: typography.body,
    fontWeight: '800',
  },
});

export default OnboardingScreen;
