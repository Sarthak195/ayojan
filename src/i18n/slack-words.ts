// Slack as a family says it. "-56 days slack" read as jargon with a sign in it, so a negative
// count is said as days late and a positive one as days to spare, in both languages.

export function daysEn(count: number): string {
  return count === 1 ? '1 day' : `${String(count)} days`;
}

export function slackEn(slack: number): string {
  if (slack < 0) return `${daysEn(-slack)} late`;
  return slack === 0 ? 'no days to spare' : `${daysEn(slack)} to spare`;
}

export function slackHi(slack: number): string {
  if (slack < 0) return `${String(-slack)} दिन की देरी`;
  return slack === 0 ? 'कोई गुंजाइश नहीं' : `${String(slack)} दिन की गुंजाइश`;
}
