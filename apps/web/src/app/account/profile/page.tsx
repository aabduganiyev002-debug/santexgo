import type { Metadata } from 'next';
import { ProfileSettings } from '@/components/account/profile-settings';

export const metadata: Metadata = { title: 'Profil va xavfsizlik' };

export default function ProfilePage() {
  return <ProfileSettings />;
}
