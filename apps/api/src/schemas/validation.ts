import { z } from 'zod';

/**
 * Request validation schemas using Zod
 * These provide runtime validation for API inputs
 */

// Common schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(10).max(100).default(48),
});

export const IdParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

// Auth schemas
export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const PasswordResetRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// Cart schemas
export const CartLineSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPriceRon: z.number().positive().optional(),
});

export const CheckoutSchema = z.object({
  addressId: z.string().optional(),
  currency: z.string().default('RON'),
});

// Address schemas
export const AddressDraftSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().min(1, 'Phone is required'),
  line1: z.string().min(1, 'Address line is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  county: z.string().min(1, 'County is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  countryCode: z.string().length(2, 'Country code must be 2 characters').default('RO'),
});

// Search schemas
export const SearchQuerySchema = z.object({
  q: z.string().default(''),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(10).max(100).default(48),
  sortBy: z.enum(['relevanta', 'pretCrescator', 'pretDescrescator', 'numeAZ']).default('relevanta'),
  categoryId: z.string().optional(),
  vendor: z.string().optional(),
  availableForSale: z.coerce.boolean().optional(),
  priceMin: z.coerce.number().positive().optional(),
  priceMax: z.coerce.number().positive().optional(),
  onlyDiscount: z.coerce.boolean().optional(),
  facets: z.coerce.boolean().optional(),
});

// Catalog schemas
export const CatalogQuerySchema = z.object({
  after: z.string().optional(),
  pageSize: z.coerce.number().int().min(10).max(250).optional(),
  lean: z.coerce.boolean().default(true),
  includeCategories: z.coerce.boolean().default(true),
});

// Loyalty schemas
export const RedeemSchema = z.object({
  points: z
    .number()
    .int()
    .min(100, 'Minimum 100 points required')
    .multipleOf(100, 'Points must be in increments of 100'),
});

// Notification schemas
export const NotificationReadSchema = z.object({
  notificationId: z.string().min(1, 'Notification ID is required'),
});

export const DeviceRegistrationSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
  platform: z.string().min(1, 'Platform is required'),
  pushToken: z.string().optional(),
});

// Wishlist schemas
export const WishlistToggleSchema = z.object({
  active: z.boolean(),
});

// Back in stock schemas
export const BackInStockToggleSchema = z.object({
  active: z.boolean(),
});

// Account settings schemas
const NotificationChannelPatchSchema = z
  .object({
    marketing: z.boolean().optional(),
    orderUpdates: z.boolean().optional(),
    securityAlerts: z.boolean().optional(),
  })
  .strict();

const PushNotificationPatchSchema = z
  .object({
    marketing: z.boolean().optional(),
    orderUpdates: z.boolean().optional(),
    securityAlerts: z.boolean().optional(),
    backInStock: z.boolean().optional(),
  })
  .strict();

const ConsentPatchSchema = z
  .object({
    granted: z.boolean().optional(),
    updatedAt: z.string().min(1).optional(),
    source: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Consent patch must include at least one field',
  });

export const AccountSettingsPatchSchema = z
  .object({
    notifications: z
      .object({
        email: NotificationChannelPatchSchema.optional(),
        push: PushNotificationPatchSchema.optional(),
        inApp: NotificationChannelPatchSchema.optional(),
      })
      .strict()
      .optional(),
    privacy: z
      .object({
        analyticsConsent: ConsentPatchSchema.optional(),
        personalizationConsent: ConsentPatchSchema.optional(),
        marketingConsent: ConsentPatchSchema.optional(),
      })
      .strict()
      .optional(),
    security: z
      .object({
        loginAlerts: z.boolean().optional(),
        twoFactorEnabled: z.boolean().optional(),
      })
      .strict()
      .optional(),
    profile: z
      .object({
        displayName: z.string().trim().min(1).max(120).optional(),
        locale: z.string().trim().min(2).max(32).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one settings section is required',
  });

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  })
  .strict();

// Analytics schemas
export const AnalyticsEventSchema = z.object({
  name: z.string().min(1, 'Event name is required'),
  payload: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
});

export const AnalyticsEventsSchema = z.object({
  events: z
    .array(AnalyticsEventSchema)
    .min(1, 'At least one event is required')
    .max(50, 'Maximum 50 events per request'),
});

// Type exports for use in routes
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CartLineInput = z.infer<typeof CartLineSchema>;
export type CheckoutInput = z.infer<typeof CheckoutSchema>;
export type AddressDraftInput = z.infer<typeof AddressDraftSchema>;
export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;
export type RedeemInput = z.infer<typeof RedeemSchema>;
export type AccountSettingsPatchInput = z.infer<typeof AccountSettingsPatchSchema>;
