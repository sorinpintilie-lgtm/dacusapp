import { createNavigationContainerRef } from '@react-navigation/native';

import type { AccountStackParamList, RootStackParamList } from './types';

// Lets the app state (which lives above the navigators) move the user after async flows,
// e.g. close the login sheet once signed in or show the orders after checkout.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const currentRouteName = () => (navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined);

export const openLogin = () => {
  if (navigationRef.isReady()) navigationRef.navigate('Login');
};

/** Closes the login/register sheet if it is the screen on top. */
export const closeAuthScreens = () => {
  if (!navigationRef.isReady()) return;
  const name = navigationRef.getCurrentRoute()?.name;
  if ((name === 'Login' || name === 'Register') && navigationRef.canGoBack()) navigationRef.goBack();
};

export const goHome = () => {
  if (navigationRef.isReady()) navigationRef.navigate('MainTabs', { screen: 'HomeTab', params: { screen: 'Home' } });
};

export const openCart = () => {
  if (navigationRef.isReady()) navigationRef.navigate('MainTabs', { screen: 'CartTab', params: { screen: 'Cart' } });
};

export const openAccountScreen =(screen: keyof AccountStackParamList) => {
  if (navigationRef.isReady()) navigationRef.navigate('MainTabs', { screen: 'AccountTab', params: { screen } });
};
