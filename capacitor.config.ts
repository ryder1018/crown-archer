import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ryder1018.crownarchers',
  appName: 'Crown Archers',
  webDir: 'dist',
  backgroundColor: '#8fd6ff',
  ios: {
    contentInset: 'never',
    backgroundColor: '#8fd6ff',
    scrollEnabled: false,
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#1b2a4a',
      showSpinner: false,
    },
  },
};

export default config;
