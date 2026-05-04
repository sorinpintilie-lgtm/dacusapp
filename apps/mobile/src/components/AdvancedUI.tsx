import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  TextInput,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../theme/tokens';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Tab bar with badge support
 */
export function TabBar({
  tabs,
  activeTab,
  onTabPress,
  cartCount = 0,
  onCartPress,
}: {
  tabs: { key: string; label: string; icon: string; badge?: number }[];
  activeTab: string;
  onTabPress: (key: string) => void;
  cartCount?: number;
  onCartPress?: () => void;
}) {
  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onTabPress(tab.key)}
          >
            <View style={styles.tabIconContainer}>
              <Ionicons
                name={tab.icon as IconName}
                size={24}
                color={isActive ? colors.brandRed : colors.textSecondary}
              />
              {tab.badge && tab.badge > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
      {onCartPress && (
        <TouchableOpacity style={styles.tabCart} onPress={onCartPress}>
          <Ionicons name="cart-outline" size={24} color={colors.textSecondary} />
          {cartCount > 0 && (
            <View style={styles.tabCartBadge}>
              <Text style={styles.tabCartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Search with suggestions dropdown
 */
export function SearchWithSuggestions({
  value,
  onChangeText,
  suggestions = [],
  recentSearches = [],
  onSuggestionPress,
  onRecentPress,
  onSearch,
  placeholder = 'Caută...',
}: {
  value: string;
  onChangeText: (text: string) => void;
  suggestions?: string[];
  recentSearches?: string[];
  onSuggestionPress?: (text: string) => void;
  onRecentPress?: (text: string) => void;
  onSearch?: (text: string) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const showDropdown = focused && (suggestions.length > 0 || recentSearches.length > 0);

  return (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputWrapper}>
        <View style={styles.searchIconBox}>
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
        </View>
        <TextInput
          style={styles.searchTextInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onSubmitEditing={() => onSearch?.(value)}
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={() => onChangeText('')} style={styles.searchClear}>
            <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {showDropdown && (
        <View style={styles.searchDropdown}>
          {recentSearches.length > 0 && (
            <View style={styles.searchSection}>
              <Text style={styles.searchSectionTitle}>Căutări recente</Text>
              {recentSearches.slice(0, 5).map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.searchItem}
                  onPress={() => onRecentPress?.(item)}
                >
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.searchItemText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {suggestions.length > 0 && (
            <View style={styles.searchSection}>
              <Text style={styles.searchSectionTitle}>Sugestii</Text>
              {suggestions.slice(0, 5).map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.searchItem}
                  onPress={() => onSuggestionPress?.(item)}
                >
                  <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.searchItemText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Bottom sheet modal
 * snapPoints reserved for future animation use
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.bottomSheetOverlay}>
        <TouchableOpacity style={styles.bottomSheetBackdrop} onPress={onClose} activeOpacity={1} />
        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY }] }]}>
          <View style={styles.bottomSheetHandle} />
          {title && (
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
          )}
          <ScrollView style={styles.bottomSheetContent}>{children}</ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Quantity selector with stepper
 */
export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const decrease = () => {
    if (value > min) onChange(value - 1);
  };
  const increase = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <View style={styles.quantitySelector}>
      <TouchableOpacity
        style={[styles.quantityButton, value <= min && styles.quantityButtonDisabled]}
        onPress={decrease}
        disabled={value <= min}
      >
        <Ionicons
          name="remove"
          size={16}
          color={value <= min ? colors.border : colors.textPrimary}
        />
      </TouchableOpacity>
      <View style={styles.quantityValue}>
        <Text style={styles.quantityText}>{value}</Text>
      </View>
      <TouchableOpacity
        style={[styles.quantityButton, value >= max && styles.quantityButtonDisabled]}
        onPress={increase}
        disabled={value >= max}
      >
        <Ionicons name="plus" size={16} color={value >= max ? colors.border : colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Progress stepper for checkout
 */
export function CheckoutProgress({
  steps,
  currentStep,
}: {
  steps: { label: string; completed: boolean }[];
  currentStep: number;
}) {
  return (
    <View style={styles.progressStepper}>
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <View style={styles.progressStep}>
            <View
              style={[
                styles.progressDot,
                step.completed && styles.progressDotCompleted,
                index === currentStep && styles.progressDotActive,
              ]}
            >
              {step.completed ? (
                <Ionicons name="checkmark" size={12} color={colors.surface} />
              ) : (
                <Text style={styles.progressDotText}>{index + 1}</Text>
              )}
            </View>
            <Text
              style={[
                styles.progressLabel,
                (step.completed || index === currentStep) && styles.progressLabelActive,
              ]}
            >
              {step.label}
            </Text>
          </View>
          {index < steps.length - 1 && (
            <View style={[styles.progressLine, step.completed && styles.progressLineCompleted]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

/**
 * Image gallery with thumbnails
 */
export function ProductImageGallery({
  images,
  selectedIndex = 0,
  onSelect,
}: {
  images: string[];
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (images.length === 0) return null;

  return (
    <View style={styles.imageGallery}>
      {/* Main image */}
      <TouchableOpacity
        style={styles.imageGalleryMain}
        onPress={() => setExpanded(true)}
        activeOpacity={0.9}
      >
        <View style={styles.imagePlaceholder}>
          <Ionicons name="image-outline" size={48} color={colors.border} />
        </View>
      </TouchableOpacity>

      {/* Thumbnails */}
      {images.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imageThumbnails}
        >
          {images.map((img, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.imageThumbnail, i === selectedIndex && styles.imageThumbnailActive]}
              onPress={() => onSelect?.(i)}
            >
              <View style={styles.imageThumbnailPlaceholder} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Expanded view */}
      <Modal visible={expanded} transparent animationType="fade">
        <View style={styles.imageExpanded}>
          <TouchableOpacity style={styles.imageExpandedClose} onPress={() => setExpanded(false)}>
            <Ionicons name="close" size={24} color={colors.surface} />
          </TouchableOpacity>
          <View style={styles.imageExpandedContent}>
            <View style={styles.imageExpandedPlaceholder} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Address card for checkout
 */
export function AddressCard({
  label,
  fullName,
  phone,
  line1,
  line2,
  city,
  county,
  postalCode,
  isSelected,
  onSelect,
  onEdit,
}: {
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  county: string;
  postalCode: string;
  isSelected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.addressCard, isSelected && styles.addressCardSelected]}
      onPress={onSelect}
    >
      <View style={styles.addressCardHeader}>
        <View style={styles.addressCardTitle}>
          <Ionicons
            name="location-outline"
            size={18}
            color={isSelected ? colors.brandRed : colors.textSecondary}
          />
          <Text style={[styles.addressLabel, isSelected && styles.addressLabelActive]}>
            {label}
          </Text>
        </View>
        {onEdit && (
          <TouchableOpacity onPress={onEdit}>
            <Text style={styles.addressEdit}>Editează</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.addressName}>{fullName}</Text>
      <Text style={styles.addressPhone}>{phone}</Text>
      <Text style={styles.addressLine}>
        {line1}
        {line2 ? `, ${line2}` : ''}
      </Text>
      <Text style={styles.addressLine}>
        {city}, {county}, {postalCode}
      </Text>
      {isSelected && (
        <View style={styles.addressCheck}>
          <Ionicons name="checkmark-circle" size={20} color={colors.brandRed} />
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * Price range slider filter
 */
export function PriceRangeSlider({
  min = 0,
  max = 10000,
  value,
  onChange,
  formatValue = (v) => `${v} RON`,
}: {
  min?: number;
  max?: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  formatValue?: (value: number) => string;
}) {
  const [localMin, setLocalMin] = useState(value[0]);
  const [localMax, setLocalMax] = useState(value[1]);

  const handleMinChange = (v: number) => {
    const newMin = Math.min(v, localMax - 100);
    setLocalMin(newMin);
    onChange([newMin, localMax]);
  };

  const handleMaxChange = (v: number) => {
    const newMax = Math.max(v, localMin + 100);
    setLocalMax(newMax);
    onChange([localMin, newMax]);
  };

  return (
    <View style={styles.priceSlider}>
      <View style={styles.priceSliderLabels}>
        <Text style={styles.priceSliderValue}>{formatValue(localMin)}</Text>
        <Text style={styles.priceSliderValue}>{formatValue(localMax)}</Text>
      </View>
      <View style={styles.priceSliderTrack}>
        <View style={styles.priceSliderRange}>
          <View
            style={[
              styles.priceSliderThumb,
              { left: `${((localMin - min) / (max - min)) * 100}%` },
            ]}
          />
          <View
            style={[
              styles.priceSliderThumb,
              { left: `${((localMax - min) / (max - min)) * 100}%` },
            ]}
          />
        </View>
      </View>
      <View style={styles.priceSliderInputs}>
        <TouchableOpacity
          style={styles.priceSliderButton}
          onPress={() => handleMinChange(Math.max(min, localMin - 200))}
        >
          <Ionicons name="remove" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.priceSliderButton}
          onPress={() => handleMaxChange(Math.min(max, localMax + 200))}
        >
          <Ionicons name="add" size={16} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Wishlist heart button with animation
 */
export function WishlistButton({
  isWishlisted,
  onPress,
  size = 24,
}: {
  isWishlisted: boolean;
  onPress: () => void;
  size?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={isWishlisted ? 'heart' : 'heart-outline'}
          size={size}
          color={isWishlisted ? colors.brandRed : colors.textSecondary}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

/**
 * Pull to refresh indicator
 */
export function PullToRefresh({ refreshing }: { refreshing: boolean }) {
  const rotation = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (refreshing) {
      const rotate = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      );
      rotate.start();
      return () => rotate.stop();
    } else {
      rotation.setValue(0);
    }
  }, [refreshing, rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.pullToRefresh}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Ionicons name="refresh-outline" size={24} color={colors.brandRed} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 34,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  tabIconContainer: {
    position: 'relative',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.brandRed,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '700',
  },
  tabLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  tabLabelActive: {
    color: colors.brandRed,
    fontWeight: '600',
  },
  tabCart: {
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCartBadge: {
    position: 'absolute',
    top: 4,
    right: 8,
    backgroundColor: colors.brandRed,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabCartBadgeText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: '700',
  },

  // Search with suggestions
  searchContainer: {
    position: 'relative',
    zIndex: 100,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
  },
  searchIconBox: {
    padding: spacing.xs,
  },
  searchTextInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: colors.textPrimary,
  },
  searchClear: {
    padding: spacing.xs,
  },
  searchDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginTop: spacing.xs,
  },
  searchSection: {
    padding: spacing.sm,
  },
  searchSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchItemText: {
    fontSize: 14,
    color: colors.textPrimary,
  },

  // Bottom sheet
  bottomSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bottomSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: SCREEN_HEIGHT * 0.9,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  bottomSheetContent: {
    padding: spacing.md,
  },

  // Quantity selector
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  quantityButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonDisabled: {
    opacity: 0.5,
  },
  quantityValue: {
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Progress stepper
  progressStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotCompleted: {
    backgroundColor: colors.brandRed,
    borderColor: colors.brandRed,
  },
  progressDotActive: {
    backgroundColor: colors.brandRed,
    borderColor: colors.brandRed,
  },
  progressDotText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  progressLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  progressLabelActive: {
    color: colors.brandRed,
    fontWeight: '600',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xs,
    marginBottom: 20,
  },
  progressLineCompleted: {
    backgroundColor: colors.brandRed,
  },

  // Image gallery
  imageGallery: {
    gap: spacing.sm,
  },
  imageGalleryMain: {
    aspectRatio: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageThumbnails: {
    gap: spacing.sm,
  },
  imageThumbnail: {
    width: 60,
    height: 60,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  imageThumbnailActive: {
    borderWidth: 2,
    borderColor: colors.brandRed,
  },
  imageThumbnailPlaceholder: {
    flex: 1,
  },
  imageExpanded: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageExpandedClose: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: spacing.sm,
  },
  imageExpandedContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  imageExpandedPlaceholder: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
  },

  // Address card
  addressCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    position: 'relative',
  },
  addressCardSelected: {
    borderColor: colors.brandRed,
    backgroundColor: colors.surfaceAlt,
  },
  addressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addressCardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  addressLabelActive: {
    color: colors.brandRed,
  },
  addressEdit: {
    fontSize: 13,
    color: colors.brandRed,
    fontWeight: '500',
  },
  addressName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  addressPhone: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addressLine: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addressCheck: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },

  // Price slider
  priceSlider: {
    padding: spacing.md,
  },
  priceSliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  priceSliderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brandRed,
  },
  priceSliderTrack: {
    height: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 2,
  },
  priceSliderRange: {
    flex: 1,
    position: 'relative',
  },
  priceSliderThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.brandRed,
    marginLeft: -8,
  },
  priceSliderInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  priceSliderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pull to refresh
  pullToRefresh: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
