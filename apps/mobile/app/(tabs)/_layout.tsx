import { Stack } from 'expo-router';
import { MobileSiteHeader } from '../../components/mobile-site-header';
export default function MainLayout() {
  return <Stack screenOptions={{ header: () => <MobileSiteHeader /> }} />;
}
