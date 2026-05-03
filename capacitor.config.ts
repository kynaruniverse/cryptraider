import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cryptraider.game',
  appName: 'Crypt Raider',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    backgroundColor: '#050200',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.CAPACITOR_DEBUG === 'true'
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#050200'
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: "#050200"
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#050200"
    }
  }
};

export default config;
