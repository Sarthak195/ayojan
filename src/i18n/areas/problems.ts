// The words on every problem page: the 404 pages rendered by React and the HTML pages that
// route handlers answer with (400, 403, 413, 415, 422, 429, 500). Each says what happened and what
// to do next, and none blames the reader.

export interface ProblemText {
  readonly title: string;
  readonly body: string;
}

export interface ProblemsDictionary {
  readonly notFound: ProblemText;
  readonly damagedLink: ProblemText;
  /** D39, verbatim. */
  readonly linkFull: ProblemText;
  /** D06, verbatim. */
  readonly opCap: ProblemText;
  readonly crossSite: ProblemText;
  readonly tooManyRequests: {
    readonly title: string;
    readonly body: (wait: string) => string;
  };
  readonly wait: {
    readonly seconds: (count: number) => string;
    readonly minutes: (count: number) => string;
    readonly hours: (count: number) => string;
  };
  readonly wrongType: ProblemText;
  readonly tooLarge: ProblemText;
  readonly malformed: ProblemText;
  readonly textTooLong: ProblemText;
  readonly cannotApply: ProblemText;
  readonly nothingToUndo: ProblemText;
  readonly nothingPending: ProblemText;
  readonly serverError: ProblemText;
  readonly backToPlan: string;
  readonly startNewPlan: string;
  readonly statusLine: (status: number) => string;
}

export const en: ProblemsDictionary = {
  notFound: {
    title: 'Page not found',
    body: 'There is no page at this address. Check the link, or start a new plan.',
  },
  damagedLink: {
    title: 'This link cannot be opened',
    body: 'The link is damaged or cut short, or it was made by an older version of Ayojan. Check that you copied the whole link, or start a new plan.',
  },
  linkFull: {
    title: "This plan's link is full",
    body: "This plan's link is full; undo a step or start a new plan.",
  },
  opCap: {
    title: 'This plan has reached 40 steps',
    body: 'This plan has reached 40 steps; undo a step or start a new plan.',
  },
  crossSite: {
    title: 'This form came from another site',
    body: 'Ayojan accepts a form only from its own pages. Open your plan link and send the form from there.',
  },
  tooManyRequests: {
    title: 'Too many requests',
    body: (wait) => `Please wait ${wait} and try again. Your plan is safe in its link.`,
  },
  wait: {
    seconds: (count) => `${String(count)} ${count === 1 ? 'second' : 'seconds'}`,
    minutes: (count) => `${String(count)} ${count === 1 ? 'minute' : 'minutes'}`,
    hours: (count) => `${String(count)} ${count === 1 ? 'hour' : 'hours'}`,
  },
  wrongType: {
    title: 'This form was sent in a format we do not accept',
    body: 'Go back and send the form from the page again.',
  },
  tooLarge: {
    title: 'This form is too large',
    body: 'Shorten the text and send it again.',
  },
  malformed: {
    title: 'This form could not be read',
    body: 'It was damaged on the way, or a value in it is not one we accept. Go back and send it again.',
  },
  textTooLong: {
    title: 'This text is too long',
    body: 'A text box holds at most 2,000 characters. Shorten it and send it again.',
  },
  cannotApply: {
    title: 'This step cannot be applied',
    body: 'It does not fit the plan as it stands now. Go back to your plan and try again.',
  },
  nothingToUndo: {
    title: 'Nothing to undo',
    body: 'Only the first step, the brief, is left. Start a new plan to change it.',
  },
  nothingPending: {
    title: 'Nothing is waiting to be confirmed',
    body: 'This reading was already confirmed or cancelled. Go back to your plan.',
  },
  serverError: {
    title: 'Something went wrong on our side',
    body: 'Your plan is safe in its link. Go back and try again.',
  },
  backToPlan: 'Back to your plan',
  startNewPlan: 'Start a new plan',
  statusLine: (status) => `Error ${String(status)}`,
};

export const hi: ProblemsDictionary = {
  notFound: {
    title: 'पेज नहीं मिला',
    body: 'इस पते पर कोई पेज नहीं है। लिंक जाँचें, या नई योजना शुरू करें।',
  },
  damagedLink: {
    title: 'यह लिंक नहीं खुल सकता',
    body: 'लिंक टूटा या अधूरा है, या आयोजन के पुराने संस्करण से बना है। देखें कि आपने पूरा लिंक कॉपी किया है, या नई योजना शुरू करें।',
  },
  linkFull: {
    title: 'इस योजना का लिंक भर गया है',
    body: 'इस योजना का लिंक भर गया है; एक क़दम वापस लें या नई योजना शुरू करें।',
  },
  opCap: {
    title: 'इस योजना में 40 क़दम हो गए हैं',
    body: 'इस योजना में 40 क़दम हो गए हैं; एक क़दम वापस लें या नई योजना शुरू करें।',
  },
  crossSite: {
    title: 'यह फ़ॉर्म किसी दूसरी साइट से आया',
    body: 'आयोजन सिर्फ़ अपने पेजों से भेजे गए फ़ॉर्म लेता है। अपनी योजना का लिंक खोलें और वहीं से फ़ॉर्म भेजें।',
  },
  tooManyRequests: {
    title: 'बहुत ज़्यादा अनुरोध',
    body: (wait) => `कृपया ${wait} रुककर फिर कोशिश करें। आपकी योजना उसके लिंक में सुरक्षित है।`,
  },
  wait: {
    seconds: (count) => `${String(count)} सेकंड`,
    minutes: (count) => `${String(count)} मिनट`,
    hours: (count) => `${String(count)} घंटे`,
  },
  wrongType: {
    title: 'यह फ़ॉर्म ऐसे रूप में आया जिसे हम नहीं लेते',
    body: 'वापस जाएँ और पेज से फ़ॉर्म फिर भेजें।',
  },
  tooLarge: {
    title: 'यह फ़ॉर्म बहुत बड़ा है',
    body: 'लिखा हुआ छोटा करें और फिर भेजें।',
  },
  malformed: {
    title: 'यह फ़ॉर्म पढ़ा नहीं जा सका',
    body: 'रास्ते में यह बिगड़ गया, या इसमें कोई ऐसा मान है जिसे हम नहीं लेते। वापस जाएँ और फिर भेजें।',
  },
  textTooLong: {
    title: 'यह लिखा हुआ बहुत लंबा है',
    body: 'एक बॉक्स में ज़्यादा से ज़्यादा 2,000 अक्षर आते हैं। इसे छोटा करें और फिर भेजें।',
  },
  cannotApply: {
    title: 'यह क़दम लागू नहीं हो सकता',
    body: 'यह अभी की योजना में नहीं बैठता। अपनी योजना पर वापस जाएँ और फिर कोशिश करें।',
  },
  nothingToUndo: {
    title: 'वापस लेने को कुछ नहीं',
    body: 'सिर्फ़ पहला क़दम, यानी ब्योरा, बचा है। उसे बदलने के लिए नई योजना शुरू करें।',
  },
  nothingPending: {
    title: 'पक्का करने को कुछ बाक़ी नहीं',
    body: 'यह पढ़ा हुआ नतीजा पहले ही पक्का या रद्द हो चुका है। अपनी योजना पर वापस जाएँ।',
  },
  serverError: {
    title: 'हमारी तरफ़ से कुछ गड़बड़ हो गई',
    body: 'आपकी योजना उसके लिंक में सुरक्षित है। वापस जाएँ और फिर कोशिश करें।',
  },
  backToPlan: 'अपनी योजना पर वापस जाएँ',
  startNewPlan: 'नई योजना शुरू करें',
  statusLine: (status) => `गड़बड़ी ${String(status)}`,
};
