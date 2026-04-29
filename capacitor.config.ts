import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cryptraider.game',
  appName: 'Crypt Raider',
  webDir: '.',
  server: {
    androidScheme: 'https'
  },
  android: {
    backgroundColor: '#050200',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true // Enabled for your first build test
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
