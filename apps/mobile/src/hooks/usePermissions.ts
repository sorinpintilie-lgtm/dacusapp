import { useState, useCallback, useEffect } from 'react';
import { Platform, Alert, Linking, PermissionsAndroid } from 'react-native';

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

type PermissionsState = {
  camera: PermissionStatus;
  location: PermissionStatus;
  notifications: PermissionStatus;
  photoLibrary: PermissionStatus;
};

const initialState: PermissionsState = {
  camera: 'undetermined',
  location: 'undetermined',
  notifications: 'undetermined',
  photoLibrary: 'undetermined',
};

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<PermissionsState>(initialState);
  const [isLoading, setIsLoading] = useState(true);

  const checkAllPermissions = useCallback(async () => {
    setIsLoading(true);
    try {
      if (Platform.OS === 'android') {
        const cameraGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        const locationGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );

        setPermissions({
          camera: cameraGranted ? 'granted' : 'undetermined',
          location: locationGranted ? 'granted' : 'undetermined',
          notifications: 'undetermined',
          photoLibrary: 'granted',
        });
      }
    } catch (error) {
      console.error('[Permissions] Error checking permissions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAllPermissions();
  }, [checkAllPermissions]);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
          title: 'Camera necesară',
          message: 'Dacus folosește camera pentru a scana coduri QR.',
          buttonNeutral: 'Întreabă apoi',
          buttonNegative: 'Anulează',
          buttonPositive: 'OK',
        });
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }
      // iOS - permissions handled by expo-camera at runtime
      return true;
    } catch (error) {
      console.error('[Permissions] Camera error:', error);
      return false;
    }
  }, []);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Locație necesară',
            message: 'Dacus folosește locația pentru a găsi magazinele apropiate.',
            buttonNeutral: 'Întreabă apoi',
            buttonNegative: 'Anulează',
            buttonPositive: 'OK',
          },
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      }
      // iOS - permissions handled by expo-location at runtime
      return true;
    } catch (error) {
      console.error('[Permissions] Location error:', error);
      return false;
    }
  }, []);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    try {
      const notifs = await import('expo-notifications');
      const { status } = await notifs.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Notificări necesare',
          'Dacus trimite notificări despre oferte și comenzi. Permite accesul în Setări.',
          [
            { text: 'Anulează', style: 'cancel' },
            { text: 'Deschide Setări', onPress: () => Linking.openSettings() },
          ],
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('[Permissions] Notifications error:', error);
      return false;
    }
  }, []);

  const requestPhotoLibraryPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        return true; // Android doesn't need this
      }
      // iOS - handled by expo-image-picker at runtime
      return true;
    } catch (error) {
      console.error('[Permissions] Photo library error:', error);
      return Platform.OS === 'android';
    }
  }, []);

  const requestAllPermissions = useCallback(async (): Promise<boolean> => {
    const results = await Promise.all([
      requestCameraPermission(),
      requestLocationPermission(),
      requestNotificationPermission(),
      requestPhotoLibraryPermission(),
    ]);
    await checkAllPermissions();
    return results.every(Boolean);
  }, [
    requestCameraPermission,
    requestLocationPermission,
    requestNotificationPermission,
    requestPhotoLibraryPermission,
    checkAllPermissions,
  ]);

  return {
    permissions,
    isLoading,
    checkAllPermissions,
    requestCameraPermission,
    requestLocationPermission,
    requestNotificationPermission,
    requestPhotoLibraryPermission,
    requestAllPermissions,
  };
};
