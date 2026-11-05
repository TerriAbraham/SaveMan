import { Alert } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import type { Review, User } from '@/data/types';

/** Admin actions with confirmations for anything destructive, and an alert if the store refuses. */
export function useAdminActions() {
  const { setVerification, setAccountStatus } = useAuth();
  const { removeReview, restoreReview } = useData();

  const report = (error: string | null) => {
    if (error) Alert.alert('Could not complete action', error);
  };

  return {
    approve: (consultant: User) => report(setVerification(consultant.id, 'verified')),
    reject: (consultant: User) =>
      Alert.alert(
        `Reject ${consultant.name}?`,
        'Their profile will stay hidden from clients. You can approve them later.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reject', style: 'destructive', onPress: () => report(setVerification(consultant.id, 'rejected')) },
        ],
      ),
    suspend: (user: User) =>
      Alert.alert(
        `Suspend ${user.name}?`,
        user.role === 'consultant'
          ? 'They won’t be able to log in, and their profile will be hidden from clients.'
          : 'They won’t be able to log in until you reactivate the account.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Suspend', style: 'destructive', onPress: () => report(setAccountStatus(user.id, 'suspended')) },
        ],
      ),
    reactivate: (user: User) => report(setAccountStatus(user.id, 'active')),
    removeReview: (review: Review) =>
      Alert.alert('Remove this review?', 'It will be hidden from the consultant’s profile and taken out of their rating.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => report(removeReview(review.id)) },
      ]),
    restoreReview: (review: Review) => report(restoreReview(review.id)),
  };
}
