// The trade-off chooser (spec 6.6, C7, FR-31 to FR-33). The running line itself is worded by
// core (runningLineSentence) so the server and the island print the same sentence.

export interface LeversDictionary {
  readonly title: string;
  readonly heading: string;
  readonly overBy: string;
  readonly withinBudget: string;
  readonly backToPlan: string;
  readonly legend: string;
  readonly nothingTicked: string;
  readonly saves: string;
  readonly wouldSave: string;
  readonly bufferLeft: string;
  readonly alsoClears: (task: string, status: string) => string;
  readonly refused: (category: string) => string;
  readonly notSuggested: string;
  readonly showAnyway: string;
  readonly disabled: (mustHave: string) => string;
  readonly booked: (category: string) => string;
  readonly chosenHeading: string;
  readonly chosenNote: string;
  readonly whyThisNumber: string;
  readonly recalculate: string;
  readonly recalculateHint: string;
  readonly apply: string;
  readonly previewNote: string;
  readonly exhausted: string;
}

export const en: LeversDictionary = {
  title: 'Trade-offs',
  heading: 'Close the gap',
  overBy: 'Over budget by',
  withinBudget: 'Your plan is within budget, so there is nothing to trade off.',
  backToPlan: 'Back to the plan',
  legend: 'Choose what to change. Nothing is ticked for you.',
  nothingTicked: 'Nothing is applied until you press Apply my choices.',
  saves: 'Saves',
  wouldSave: 'Would save about',
  bufferLeft: 'Reserve left',
  alsoClears: (task, status) => `Also clears ${task}: ${status}`,
  refused: (category) => `${category} is your priority, so this is not suggested.`,
  notSuggested: 'Not suggested',
  showAnyway: 'Show anyway',
  disabled: (mustHave) => `Not available: you said ${mustHave} is a must-have.`,
  booked: (category) => `Not available: ${category} is already booked; ask your vendor.`,
  chosenHeading: 'Already chosen',
  chosenNote: 'These stay in force. Undo the step to take one back.',
  whyThisNumber: 'Why this number?',
  recalculate: 'Recalculate',
  recalculateHint: 'Recalculate shows the total for the boxes you ticked, without applying them.',
  apply: 'Apply my choices',
  previewNote: 'Preview: nothing is applied yet.',
  exhausted:
    'Every lever on offer is ticked and the plan is still over budget. What remains is a lever that goes against your priority, a higher budget or fewer guests (a change).',
};

export const hi: LeversDictionary = {
  title: 'समझौते',
  heading: 'अंतर कम करें',
  overBy: 'बजट से ज़्यादा',
  withinBudget: 'आपकी योजना बजट के अंदर है, इसलिए कोई समझौता ज़रूरी नहीं।',
  backToPlan: 'योजना पर लौटें',
  legend: 'चुनें कि क्या बदलना है। आपके लिए कुछ भी पहले से नहीं चुना गया।',
  nothingTicked: 'जब तक आप "मेरी पसंद लागू करें" नहीं दबाते, कुछ लागू नहीं होगा।',
  saves: 'बचत',
  wouldSave: 'लगभग बचत होगी',
  bufferLeft: 'बचा हुआ रिज़र्व',
  alsoClears: (task, status) => `${task} भी अब "${status}" नहीं रहेगा`,
  refused: (category) => `${category} आपकी प्राथमिकता है, इसलिए यह सुझाया नहीं गया।`,
  notSuggested: 'सुझाया नहीं गया',
  showAnyway: 'फिर भी दिखाएँ',
  disabled: (mustHave) => `उपलब्ध नहीं: आपने कहा था कि ${mustHave} ज़रूरी है।`,
  booked: (category) => `उपलब्ध नहीं: ${category} पहले से बुक है; अपने वेंडर से पूछें।`,
  chosenHeading: 'पहले से चुने हुए',
  chosenNote: 'ये लागू रहेंगे। किसी को हटाने के लिए वह क़दम वापस लें।',
  whyThisNumber: 'यह संख्या क्यों?',
  recalculate: 'फिर से गिनें',
  recalculateHint: '"फिर से गिनें" चुने हुए बक्सों का जोड़ दिखाता है, लागू नहीं करता।',
  apply: 'मेरी पसंद लागू करें',
  previewNote: 'झलक: अभी कुछ लागू नहीं हुआ।',
  exhausted:
    'जितने विकल्प सुझाए गए, सब चुन लिए, फिर भी योजना बजट से ज़्यादा है। अब बचे हैं: आपकी प्राथमिकता के ख़िलाफ़ वाला विकल्प, बड़ा बजट, या कम मेहमान (एक बदलाव)।',
};
