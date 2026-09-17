import type { ExpoConfig } from 'expo/config';

const googleUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
const config: ExpoConfig = {
  name: 'Down & Distance',
  slug: 'down-and-distance-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  // Copies of the authoritative assets in public/assets/app-icons for native builds.
  icon: './assets/images/icon.png',
  scheme: 'downdistance',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.downdistance.mobile',
    usesAppleSignIn: true,
    icon: './assets/app-icons/AppIcon.icon',
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'com.downdistance.mobile',
    googleServicesFile: './google-services.json',
    icon: './assets/app-icons/playstore.png',
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: ['android.permission.POST_NOTIFICATIONS'],
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/app-icons/adaptive-foreground.png',
    },
  },
  web: { output: 'static', favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    'expo-apple-authentication',
    ['expo-notifications', { defaultChannel: 'down_distance_updates' }],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#081824',
        dark: { backgroundColor: '#000000' },
      },
    ],
    'expo-secure-store',
    ...(googleUrlScheme
      ? [
          ['@react-native-google-signin/google-signin', { iosUrlScheme: googleUrlScheme }] as [
            string,
            { iosUrlScheme: string },
          ],
        ]
      : []),
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } },
};
export default config;
