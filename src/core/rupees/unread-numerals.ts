// The Hindi numbers from eleven to ninety-nine that the scanner does not read (D44). They are
// never a figure, because their romanised spellings vary too much to read safely, but they are
// still number words: "pachees-tees hazaar" is a range whose near end is one of them, and
// without this list the far end ("tees hazaar") would be read as the one figure. A spelling
// that is also an ordinary word ("tera" is "your", "bara" is "big", "sath" is "with") is left
// out, so a sentence is never turned into a range by accident.

import { normalizeWord } from './number-words';

const LATIN = [
  'gyarah gyaarah barah baarah terah chaudah pandrah solah satrah atharah athaarah',
  'unnis unnees ikkis ikkees bais baais teis teyis chaubis chaubees pachis pachees',
  'pacchis chhabbis chabbis sattais sattaees atthais athais untis untees ikattis',
  'iktees battis battees taintis taintees chauntis paintis paintees',
  'chhattis chattis saintis saintees adtis adtees untalis untalees iktalis iktalees',
  'byalis bayalis tentalis taintalis chavalis chawalis paintalis paintalees',
  'chhiyalis saintalis adtalis artalis unchas ikyavan ikyawan bavan baawan tirpan',
  'chauvan chauwan pachpan chhappan chappan sattavan sattawan atthavan atthawan',
  'unsath unsaath iksath iksaath basath baasath tirsath tresath chausath chaunsath',
  'painsath chhiyasath sadsath adsath arsath unhattar ikhattar bahattar tihattar',
  'chauhattar pachhattar pachattar chhihattar sathattar satattar athattar unyasi',
  'unasi ikyasi bayasi tirasi chaurasi pachasi chhiyasi sattasi atthasi athasi',
  'navasi nawasi ikyanve ikyanave banve baanve tiranve chauranve pachanve pachaanve',
  'chhiyanve sattanve atthanve ninyanve ninnyanve',
].join(' ');

const DEVANAGARI = [
  'ग्यारह बारह तेरह चौदह पंद्रह पन्द्रह सोलह सत्रह अठारह उन्नीस इक्कीस बाईस तेईस',
  'चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस',
  'छत्तीस सैंतीस अड़तीस उनतालीस इकतालीस बयालीस तैंतालीस चवालीस चौवालीस पैंतालीस',
  'छियालीस सैंतालीस अड़तालीस उनचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन',
  'अट्ठावन उनसठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर इकहत्तर',
  'बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी उनासी इक्यासी',
  'बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी इक्यानवे बानवे तिरानवे',
  'चौरानवे पचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे',
].join(' ');

// Kept as space-separated strings so the list stays short enough to read in one screen.
const UNREAD: ReadonlySet<string> = new Set(
  `${LATIN} ${DEVANAGARI}`.split(' ').map((word) => normalizeWord(word)),
);

/** True for a Hindi number from 11 to 99 that is outside the read table. */
export function isUnreadNumeral(normalized: string): boolean {
  return UNREAD.has(normalized);
}
