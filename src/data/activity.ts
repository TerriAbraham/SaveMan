import type { Booking, Conversation, Message, Review } from './types';
import { consultants } from './users';

const recentBookings: Booking[] = [
  {
    id: 'b-1',
    clientId: 'u-client-1',
    consultantId: 'u-cons-1',
    serviceName: 'Business plan review',
    date: '2026-11-10',
    time: '10:00',
    durationMins: 60,
    mode: 'in-person',
    note: 'Need help with a business plan for a bakery in Gerehu.',
    status: 'confirmed',
    price: 250,
  },
  {
    id: 'b-2',
    clientId: 'u-client-1',
    consultantId: 'u-cons-2',
    serviceName: 'Personal tax return',
    date: '2026-11-12',
    time: '14:00',
    durationMins: 60,
    mode: 'video',
    note: 'Annual tax return questions.',
    status: 'pending',
    price: 200,
  },
  {
    id: 'b-3',
    clientId: 'u-client-1',
    consultantId: 'u-cons-6',
    serviceName: 'CV rewrite',
    date: '2026-10-20',
    time: '09:00',
    durationMins: 60,
    mode: 'phone',
    note: 'CV review before applying for a role at a mining company.',
    status: 'completed',
    price: 120,
  },
  {
    id: 'b-4',
    clientId: 'u-client-2',
    consultantId: 'u-cons-1',
    serviceName: 'Funding application support',
    date: '2026-11-09',
    time: '13:00',
    durationMins: 90,
    mode: 'video',
    note: 'Funding application for a trucking business.',
    status: 'pending',
    price: 375,
  },
  {
    id: 'b-5',
    clientId: 'u-client-2',
    consultantId: 'u-cons-3',
    serviceName: 'Contract review',
    date: '2026-10-15',
    time: '11:00',
    durationMins: 60,
    mode: 'in-person',
    note: 'Lease agreement review.',
    status: 'completed',
    price: 350,
  },
  {
    id: 'b-6',
    clientId: 'u-client-2',
    consultantId: 'u-cons-1',
    serviceName: 'Business plan review',
    date: '2026-10-01',
    time: '15:00',
    durationMins: 60,
    mode: 'phone',
    note: 'Cash flow review.',
    status: 'completed',
    price: 250,
  },
  // Session has happened but the consultant hasn't marked it completed yet.
  {
    id: 'b-7',
    clientId: 'u-client-1',
    consultantId: 'u-cons-1',
    serviceName: 'Business plan review',
    date: '2026-11-04',
    time: '14:00',
    durationMins: 60,
    mode: 'in-person',
    note: 'Follow-up on the bakery plan: pricing and staffing.',
    status: 'confirmed',
    price: 250,
  },
  // Completed but not reviewed yet, so the client can leave a review.
  {
    id: 'b-8',
    clientId: 'u-client-1',
    consultantId: 'u-cons-5',
    serviceName: 'Cloud migration planning',
    date: '2026-10-28',
    time: '10:00',
    durationMins: 60,
    mode: 'video',
    note: 'Moving the shop email and files to the cloud.',
    status: 'completed',
    price: 220,
  },
  {
    id: 'b-9',
    clientId: 'u-client-7',
    consultantId: 'u-cons-1',
    serviceName: 'SME growth strategy',
    date: '2026-11-11',
    time: '09:00',
    durationMins: 120,
    mode: 'video',
    note: 'Planning to open a second hardware store in Lae.',
    status: 'pending',
    price: 480,
  },
];

const recentReviews: Review[] = [
  {
    id: 'r-1',
    bookingId: 'b-3',
    clientId: 'u-client-1',
    consultantId: 'u-cons-6',
    rating: 5,
    comment: 'Esther completely rewrote my CV and I got the interview. Tenkyu tru!',
    createdAt: '2026-10-21',
  },
  {
    id: 'r-2',
    bookingId: 'b-5',
    clientId: 'u-client-2',
    consultantId: 'u-cons-3',
    rating: 4,
    comment: 'Clear advice on the lease. Very professional.',
    createdAt: '2026-10-16',
  },
  {
    id: 'r-3',
    bookingId: 'b-6',
    clientId: 'u-client-2',
    consultantId: 'u-cons-1',
    rating: 5,
    comment: 'Practical and easy to understand. Highly recommend.',
    createdAt: '2026-10-02',
  },
];

