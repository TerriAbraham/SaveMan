import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function ConsultantScheduleScreen() {
  return (
    <PlaceholderScreen
      icon="clock"
      title="Schedule & availability"
      phase={3}
      features={['Set weekly time slots clients can book', 'See all confirmed sessions by day']}
    />
  );
}
