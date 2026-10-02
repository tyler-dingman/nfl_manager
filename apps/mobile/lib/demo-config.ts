import Constants from 'expo-constants';

export const DEMO_LOGIN_ENABLED = __DEV__ || Constants.expoConfig?.extra?.demoLoginEnabled === true;
