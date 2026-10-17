import { createRoot } from 'react-dom/client';
import { MobileMenuContent } from '../../../apps/mobile/components/mobile-menu-content';
import { View } from 'react-native';
createRoot(document.getElementById('root')).render(
  <View style={{ height: '100%', backgroundColor: '#081824', padding: 20 }}>
    <MobileMenuContent
      close={() => {
        window.__closed = true;
      }}
      navigate={(href) => {
        window.__destination = href;
      }}
    />
  </View>,
);
