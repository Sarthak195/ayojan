import type { PhrasePack } from './phrase-pack';

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

export const ENGLISH: PhrasePack = {
  templateLabel: 'Template, numbers from your plan',
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  occasion: {
    wedding: 'wedding',
    birthday: 'birthday celebration',
    anniversary: 'anniversary',
    puja: 'puja',
    communityEvent: 'community event',
    other: 'event',
  },
  diet: { vegOnly: 'vegetarian food only', jain: 'Jain food', noAlcohol: 'no alcohol' },
  venueLimit: { indoorOnly: 'everything indoors', musicCurfew: 'a music curfew at the venue' },
  quoteField: {
    taxRate: 'tax rate',
    minimumGuests: 'minimum plates',
    guestsCovered: 'guests covered',
    rateAboveMinimum: 'rate above the minimum',
    days: 'number of days',
  },
  status: { atRisk: 'at risk' },
  sentences: {
    title: (occasion, date) => `Update on our ${occasion} on ${date}.`,
    daysToGo: (days) => `${String(days)} ${plural(days, 'day', 'days')} to go.`,
    standing: 'Here is where the plan stands.',
    nothingChanged: 'The budget, guest count and date have not changed.',
    budgetChanged: (now, before) => `The budget is now ${now} (it was ${before}).`,
    guestsChanged: (now, before) =>
      `We now expect ${String(now)} guests (it was ${String(before)}).`,
    dateChanged: (now, before) => `The date is now ${now} (it was ${before}).`,
    spend: (projected, budget) => `Planned spending is ${projected} against a budget of ${budget}.`,
    over: (gap) => `We are ${gap} over budget.`,
    onBudget: 'We are exactly on budget.',
    notPriced: 'Nothing is priced yet, so we cannot say yet how we stand against the budget.',
    under: (headroom) => `We are within budget, with ${headroom} to spare.`,
    levers: (items) => `To manage the budget we chose: ${items}.`,
    leverSaves: (label, amount) => `${label} (saves ${amount})`,
    leverAdds: (label, amount) => `${label} (adds ${amount})`,
    attention: (items) => `Needs attention: ${items}.`,
    attentionItem: (name, status, due) => `${name} (${status}, due by ${due})`,
    lateItem: (name, due, start) =>
      start === 'on'
        ? `${name} (behind schedule for ${due})`
        : `${name} (behind schedule for ${due}: ${start === 'today' ? 'start today' : 'start when the earlier step is done'})`,
    vendors: (count, names) =>
      `We will send questions to ${String(count)} ${plural(count, 'vendor', 'vendors')}: ${names}.`,
    unclear: (items) => `Quote details still unclear: ${items}.`,
    unclearItem: (vendor, fields) => `${vendor} (${fields})`,
    keptInMind: (items) => `Kept in mind: ${items}.`,
    signOff: 'We will keep you posted.',
  },
  vendor: {
    greeting: 'Hello,',
    intro: (occasion, date, guests) =>
      `This is about our ${occasion} on ${date}, for about ${String(guests)} guests.`,
    ask: 'Could you please help with these questions?',
    thanks: 'Thank you.',
  },
  enquiry: {
    intro: (occasion, date, guests, seeking) =>
      `We are planning our ${occasion} on ${date} for about ${String(guests)} guests and are looking for ${seeking}.`,
    seeking: {
      venue: 'a venue',
      catering: 'a caterer',
      decor: 'a decorator',
      photo: 'a photographer',
      music: 'music (a band or DJ)',
    },
    venueHolds: (capacity) => `Our venue holds up to ${String(capacity)} guests.`,
    mustHave: {
      dhol: 'dhol',
      mehndiArtist: 'a mehndi artist',
      liveCounter: 'a live food counter',
      choreographer: 'a choreographer',
    },
    alsoWant: (items) => `We would also like ${items}.`,
    close: 'Please send your price with these details. Thank you.',
  },
};
