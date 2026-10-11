/**
 * Sample values for the template placeholders in the Settings → Email
 * templates previews, in the interface language (`emailTpl.sample.*`), so a
 * Georgian or Russian admin previews a Georgian or Russian email.
 */
export function previewSamples(t: (key: string) => string): Record<string, string> {
  const interviewer = t('emailTpl.sample.interviewerName')
  const interviewerEmail = t('emailTpl.sample.interviewerEmail')
  return {
    '{{candidate_name}}': t('emailTpl.sample.candidateName'),
    '{{role}}': t('emailTpl.sample.role'),
    '{{company}}': t('emailTpl.sample.company'),
    '{{interview_date}}': t('emailTpl.sample.interviewDate'),
    '{{interview_time}}': t('emailTpl.sample.interviewTime'),
    '{{meeting_link}}': 'https://meet.google.com/abc-defg-hij',
    '{{interviewer_name}}': interviewer,
    '{{interviewer_email}}': interviewerEmail,
    '{{sender_name}}': interviewer,
    '{{sender_email}}': interviewerEmail,
    '{{status_url}}': 'https://hrhandle.com/status/…',
    '{{offer_url}}': 'https://hrhandle.com/offer/…',
  }
}

/** Replace every occurrence of each placeholder; unknown ones stay as typed. */
export function fillPreview(text: string, samples: Record<string, string>): string {
  let out = text
  for (const [token, value] of Object.entries(samples)) out = out.replaceAll(token, value)
  return out
}
