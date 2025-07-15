import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.godsapp.konfipoints',
  appName: 'konfipoints-clean',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: 'ionic'
    }
  }
};

export default config;
