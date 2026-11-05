import { Alert } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { useData, type BookingResponse } from '@/context/data-context';
import type { Booking } from '@/data/types';

/** Accept / decline / complete for the signed-in consultant, with confirmations and error alerts. */
export function useBookingActions() {
  const { user } = useAuth();
  const { respondToBooking } = useData();

  function run(booking: Booking, response: BookingResponse) {
    if (!user) return;
    const error = respondToBooking(booking.id, user.id, response);
    if (error) Alert.alert('Could not update booking', error);
  }

  return {
    accept: (booking: Booking) => run(booking, 'accept'),
    decline: (booking: Booking, clientName: string) =>
      Alert.alert('Decline this request?', `${clientName} will be told you can't take this session.`, [
        { text: 'Keep request', style: 'cancel' },
        { text: 'Decline', style: 'destructive', onPress: () => run(booking, 'decline') },
      ]),
    complete: (booking: Booking) =>
      Alert.alert('Mark session as completed?', 'The client will then be able to leave a review.', [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Mark completed', onPress: () => run(booking, 'complete') },
      ]),
  };
}
