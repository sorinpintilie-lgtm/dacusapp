import * as LocalAuthentication from 'expo-local-authentication';

let bio: typeof LocalAuthentication | null = null;

const getBio = async () => {
  if (!bio) {
    bio = await import('expo-local-authentication');
  }
  return bio;
};

export const isBiometricAvailable = async (): Promise<boolean> => {
  try {
    const bioModule = await getBio();
    const hasHardware = await bioModule.hasHardwareAsync();
    const isEnrolled = await bioModule.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
};

export const getBiometricType = async (): Promise<string> => {
  try {
    const bioModule = await getBio();
    const types = await bioModule.supportedAuthenticationTypesAsync();
    if (types.includes(bioModule.AuthenticationType.FACIAL_RECOGNITION)) {
      return 'Face ID';
    }
    if (types.includes(bioModule.AuthenticationType.FINGERPRINT)) {
      return 'Fingerprint';
    }
    if (types.includes(bioModule.AuthenticationType.IRIS)) {
      return 'Iris';
    }
    return 'Biometric';
  } catch {
    return 'Biometric';
  }
};

export const authenticateWithBiometric = async (
  promptMessage: string = 'Autentifică-te pentru a continua',
): Promise<{ success: boolean; error?: string }> => {
  try {
    const bioModule = await getBio();

    const result = await bioModule.authenticateAsync({
      promptMessage,
      cancelLabel: 'Anulează',
      disableDeviceFallback: false,
      fallbackLabel: 'Folosește parola',
    });

    if (result.success) {
      return { success: true };
    }

    if (result.error === 'user_cancel') {
      return { success: false, error: 'Autentificare anulată' };
    }

    if (result.error === 'user_fallback') {
      return { success: false, error: 'Folosește parola' };
    }

    return { success: false, error: 'Autentificare eșuată' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Eroare de autentificare';
    return { success: false, error: message };
  }
};

export const verifyBiometricBeforeAction = async (actionName: string): Promise<boolean> => {
  const available = await isBiometricAvailable();
  if (!available) {
    return true;
  }

  const result = await authenticateWithBiometric(`Verifică-te pentru ${actionName}`);

  return result.success;
};