// Older completed sessions that were reviewed. Each one becomes a completed booking plus its review.
const pastSessions: {
  id: string;
  clientId: string;
  consultantId: string;
  date: string;
  mode: Booking['mode'];
  rating: number;
  comment: string;
}[] = [
  { id: 'h-1', clientId: 'u-client-5', consultantId: 'u-cons-1', date: '2026-09-12', mode: 'in-person', rating: 5, comment: 'Dr. Kila helped us turn an idea into a bankable plan. The bank approved our loan.' },
  { id: 'h-2', clientId: 'u-client-7', consultantId: 'u-cons-1', date: '2026-08-03', mode: 'video', rating: 4, comment: 'Very knowledgeable. Session ran a little over time but worth it.' },
  { id: 'h-3', clientId: 'u-client-5', consultantId: 'u-cons-2', date: '2026-10-05', mode: 'in-person', rating: 5, comment: 'Joanne sorted out three years of messy receipts. Stress free tax time!' },
  { id: 'h-4', clientId: 'u-client-6', consultantId: 'u-cons-2', date: '2026-09-20', mode: 'video', rating: 5, comment: 'Clear explanations of GST. I finally understand my obligations.' },
  { id: 'h-5', clientId: 'u-client-1', consultantId: 'u-cons-2', date: '2026-07-14', mode: 'phone', rating: 4, comment: 'Quick and helpful answers on my personal return.' },
  { id: 'h-6', clientId: 'u-client-7', consultantId: 'u-cons-3', date: '2026-09-02', mode: 'in-person', rating: 5, comment: 'Samuel explained our clan land lease in Tok Pisin for the elders. Excellent.' },
  { id: 'h-7', clientId: 'u-client-4', consultantId: 'u-cons-4', date: '2026-10-11', mode: 'in-person', rating: 5, comment: 'Lynette visited our block and our coffee grade improved the next harvest.' },
  { id: 'h-8', clientId: 'u-client-4', consultantId: 'u-cons-4', date: '2026-06-08', mode: 'phone', rating: 4, comment: 'Good advice on forming a cooperative.' },
  { id: 'h-9', clientId: 'u-client-6', consultantId: 'u-cons-5', date: '2026-10-18', mode: 'in-person', rating: 5, comment: 'Kevin set up our school network in one day. Fast internet in every classroom now.' },
  { id: 'h-10', clientId: 'u-client-2', consultantId: 'u-cons-5', date: '2026-08-25', mode: 'video', rating: 4, comment: 'Thorough security review with a clear list of fixes.' },
  { id: 'h-11', clientId: 'u-client-5', consultantId: 'u-cons-6', date: '2026-09-28', mode: 'video', rating: 5, comment: 'The mock interview was tough but I felt so prepared on the day.' },
  // Breaks the review rules (personal attack, not about the session), for testing admin moderation.
  { id: 'h-12', clientId: 'u-client-2', consultantId: 'u-cons-2', date: '2026-11-02', mode: 'phone', rating: 1, comment: 'SCAMMER!!! Do not trust this woman, call 7xxx xxxx and tell her what you think of her.' },
];

const pastBookings: Booking[] = pastSessions.map((s) => {
  const consultant = consultants.find((c) => c.id === s.consultantId);
  return {
    id: `b-${s.id}`,
    clientId: s.clientId,
    consultantId: s.consultantId,
    serviceName: consultant?.services[0]?.name ?? 'Consultation',
    date: s.date,
    time: '10:00',
    durationMins: 60,
    mode: s.mode,
    note: '',
    status: 'completed',
    price: consultant?.hourlyRate ?? 0,
  };
});

const pastReviews: Review[] = pastSessions.map((s) => ({
  id: `r-${s.id}`,
  bookingId: `b-${s.id}`,
  clientId: s.clientId,
  consultantId: s.consultantId,
  rating: s.rating,
  comment: s.comment,
  createdAt: s.date,
}));

export const bookings: Booking[] = [...recentBookings, ...pastBookings];
export const reviews: Review[] = [...recentReviews, ...pastReviews];

export const conversations: Conversation[] = [
  { id: 'c-1', clientId: 'u-client-1', consultantId: 'u-cons-1' },
  { id: 'c-2', clientId: 'u-client-1', consultantId: 'u-cons-2' },
];

export const messages: Message[] = [
  { id: 'm-1', conversationId: 'c-1', senderId: 'u-client-1', text: 'Hi Dr. Kila, can I bring my financial records to our meeting?', sentAt: '2026-11-05T08:12:00', read: true },
  { id: 'm-2', conversationId: 'c-1', senderId: 'u-cons-1', text: 'Yes please, the last 12 months if you have them.', sentAt: '2026-11-05T08:40:00', read: false },
  { id: 'm-3', conversationId: 'c-2', senderId: 'u-client-1', text: 'Is a video call fine for the tax session?', sentAt: '2026-11-04T16:05:00', read: false },
];
