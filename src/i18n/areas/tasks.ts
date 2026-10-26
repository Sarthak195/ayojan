// The task controls on the plan's timeline (spec 5.6, FR-14): mark done, with an amount for a
// booking task, and delayed by a number of days. Both languages share one interface, so a key
// missing from either fails `tsc`.

import { daysEn, slackEn, slackHi } from '../slack-words';

export interface TasksDictionary {
  readonly markDone: string;
  readonly doneFormLabel: (task: string) => string;
  readonly delayFormLabel: (task: string) => string;
  readonly amountLabel: string;
  readonly amountHint: (category: string) => string;
  readonly capacityLabel: string;
  readonly capacityHint: string;
  readonly delayLabel: string;
  readonly delayHint: string;
  readonly save: string;
  readonly notBefore: (date: string) => string;
  readonly moved: (task: string, days: number, because: string, slack: number) => string;
  readonly summaryMoved: (tasks: string) => string;
  readonly summaryNoneMoved: string;
}

export const en: TasksDictionary = {
  markDone: 'Mark done',
  doneFormLabel: (task) => `Mark ${task} done`,
  delayFormLabel: (task) => `Record a delay for ${task}`,
  amountLabel: 'Amount booked, in rupees',
  amountHint: (category) =>
    `Digits only, for example 180000. With an amount, ${category} shows as booked at your number.`,
  capacityLabel: 'Guests the venue holds',
  capacityHint: 'Digits only. It replaces the capacity from your brief.',
  delayLabel: 'Delayed by (days)',
  delayHint: '1 to 60 days, counted from today.',
  save: 'Save',
  notBefore: (date) => `Cannot start before ${date}`,
  moved: (task, days, because, slack) =>
    `${task}: moved ${daysEn(days)} later because ${because} was delayed; now ${slackEn(slack)}`,
  summaryMoved: (tasks) => `Moved later: ${tasks}.`,
  summaryNoneMoved: 'No other task moved.',
};

export const hi: TasksDictionary = {
  markDone: 'पूरा हुआ',
  doneFormLabel: (task) => `${task} को पूरा दर्ज करें`,
  delayFormLabel: (task) => `${task} में देर दर्ज करें`,
  amountLabel: 'बुकिंग की रक़म, रुपये में',
  amountHint: (category) =>
    `सिर्फ़ अंक, जैसे 180000। रक़म देने पर ${category} आपकी संख्या पर बुक दिखेगा।`,
  capacityLabel: 'वेन्यू में कितने मेहमान आ सकते हैं',
  capacityHint: 'सिर्फ़ अंक। यह आपके ब्योरे वाली क्षमता की जगह लेगा।',
  delayLabel: 'कितने दिन की देर',
  delayHint: '1 से 60 दिन, आज से गिनकर।',
  save: 'सहेजें',
  notBefore: (date) => `${date} से पहले शुरू नहीं हो सकता`,
  moved: (task, days, because, slack) =>
    `${task}: ${String(days)} दिन आगे खिसका, क्योंकि ${because} में देर हुई; अब ${slackHi(slack)}`,
  summaryMoved: (tasks) => `आगे खिसके: ${tasks}।`,
  summaryNoneMoved: 'कोई और काम नहीं खिसका।',
};
