import type { ExpoConfig } from 'expo/config';

const googleUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
const config: ExpoConfig = {
  name: 'Down & Distance', slug: 'down-and-distance-mobile', version: '1.0.0',
  orientation: 'portrait', icon: './assets/images/icon.png', scheme: 'downdistance',
  userInterfaceStyle: 'light', newArchEnabled: true,
  ios: {
    supportsTablet: true, bundleIdentifier: 'com.downdistance.mobile', usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'com.downdistance.mobile', edgeToEdgeEnabled: true, predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: '#081824', foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  web: { output: 'static', favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router', 'expo-apple-authentication', 'expo-notifications',
    ['expo-splash-screen', {
      image: './assets/images/splash-icon.png', imageWidth: 200, resizeMode: 'contain',
      backgroundColor: '#081824', dark: { backgroundColor: '#000000' },
    }],
    'expo-secure-store',
    ...(googleUrlScheme ? [[
      '@react-native-google-signin/google-signin', { iosUrlScheme: googleUrlScheme },
    ] as [string, { iosUrlScheme: string }]] : []),
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } },
};
export default config;
