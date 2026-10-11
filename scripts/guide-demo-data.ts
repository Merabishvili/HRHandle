/**
 * Demo data for the guide screenshots — one fictional company per language, so
 * the Georgian guide shows Georgian names and vacancies, the Russian guide
 * Russian ones. Read by `scripts/seed-guide-demo.ts` (writes it to the staging
 * database) and `scripts/capture-screenshots.ts` (logs in as the owner, types
 * the walkthrough examples).
 *
 * Every language tells the same hiring story (the STORY_* skeletons below):
 * the same people apply to the same roles, move through the same stages and get
 * the same interviews and offers — only names and texts are translated.
 *
 * Emails use example.com (reserved, never delivered). All names are invented.
 */
import type { Locale } from '@/lib/i18n/locales'

export type StageCode = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
export type UserKey = 'owner' | 'admin' | 'member'
type VacancyKey = 'engineer' | 'designer' | 'sales' | 'hr' | 'accountant' | 'support'

export interface DemoUser {
  key: UserKey
  fullName: string
  email: string
  role: 'owner' | 'admin' | 'member'
}

export interface DemoVacancy {
  key: string
  title: string
  department: string
  location: string
  workMode: 'onsite' | 'hybrid' | 'remote'
  employmentType: 'full_time' | 'part_time' | 'contract' | 'internship'
  status: 'draft' | 'open' | 'on_hold' | 'closed'
  salaryMin: number | null
  salaryMax: number | null
  hiringManager: UserKey
  /** Created this many days ago (orders the list; drives "time open"). */
  daysAgo: number
  description: string
  responsibilities: string
  requirements: string
}

export interface DemoCandidate {
  key: string
  firstName: string
  lastName: string
  email: string
  phone: string
  position: string
  company: string
  location: string
  source: string
  years: number
  languages?: string[]
  salaryExpectation?: string
  noticePeriod?: string
}

export interface DemoApplication {
  candidate: string
  vacancy: VacancyKey
  /** Stage history, oldest first; the last entry is the current stage. */
  journey: { stage: StageCode; daysAgo: number }[]
  sourceType: 'manual' | 'public_form' | 'linkedin'
}

export interface DemoInterview {
  candidate: string
  vacancy: VacancyKey
  interviewer: UserKey
  /** Days from today (negative = past), at `time` Tbilisi time. */
  inDays: number
  time: string
  duration: number
  type: 'video' | 'phone' | 'onsite'
  status: 'scheduled' | 'completed'
  rating?: number
  feedback?: string
  link?: string
}

export interface DemoOffer {
  candidate: string
  vacancy: VacancyKey
  status: 'sent' | 'accepted'
  amount: number
  sentDaysAgo: number
  respondedDaysAgo?: number
  startInDays: number
  expiryInDays: number
  body: string
  message?: string
}

export interface DemoEvaluation {
  candidate: string
  vacancy: VacancyKey
  reviewer: UserKey
  /** One 1–5 score per scorecard attribute, in order. */
  scores: number[]
  recommendation: 'strong_yes' | 'yes' | 'lean_no' | 'no'
  reason: string
  /** The interviewer's notes on each interview-guide prompt, in order. */
  answers?: string[]
  daysAgo: number
}

export interface DemoNote {
  candidate: string
  author: UserKey
  /** Mentions are written as "@Full Name" in the text. */
  mention?: UserKey
  text: string
  daysAgo: number
}

export interface DemoCustomField {
  name: string
  type: 'text' | 'number' | 'checkbox' | 'dropdown'
  options?: string[]
}

export interface DemoScreeningQuestion {
  label: string
  answerType: 'yes_no' | 'short_text' | 'number'
  knockout?: { yes: true } | { atLeast: number }
}

/** A new person whose CV the "Add a candidate" walkthrough uploads (never saved). */
export interface DemoCv {
  firstName: string
  lastName: string
  email: string
  phone: string
  title: string
  location: string
  summary: string
  experience: { title: string; company: string; period: string; text: string }[]
  education: { degree: string; school: string; period: string }
  skills: string
  languages: string
  headings: { experience: string; education: string; skills: string; languages: string }
}

/** What the walkthroughs type into forms (e.g. the Create vacancy wizard). */
export interface DemoWizard {
  title: string
  department: string
  location: string
  /** Optional context for the AI writer. */
  aiContext: string
  scorecard: { label: string; mustHave: boolean }[]
  screening: {
    yesNo: string
    number: string
  }
}

export interface DemoOrg {
  locale: Locale
  companyName: string
  users: DemoUser[]
  vacancies: DemoVacancy[]
  candidates: DemoCandidate[]
  applications: DemoApplication[]
  /** Scorecard attributes, interview-guide prompts and screening questions of the engineer vacancy. */
  engineerScorecard: { label: string; mustHave: boolean }[]
  engineerGuide: string[]
  engineerScreening: DemoScreeningQuestion[]
  /** Public applicants' answers to the engineer screening questions, in order. */
  screeningAnswers: { candidate: string; answers: string[] }[]
  experience: { candidate: string; company: string; title: string; from: string; to: string | null; description: string }[]
  education: { candidate: string; institution: string; degree: string; field: string; from: number; to: number }[]
  interviews: DemoInterview[]
  offers: DemoOffer[]
  evaluations: DemoEvaluation[]
  notes: DemoNote[]
  rejectionReasons: { name: string; subject: string; body: string }[]
  invite: { email: string; role: 'admin' | 'member' }
  /** The team's Slack channel for HRHandle notifications (Settings → Slack & Teams). */
  slackChannel: string
  /** The company's LinkedIn page id (Settings → Integrations) — enables "Post to LinkedIn Jobs". */
  linkedInPageId: string
  /** AI Fit Analysis of the showcase candidate (the AI walkthrough seeds it — no model call),
   * per engineer-scorecard criterion in order, plus a reviewer's override reason on another one. */
  aiFit: {
    criteria: { match: number; evidence: string; explanation: string }[]
    strengths: { text: string; evidence: string }[]
    toVerify: string[]
    questions: string[]
    overrideReason: string
  }
  /** A sentence the inclusive-language check should flag (typed in, never saved), and the
   * check's answer — served to the page by the walkthrough so the picture never varies. */
  biasedSentence: string
  biasFindings: { phrase: string; category: 'age_coded' | 'gender_coded' | 'cultural_fit_code'; reason: string; suggestion: string }[]
  /** A dropdown field the custom-fields walkthrough types into the form (never saved). */
  newCustomField: { name: string; options: string[] }
  vacancyFields: { group: string; fields: DemoCustomField[] }
  candidateFields: { group: string; fields: DemoCustomField[]; referredBy: string }
  /** Deleted a few days ago — shown in Settings → Trash. */
  trash: { candidate: DemoCandidate; vacancy: DemoVacancy }
  wizard: DemoWizard
  /** The CV uploaded in "Add a candidate". */
  cv: DemoCv
  /** Spreadsheet rows for "Import candidates" (template columns, in order). One has a
   * bad email and one repeats an existing candidate's email, to show the review step. */
  importRows: string[][]
}

// ── The shared story ─────────────────────────────────────────────────────────

const STORY_APPLICATIONS: DemoApplication[] = [
  { candidate: 'c1', vacancy: 'engineer', sourceType: 'linkedin', journey: [{ stage: 'applied', daysAgo: 18 }, { stage: 'screening', daysAgo: 15 }, { stage: 'interview', daysAgo: 10 }] },
  { candidate: 'c2', vacancy: 'engineer', sourceType: 'manual', journey: [{ stage: 'applied', daysAgo: 12 }, { stage: 'screening', daysAgo: 8 }] },
  { candidate: 'c3', vacancy: 'engineer', sourceType: 'public_form', journey: [{ stage: 'applied', daysAgo: 4 }] },
  { candidate: 'c4', vacancy: 'engineer', sourceType: 'linkedin', journey: [{ stage: 'applied', daysAgo: 20 }, { stage: 'screening', daysAgo: 17 }, { stage: 'interview', daysAgo: 13 }, { stage: 'offer', daysAgo: 3 }] },
  { candidate: 'c5', vacancy: 'engineer', sourceType: 'public_form', journey: [{ stage: 'applied', daysAgo: 2 }] },
  { candidate: 'c9', vacancy: 'engineer', sourceType: 'public_form', journey: [{ stage: 'applied', daysAgo: 19 }, { stage: 'screening', daysAgo: 16 }, { stage: 'rejected', daysAgo: 14 }] },
  { candidate: 'c10', vacancy: 'engineer', sourceType: 'public_form', journey: [{ stage: 'applied', daysAgo: 16 }, { stage: 'screening', daysAgo: 12 }, { stage: 'interview', daysAgo: 7 }, { stage: 'offer', daysAgo: 1 }] },
  { candidate: 'c6', vacancy: 'designer', sourceType: 'manual', journey: [{ stage: 'applied', daysAgo: 10 }, { stage: 'screening', daysAgo: 7 }] },
  { candidate: 'c7', vacancy: 'designer', sourceType: 'linkedin', journey: [{ stage: 'applied', daysAgo: 11 }, { stage: 'screening', daysAgo: 9 }, { stage: 'interview', daysAgo: 5 }] },
  { candidate: 'c11', vacancy: 'designer', sourceType: 'public_form', journey: [{ stage: 'applied', daysAgo: 3 }] },
  { candidate: 'c12', vacancy: 'designer', sourceType: 'public_form', journey: [{ stage: 'applied', daysAgo: 12 }, { stage: 'rejected', daysAgo: 9 }] },
  { candidate: 'c8', vacancy: 'sales', sourceType: 'public_form', journey: [{ stage: 'applied', daysAgo: 5 }] },
  { candidate: 'c13', vacancy: 'sales', sourceType: 'linkedin', journey: [{ stage: 'applied', daysAgo: 7 }, { stage: 'screening', daysAgo: 4 }] },
  { candidate: 'c14', vacancy: 'accountant', sourceType: 'public_form', journey: [{ stage: 'applied', daysAgo: 55 }, { stage: 'screening', daysAgo: 50 }, { stage: 'interview', daysAgo: 44 }, { stage: 'offer', daysAgo: 36 }, { stage: 'hired', daysAgo: 31 }] },
  { candidate: 'c15', vacancy: 'accountant', sourceType: 'manual', journey: [{ stage: 'applied', daysAgo: 57 }, { stage: 'screening', daysAgo: 52 }, { stage: 'interview', daysAgo: 46 }, { stage: 'rejected', daysAgo: 40 }] },
  { candidate: 'c16', vacancy: 'support', sourceType: 'linkedin', journey: [{ stage: 'applied', daysAgo: 42 }, { stage: 'screening', daysAgo: 38 }, { stage: 'interview', daysAgo: 33 }, { stage: 'offer', daysAgo: 28 }, { stage: 'hired', daysAgo: 25 }] },
]

type InterviewSkeleton = Omit<DemoInterview, 'feedback'>
const STORY_INTERVIEWS: InterviewSkeleton[] = [
  { candidate: 'c1', vacancy: 'engineer', interviewer: 'admin', inDays: -10, time: '11:00', duration: 60, type: 'video', status: 'completed', rating: 4 },
  { candidate: 'c1', vacancy: 'engineer', interviewer: 'owner', inDays: 2, time: '15:00', duration: 60, type: 'video', status: 'scheduled', link: 'https://meet.google.com/kfq-txzw-pmd' },
  { candidate: 'c4', vacancy: 'engineer', interviewer: 'admin', inDays: -13, time: '14:00', duration: 60, type: 'video', status: 'completed', rating: 5 },
  { candidate: 'c7', vacancy: 'designer', interviewer: 'owner', inDays: 1, time: '11:00', duration: 45, type: 'onsite', status: 'scheduled' },
  { candidate: 'c13', vacancy: 'sales', interviewer: 'admin', inDays: 3, time: '10:00', duration: 30, type: 'phone', status: 'scheduled' },
]

type EvaluationSkeleton = Omit<DemoEvaluation, 'reason'>
const STORY_EVALUATIONS: EvaluationSkeleton[] = [
  { candidate: 'c1', vacancy: 'engineer', reviewer: 'admin', scores: [4, 5, 4, 4], recommendation: 'yes', daysAgo: 10 },
  { candidate: 'c1', vacancy: 'engineer', reviewer: 'owner', scores: [4, 4, 5, 3], recommendation: 'yes', daysAgo: 9 },
  { candidate: 'c4', vacancy: 'engineer', reviewer: 'admin', scores: [5, 5, 4, 5], recommendation: 'strong_yes', daysAgo: 13 },
]

const withTexts = <T, U>(skeletons: T[], texts: string[], key: string): (T & U)[] =>
  skeletons.map((s, i) => ({ ...s, [key]: texts[i] ?? '' }) as T & U)

/** Adds interview-guide answers to the first evaluations (in STORY_EVALUATIONS order). */
const withAnswers = (evaluations: DemoEvaluation[], answers: string[][]): DemoEvaluation[] =>
  evaluations.map((e, i) => (answers[i] ? { ...e, answers: answers[i] } : e))

// ── English ──────────────────────────────────────────────────────────────────

const EN: DemoOrg = {
  locale: 'en',
  companyName: 'Acme Corporation',
  users: [
    { key: 'owner', fullName: 'Emily Carter', email: 'guide.en.owner@example.com', role: 'owner' },
    { key: 'admin', fullName: 'Daniel Lee', email: 'guide.en.admin@example.com', role: 'admin' },
    { key: 'member', fullName: 'Sarah Johnson', email: 'guide.en.member@example.com', role: 'member' },
  ],
  vacancies: [
    {
      key: 'engineer', title: 'Senior Software Engineer', department: 'Engineering', location: 'Tbilisi, Georgia',
      workMode: 'hybrid', employmentType: 'full_time', status: 'open', salaryMin: 6000, salaryMax: 8000, hiringManager: 'admin', daysAgo: 21,
      description: 'Join our platform team to build the features our customers use every day. You will own work from design to release and help shape how we build software.',
      responsibilities: 'Design, build and ship features across the stack.\nReview code and write tests.\nMentor mid-level engineers.',
      requirements: '5+ years of professional software development.\nStrong TypeScript and React skills.\nExperience with PostgreSQL.',
    },
    {
      key: 'designer', title: 'Product Designer', department: 'Design', location: 'Tbilisi, Georgia',
      workMode: 'remote', employmentType: 'full_time', status: 'open', salaryMin: 4000, salaryMax: 5500, hiringManager: 'owner', daysAgo: 14,
      description: 'Design new parts of our product from research to final screens, working closely with engineering and product.',
      responsibilities: 'Run user research.\nCreate flows, prototypes and final designs.\nMaintain the design system.',
      requirements: '3+ years of product design.\nFluent in Figma.\nA portfolio of shipped work.',
    },
    {
      key: 'sales', title: 'Sales Manager', department: 'Sales', location: 'Batumi, Georgia',
      workMode: 'onsite', employmentType: 'full_time', status: 'open', salaryMin: 3000, salaryMax: 4500, hiringManager: 'admin', daysAgo: 9,
      description: 'Grow our customer base in western Georgia and look after key accounts.',
      responsibilities: 'Find and win new customers.\nManage key accounts.\nReport on the sales pipeline.',
      requirements: '3+ years in B2B sales.\nExcellent negotiation skills.\nA driving licence.',
    },
    {
      key: 'hr', title: 'HR Coordinator', department: 'People', location: 'Tbilisi, Georgia',
      workMode: 'onsite', employmentType: 'part_time', status: 'draft', salaryMin: null, salaryMax: null, hiringManager: 'owner', daysAgo: 3,
      description: 'Support the people team with onboarding, employee records and HR policies.',
      responsibilities: 'Organise onboarding for new hires.\nKeep employee records up to date.',
      requirements: '1+ year in HR.\nVery well organised.',
    },
    {
      key: 'accountant', title: 'Accountant', department: 'Finance', location: 'Tbilisi, Georgia',
      workMode: 'onsite', employmentType: 'full_time', status: 'closed', salaryMin: 2500, salaryMax: 3500, hiringManager: 'owner', daysAgo: 60,
      description: 'Keep our books accurate and help close each month on time.',
      responsibilities: 'Record transactions.\nPrepare monthly reports.\nWork with external auditors.',
      requirements: '2+ years in accounting.\nKnowledge of Georgian tax rules.',
    },
    {
      key: 'support', title: 'Customer Support Specialist', department: 'Support', location: 'Tbilisi, Georgia',
      workMode: 'onsite', employmentType: 'full_time', status: 'closed', salaryMin: 1800, salaryMax: 2400, hiringManager: 'admin', daysAgo: 45,
      description: 'Help our customers by email, chat and phone, and make sure every question gets a clear answer.',
      responsibilities: 'Answer customer questions.\nLog and follow up on issues.\nImprove help articles.',
      requirements: '1+ year in customer support.\nFluent English and Georgian.',
    },
  ],
  candidates: [
    { key: 'c1', firstName: 'Lukas', lastName: 'Becker', email: 'lukas.becker@example.com', phone: '+995 555 10 20 31', position: 'Senior Backend Engineer', company: 'Northline Software', location: 'Tbilisi, Georgia', source: 'LinkedIn', years: 7, languages: ['English', 'German', 'Georgian'], salaryExpectation: '7,000 GEL', noticePeriod: '1 month' },
    { key: 'c2', firstName: 'Sofia', lastName: 'Rossi', email: 'sofia.rossi@example.com', phone: '+995 555 10 20 32', position: 'Full Stack Developer', company: 'Peak Digital', location: 'Tbilisi, Georgia', source: 'Referral', years: 5 },
    { key: 'c3', firstName: 'Marco', lastName: 'Silva', email: 'marco.silva@example.com', phone: '+995 555 10 20 33', position: 'Software Engineer', company: 'Bluepeak', location: 'Batumi, Georgia', source: 'Careers page', years: 4 },
    { key: 'c4', firstName: 'Olivia', lastName: 'Brown', email: 'olivia.brown@example.com', phone: '+995 555 10 20 34', position: 'Lead Developer', company: 'Orbit Studio', location: 'Tbilisi, Georgia', source: 'LinkedIn', years: 9 },
    { key: 'c5', firstName: 'James', lastName: 'Wilson', email: 'james.wilson@example.com', phone: '+995 555 10 20 35', position: 'Frontend Developer', company: 'Nova Labs', location: 'Remote', source: 'Careers page', years: 3 },
    { key: 'c6', firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@example.com', phone: '+995 555 10 20 36', position: 'UX Designer', company: 'Peak Digital', location: 'Tbilisi, Georgia', source: 'Referral', years: 4 },
    { key: 'c7', firstName: 'Ethan', lastName: 'Clarke', email: 'ethan.clarke@example.com', phone: '+995 555 10 20 37', position: 'Product Designer', company: 'Orbit Studio', location: 'Remote', source: 'LinkedIn', years: 6 },
    { key: 'c8', firstName: 'Grace', lastName: 'Taylor', email: 'grace.taylor@example.com', phone: '+995 555 10 20 38', position: 'Account Manager', company: 'Silk Road Retail', location: 'Batumi, Georgia', source: 'Careers page', years: 5 },
    { key: 'c9', firstName: 'Noah', lastName: 'Kim', email: 'noah.kim@example.com', phone: '+995 555 10 20 39', position: 'Backend Developer', company: 'Nova Labs', location: 'Tbilisi, Georgia', source: 'Careers page', years: 2 },
    { key: 'c10', firstName: 'Hannah', lastName: 'Müller', email: 'hannah.mueller@example.com', phone: '+995 555 10 20 40', position: 'Software Engineer', company: 'Northline Software', location: 'Tbilisi, Georgia', source: 'Careers page', years: 6 },
    { key: 'c11', firstName: 'Liam', lastName: 'Novak', email: 'liam.novak@example.com', phone: '+995 555 10 20 41', position: 'UI Designer', company: 'Peak Digital', location: 'Remote', source: 'Careers page', years: 3 },
    { key: 'c12', firstName: 'Chloe', lastName: 'Martin', email: 'chloe.martin@example.com', phone: '+995 555 10 20 42', position: 'Graphic Designer', company: 'Orbit Studio', location: 'Tbilisi, Georgia', source: 'Careers page', years: 2 },
    { key: 'c13', firstName: 'Lucas', lastName: 'Garcia', email: 'lucas.garcia@example.com', phone: '+995 555 10 20 43', position: 'Sales Representative', company: 'Silk Road Retail', location: 'Batumi, Georgia', source: 'LinkedIn', years: 4 },
    { key: 'c14', firstName: 'Mia', lastName: 'Fischer', email: 'mia.fischer@example.com', phone: '+995 555 10 20 44', position: 'Accountant', company: 'Bluepeak', location: 'Tbilisi, Georgia', source: 'Careers page', years: 5 },
    { key: 'c15', firstName: 'Oliver', lastName: 'Smith', email: 'oliver.smith@example.com', phone: '+995 555 10 20 45', position: 'Junior Accountant', company: 'Nova Labs', location: 'Tbilisi, Georgia', source: 'Referral', years: 1 },
    { key: 'c16', firstName: 'Ava', lastName: 'Lopez', email: 'ava.lopez@example.com', phone: '+995 555 10 20 46', position: 'Support Specialist', company: 'Peak Digital', location: 'Tbilisi, Georgia', source: 'LinkedIn', years: 3 },
  ],
  applications: STORY_APPLICATIONS,
  engineerScorecard: [
    { label: 'TypeScript', mustHave: true },
    { label: 'System design', mustHave: true },
    { label: 'Code quality', mustHave: false },
    { label: 'Communication', mustHave: false },
  ],
  engineerGuide: ['Tell us about a system you designed from start to finish.', 'How do you review a teammate’s code?'],
  engineerScreening: [
    { label: 'Do you have the right to work in Georgia?', answerType: 'yes_no', knockout: { yes: true } },
    { label: 'How many years of experience do you have with TypeScript?', answerType: 'number', knockout: { atLeast: 3 } },
    { label: 'When can you start?', answerType: 'short_text' },
  ],
  screeningAnswers: [
    { candidate: 'c3', answers: ['yes', '4', 'In two weeks'] },
    { candidate: 'c5', answers: ['yes', '2', 'From next month'] },
  ],
  experience: [
    { candidate: 'c1', company: 'Northline Software', title: 'Senior Backend Engineer', from: '2021-03-01', to: null, description: 'Leads the payments API team. Moved the billing service to event-driven processing.' },
    { candidate: 'c1', company: 'Peak Digital', title: 'Backend Engineer', from: '2018-06-01', to: '2021-02-28', description: 'Built REST APIs in Node.js and TypeScript for e-commerce clients.' },
  ],
  education: [
    { candidate: 'c1', institution: 'Tbilisi State University', degree: 'Bachelor', field: 'Computer Science', from: 2014, to: 2018 },
  ],
  interviews: withTexts<InterviewSkeleton, Pick<DemoInterview, 'feedback'>>(STORY_INTERVIEWS, [
    'Strong system design: explained trade-offs clearly. Recommend the final round.',
    '',
    'Excellent technical depth and clear communication.',
  ], 'feedback'),
  offers: [
    { candidate: 'c4', vacancy: 'engineer', status: 'sent', amount: 7500, sentDaysAgo: 3, startInDays: 30, expiryInDays: 7, body: 'We are delighted to offer you the position of Senior Software Engineer at Acme Corporation. You will join the platform team in Tbilisi in a hybrid role, reporting to Daniel Lee. The offer includes 24 days of paid leave and private health insurance.', message: 'We all enjoyed meeting you and hope you will join us. If anything in the offer is unclear, just give me a call.' },
    { candidate: 'c14', vacancy: 'accountant', status: 'accepted', amount: 3200, sentDaysAgo: 36, respondedDaysAgo: 31, startInDays: -20, expiryInDays: -29, body: 'We are pleased to offer you the position of Accountant at Acme Corporation, working in our Tbilisi office.' },
    { candidate: 'c16', vacancy: 'support', status: 'accepted', amount: 2200, sentDaysAgo: 28, respondedDaysAgo: 25, startInDays: -14, expiryInDays: -21, body: 'We are pleased to offer you the position of Customer Support Specialist at Acme Corporation.' },
  ],
  evaluations: withAnswers(withTexts<EvaluationSkeleton, Pick<DemoEvaluation, 'reason'>>(STORY_EVALUATIONS, [
    'Very good system design and solid TypeScript. Would like to see more about mentoring.',
    'Good technical fit and a calm, structured communicator.',
    'Outstanding in every area. Clear hire.',
  ], 'reason'), [
    [
      'Designed Northline’s event-driven billing service: queues, retries and idempotent handlers. Clear about the trade-offs.',
      'Checks readability first, then tests and edge cases. Prefers small pull requests and explains the why.',
    ],
    [
      'Walked through the payments API migration end to end, including how the team measured the result.',
      'Gives specific, friendly comments and pairs with the author on tricky changes.',
    ],
  ]),
  notes: [
    { candidate: 'c1', author: 'admin', mention: 'owner', text: '@Emily Carter great system design answers. I suggest moving him to the final round.', daysAgo: 1 },
    { candidate: 'c4', author: 'owner', text: 'Offer sent. We agreed on a salary of 7,500 GEL and a start in about a month.', daysAgo: 3 },
    { candidate: 'c7', author: 'member', text: 'Strong portfolio, especially the mobile app redesign.', daysAgo: 5 },
  ],
  rejectionReasons: [
    { name: 'Not enough experience', subject: 'Your application for {{role}} at {{company}}', body: 'Dear {{candidate_name}},\n\nThank you for your interest in the {{role}} position. We have decided to move forward with candidates whose experience more closely matches what the role needs right now.\n\nWe will keep your details and may contact you about future openings.\n\nBest regards,\n{{sender_name}}' },
    { name: 'Position filled', subject: 'The {{role}} position has been filled', body: 'Dear {{candidate_name}},\n\nThank you for applying for {{role}} at {{company}}. The position has now been filled.\n\nWe hope to see your application for another role soon.\n\nBest regards,\n{{sender_name}}' },
    { name: 'Salary expectations', subject: 'Your application for {{role}} at {{company}}', body: 'Dear {{candidate_name}},\n\nThank you for your time. Unfortunately, we can’t meet your salary expectations for the {{role}} role.\n\nBest regards,\n{{sender_name}}' },
  ],
  invite: { email: 'david.wright@example.com', role: 'member' },
  slackChannel: '#hiring',
  linkedInPageId: '104857601',
  aiFit: {
    criteria: [
      { match: 90, evidence: 'Built REST APIs in Node.js and TypeScript', explanation: 'Several years of building production APIs in TypeScript.' },
      { match: 80, evidence: 'Moved the billing service to event-driven processing', explanation: 'Redesigned a core service, which shows hands-on system design.' },
      { match: 65, evidence: 'Leads the payments API team', explanation: 'Leading a team usually includes code review, but the CV gives no detail.' },
      { match: 50, evidence: 'not evidenced', explanation: 'The CV says nothing about how the candidate communicates.' },
    ],
    strengths: [
      { text: 'Long hands-on experience with TypeScript APIs', evidence: 'Built REST APIs in Node.js and TypeScript' },
      { text: 'Has led a backend team', evidence: 'Leads the payments API team' },
    ],
    toVerify: ['How the candidate keeps code quality up in a team', 'How they explain technical decisions to people outside engineering'],
    questions: [
      'How do you review a teammate’s pull request, and what do you look at first?',
      'Tell us about a time you explained a technical trade-off to someone outside engineering.',
    ],
    overrideReason: 'Excellent system design in the interview — the CV undersells it.',
  },
  biasedSentence: 'We are looking for a young, energetic rockstar who is a great culture fit.',
  newCustomField: { name: 'Seniority', options: ['Junior', 'Middle', 'Senior'] },
  biasFindings: [
    { phrase: 'young', category: 'age_coded', reason: 'Implies a preference for younger candidates, which can discriminate on age.', suggestion: 'Remove the word.' },
    { phrase: 'rockstar', category: 'gender_coded', reason: 'Masculine-coded slang that can put off women and other under-represented groups.', suggestion: 'highly skilled engineer' },
    { phrase: 'great culture fit', category: 'cultural_fit_code', reason: 'A vague “culture fit” requirement invites subjective, biased decisions.', suggestion: 'shares our values of ownership and collaboration' },
  ],
  vacancyFields: {
    group: 'Hiring details',
    fields: [
      { name: 'Priority', type: 'dropdown', options: ['High', 'Medium', 'Low'] },
      { name: 'Budget approved', type: 'checkbox' },
    ],
  },
  candidateFields: {
    group: 'Recruiting details',
    fields: [
      { name: 'Referred by', type: 'text' },
      { name: 'Relocation needed', type: 'checkbox' },
    ],
    referredBy: 'Sarah Johnson',
  },
  trash: {
    candidate: { key: 't1', firstName: 'Jack', lastName: 'White', email: 'jack.white@example.com', phone: '+995 555 10 20 50', position: 'Office Administrator', company: 'Nova Labs', location: 'Tbilisi, Georgia', source: 'Careers page', years: 2 },
    vacancy: {
      key: 'officeAssistant', title: 'Office Assistant', department: 'Operations', location: 'Tbilisi, Georgia',
      workMode: 'onsite', employmentType: 'part_time', status: 'draft', salaryMin: null, salaryMax: null, hiringManager: 'owner', daysAgo: 20,
      description: 'Keep our office running smoothly.', responsibilities: 'Greet visitors.\nOrder supplies.', requirements: 'Friendly and organised.',
    },
  },
  wizard: {
    title: 'Data Analyst',
    department: 'Analytics',
    location: 'Tbilisi, Georgia',
    aiContext: 'A team of 6 analysts. We use PostgreSQL and Power BI. Hybrid: 3 days a week in the office.',
    scorecard: [
      { label: 'SQL', mustHave: true },
      { label: 'Statistics', mustHave: true },
      { label: 'Data visualization', mustHave: false },
      { label: 'Communication', mustHave: false },
    ],
    screening: {
      yesNo: 'Do you have the right to work in Georgia?',
      number: 'How many years have you worked with SQL?',
    },
  },
  cv: {
    firstName: 'Nora', lastName: 'Bennett', email: 'nora.bennett@example.com', phone: '+995 555 10 20 70',
    title: 'Senior QA Engineer', location: 'Tbilisi, Georgia',
    summary: 'QA engineer with 6 years of experience in test automation for web and mobile products.',
    experience: [
      { title: 'Senior QA Engineer', company: 'Bluepeak', period: '2022 – present', text: 'Built the end-to-end test suite in Playwright; cut release testing from two days to three hours.' },
      { title: 'QA Engineer', company: 'Peak Digital', period: '2019 – 2022', text: 'Manual and automated testing of e-commerce web apps.' },
    ],
    education: { degree: 'BSc in Computer Science', school: 'Tbilisi State University', period: '2015 – 2019' },
    skills: 'Playwright, Cypress, TypeScript, SQL, CI/CD',
    languages: 'English, Georgian',
    headings: { experience: 'Experience', education: 'Education', skills: 'Skills', languages: 'Languages' },
  },
  importRows: [
    ['Ella', 'Brooks', 'ella.brooks@example.com', '+995 555 11 22 01', 'Peak Digital', 'QA Engineer', '4', '', 'Tbilisi, Georgia', 'Job board', 'English; Georgian', '4,500 GEL', '1 month'],
    ['Max', 'Turner', 'max.turner@example.com', '+995 555 11 22 02', 'Bluepeak', 'DevOps Engineer', '6', '', 'Tbilisi, Georgia', 'LinkedIn', 'English', '6,000 GEL', '2 weeks'],
    ['Zoe', 'Adams', 'zoe.adams@example', '+995 555 11 22 03', 'Nova Labs', 'Data Analyst', '3', '', 'Batumi, Georgia', 'Referral', 'English', '', ''],
    ['Sofia', 'Rossi', 'sofia.rossi@example.com', '+995 555 10 20 32', 'Peak Digital', 'Full Stack Developer', '5', '', 'Tbilisi, Georgia', 'Referral', '', '', ''],
    ['Ben', 'Carter', 'ben.carter@example.com', '+995 555 11 22 05', 'Nova Labs', 'Data Engineer', '5', '', 'Remote', 'Job board', 'English', '5,500 GEL', '1 month'],
  ],
}

// ── Georgian ─────────────────────────────────────────────────────────────────

const KA: DemoOrg = {
  locale: 'ka',
  companyName: 'აკმე კორპორაცია',
  users: [
    { key: 'owner', fullName: 'ნინო ბერიძე', email: 'guide.ka.owner@example.com', role: 'owner' },
    { key: 'admin', fullName: 'გიორგი კაპანაძე', email: 'guide.ka.admin@example.com', role: 'admin' },
    { key: 'member', fullName: 'მარიამ ლომიძე', email: 'guide.ka.member@example.com', role: 'member' },
  ],
  vacancies: [
    {
      key: 'engineer', title: 'უფროსი პროგრამისტი', department: 'ტექნოლოგიები', location: 'თბილისი',
      workMode: 'hybrid', employmentType: 'full_time', status: 'open', salaryMin: 6000, salaryMax: 8000, hiringManager: 'admin', daysAgo: 21,
      description: 'შემოუერთდით ჩვენს პლატფორმის გუნდს და შექმენით ფუნქციები, რომლებსაც ჩვენი მომხმარებლები ყოველდღიურად იყენებენ. თქვენ უხელმძღვანელებთ სამუშაოს დიზაინიდან გამოშვებამდე.',
      responsibilities: 'ფუნქციების დაპროექტება, შექმნა და გამოშვება.\nკოდის მიმოხილვა და ტესტების წერა.\nსაშუალო დონის პროგრამისტების მენტორობა.',
      requirements: 'პროგრამირების 5+ წლის პროფესიული გამოცდილება.\nTypeScript-ისა და React-ის კარგი ცოდნა.\nPostgreSQL-თან მუშაობის გამოცდილება.',
    },
    {
      key: 'designer', title: 'პროდუქტის დიზაინერი', department: 'დიზაინი', location: 'თბილისი',
      workMode: 'remote', employmentType: 'full_time', status: 'open', salaryMin: 4000, salaryMax: 5500, hiringManager: 'owner', daysAgo: 14,
      description: 'დააპროექტეთ ჩვენი პროდუქტის ახალი ნაწილები კვლევიდან საბოლოო ეკრანებამდე, პროგრამისტებთან და პროდუქტის გუნდთან მჭიდრო თანამშრომლობით.',
      responsibilities: 'მომხმარებელთა კვლევის ჩატარება.\nსქემების, პროტოტიპებისა და საბოლოო დიზაინის შექმნა.\nდიზაინ-სისტემის მხარდაჭერა.',
      requirements: 'პროდუქტის დიზაინში 3+ წლის გამოცდილება.\nFigma-ს თავისუფალი ფლობა.\nგანხორციელებული პროექტების პორტფოლიო.',
    },
    {
      key: 'sales', title: 'გაყიდვების მენეჯერი', department: 'გაყიდვები', location: 'ბათუმი',
      workMode: 'onsite', employmentType: 'full_time', status: 'open', salaryMin: 3000, salaryMax: 4500, hiringManager: 'admin', daysAgo: 9,
      description: 'გაზარდეთ ჩვენი მომხმარებლების რაოდენობა დასავლეთ საქართველოში და იზრუნეთ მთავარ კლიენტებზე.',
      responsibilities: 'ახალი მომხმარებლების მოძიება და მოზიდვა.\nმთავარი კლიენტების მართვა.\nგაყიდვების ანგარიშგება.',
      requirements: 'B2B გაყიდვებში 3+ წლის გამოცდილება.\nმოლაპარაკების კარგი უნარი.\nმართვის მოწმობა.',
    },
    {
      key: 'hr', title: 'HR კოორდინატორი', department: 'ადამიანური რესურსები', location: 'თბილისი',
      workMode: 'onsite', employmentType: 'part_time', status: 'draft', salaryMin: null, salaryMax: null, hiringManager: 'owner', daysAgo: 3,
      description: 'დაეხმარეთ HR გუნდს ახალი თანამშრომლების ადაპტაციაში, პირადი საქმეების წარმოებასა და HR პოლიტიკებში.',
      responsibilities: 'ახალი თანამშრომლების ადაპტაციის ორგანიზება.\nპირადი საქმეების განახლება.',
      requirements: 'HR-ში 1+ წლის გამოცდილება.\nორგანიზებულობა.',
    },
    {
      key: 'accountant', title: 'ბუღალტერი', department: 'ფინანსები', location: 'თბილისი',
      workMode: 'onsite', employmentType: 'full_time', status: 'closed', salaryMin: 2500, salaryMax: 3500, hiringManager: 'owner', daysAgo: 60,
      description: 'აწარმოეთ ზუსტი ბუღალტერია და დაგვეხმარეთ ყოველი თვის დროულად დახურვაში.',
      responsibilities: 'ტრანზაქციების აღრიცხვა.\nყოველთვიური ანგარიშების მომზადება.\nგარე აუდიტორებთან თანამშრომლობა.',
      requirements: 'ბუღალტერიაში 2+ წლის გამოცდილება.\nსაქართველოს საგადასახადო კანონმდებლობის ცოდნა.',
    },
    {
      key: 'support', title: 'მომხმარებელთა მხარდაჭერის სპეციალისტი', department: 'მხარდაჭერა', location: 'თბილისი',
      workMode: 'onsite', employmentType: 'full_time', status: 'closed', salaryMin: 1800, salaryMax: 2400, hiringManager: 'admin', daysAgo: 45,
      description: 'დაეხმარეთ ჩვენს მომხმარებლებს ელფოსტით, ჩატითა და ტელეფონით და იზრუნეთ, რომ ყველა კითხვას მკაფიო პასუხი გაეცეს.',
      responsibilities: 'მომხმარებელთა კითხვებზე პასუხი.\nპრობლემების აღრიცხვა და მათზე რეაგირება.\nდახმარების სტატიების გაუმჯობესება.',
      requirements: 'მომხმარებელთა მხარდაჭერაში 1+ წლის გამოცდილება.\nქართული და ინგლისური ენების თავისუფალი ფლობა.',
    },
  ],
  candidates: [
    { key: 'c1', firstName: 'ლევან', lastName: 'გელაშვილი', email: 'levan.gelashvili@example.com', phone: '+995 555 20 30 41', position: 'უფროსი Backend პროგრამისტი', company: 'ნორთლაინ სოფტი', location: 'თბილისი', source: 'LinkedIn', years: 7, languages: ['ქართული', 'ინგლისური', 'რუსული'], salaryExpectation: '7 000 ₾', noticePeriod: '1 თვე' },
    { key: 'c2', firstName: 'ანა', lastName: 'ჯაფარიძე', email: 'ana.japaridze@example.com', phone: '+995 555 20 30 42', position: 'Full Stack პროგრამისტი', company: 'პიკ დიჯიტალი', location: 'თბილისი', source: 'რეკომენდაცია', years: 5 },
    { key: 'c3', firstName: 'დავით', lastName: 'ხუციშვილი', email: 'davit.khutsishvili@example.com', phone: '+995 555 20 30 43', position: 'პროგრამისტი', company: 'ბლუპიკი', location: 'ბათუმი', source: 'ვაკანსიების გვერდი', years: 4 },
    { key: 'c4', firstName: 'თამარ', lastName: 'მაისურაძე', email: 'tamar.maisuradze@example.com', phone: '+995 555 20 30 44', position: 'წამყვანი პროგრამისტი', company: 'ორბიტ სტუდიო', location: 'თბილისი', source: 'LinkedIn', years: 9 },
    { key: 'c5', firstName: 'ნიკა', lastName: 'ჩხეიძე', email: 'nika.chkheidze@example.com', phone: '+995 555 20 30 45', position: 'Frontend პროგრამისტი', company: 'ნოვა ლაბსი', location: 'დისტანციური', source: 'ვაკანსიების გვერდი', years: 3 },
    { key: 'c6', firstName: 'ეკა', lastName: 'წერეთელი', email: 'eka.tsereteli@example.com', phone: '+995 555 20 30 46', position: 'UX დიზაინერი', company: 'პიკ დიჯიტალი', location: 'თბილისი', source: 'რეკომენდაცია', years: 4 },
    { key: 'c7', firstName: 'ირაკლი', lastName: 'ბოლქვაძე', email: 'irakli.bolkvadze@example.com', phone: '+995 555 20 30 47', position: 'პროდუქტის დიზაინერი', company: 'ორბიტ სტუდიო', location: 'დისტანციური', source: 'LinkedIn', years: 6 },
    { key: 'c8', firstName: 'სალომე', lastName: 'კვარაცხელია', email: 'salome.kvaratskhelia@example.com', phone: '+995 555 20 30 48', position: 'კლიენტებთან ურთიერთობის მენეჯერი', company: 'აბრეშუმის გზა რითეილი', location: 'ბათუმი', source: 'ვაკანსიების გვერდი', years: 5 },
    { key: 'c9', firstName: 'ზურაბ', lastName: 'კიკნაძე', email: 'zurab.kiknadze@example.com', phone: '+995 555 20 30 49', position: 'Backend პროგრამისტი', company: 'ნოვა ლაბსი', location: 'თბილისი', source: 'ვაკანსიების გვერდი', years: 2 },
    { key: 'c10', firstName: 'ნინო', lastName: 'ღლონტი', email: 'nino.ghlonti@example.com', phone: '+995 555 20 30 50', position: 'პროგრამისტი', company: 'ნორთლაინ სოფტი', location: 'თბილისი', source: 'ვაკანსიების გვერდი', years: 6 },
    { key: 'c11', firstName: 'ლუკა', lastName: 'მესხი', email: 'luka.meskhi@example.com', phone: '+995 555 20 30 51', position: 'UI დიზაინერი', company: 'პიკ დიჯიტალი', location: 'დისტანციური', source: 'ვაკანსიების გვერდი', years: 3 },
    { key: 'c12', firstName: 'მარიამ', lastName: 'დოლიძე', email: 'mariam.dolidze@example.com', phone: '+995 555 20 30 52', position: 'გრაფიკული დიზაინერი', company: 'ორბიტ სტუდიო', location: 'თბილისი', source: 'ვაკანსიების გვერდი', years: 2 },
    { key: 'c13', firstName: 'ბექა', lastName: 'ცინცაძე', email: 'beka.tsintsadze@example.com', phone: '+995 555 20 30 53', position: 'გაყიდვების წარმომადგენელი', company: 'აბრეშუმის გზა რითეილი', location: 'ბათუმი', source: 'LinkedIn', years: 4 },
    { key: 'c14', firstName: 'ქეთევან', lastName: 'ნოზაძე', email: 'ketevan.nozadze@example.com', phone: '+995 555 20 30 54', position: 'ბუღალტერი', company: 'ბლუპიკი', location: 'თბილისი', source: 'ვაკანსიების გვერდი', years: 5 },
    { key: 'c15', firstName: 'გიორგი', lastName: 'ტაბატაძე', email: 'giorgi.tabatadze@example.com', phone: '+995 555 20 30 55', position: 'უმცროსი ბუღალტერი', company: 'ნოვა ლაბსი', location: 'თბილისი', source: 'რეკომენდაცია', years: 1 },
    { key: 'c16', firstName: 'ნათია', lastName: 'ჯავახიშვილი', email: 'natia.javakhishvili@example.com', phone: '+995 555 20 30 56', position: 'მხარდაჭერის სპეციალისტი', company: 'პიკ დიჯიტალი', location: 'თბილისი', source: 'LinkedIn', years: 3 },
  ],
  applications: STORY_APPLICATIONS,
  engineerScorecard: [
    { label: 'TypeScript', mustHave: true },
    { label: 'სისტემების დიზაინი', mustHave: true },
    { label: 'კოდის ხარისხი', mustHave: false },
    { label: 'კომუნიკაცია', mustHave: false },
  ],
  engineerGuide: ['მოგვიყევით სისტემაზე, რომელიც თავიდან ბოლომდე თავად დააპროექტეთ.', 'როგორ განიხილავთ კოლეგის კოდს?'],
  engineerScreening: [
    { label: 'გაქვთ საქართველოში მუშაობის უფლება?', answerType: 'yes_no', knockout: { yes: true } },
    { label: 'რამდენი წლის გამოცდილება გაქვთ TypeScript-თან?', answerType: 'number', knockout: { atLeast: 3 } },
    { label: 'როდის შეგიძლიათ მუშაობის დაწყება?', answerType: 'short_text' },
  ],
  screeningAnswers: [
    { candidate: 'c3', answers: ['yes', '4', 'ორ კვირაში'] },
    { candidate: 'c5', answers: ['yes', '2', 'მომავალი თვიდან'] },
  ],
  experience: [
    { candidate: 'c1', company: 'ნორთლაინ სოფტი', title: 'უფროსი Backend პროგრამისტი', from: '2021-03-01', to: null, description: 'ხელმძღვანელობს გადახდების API-ის გუნდს. ბილინგის სერვისი მოვლენებზე დაფუძნებულ დამუშავებაზე გადაიყვანა.' },
    { candidate: 'c1', company: 'პიკ დიჯიტალი', title: 'Backend პროგრამისტი', from: '2018-06-01', to: '2021-02-28', description: 'ქმნიდა REST API-ებს Node.js-სა და TypeScript-ზე ელექტრონული კომერციის კლიენტებისთვის.' },
  ],
  education: [
    { candidate: 'c1', institution: 'თბილისის სახელმწიფო უნივერსიტეტი', degree: 'ბაკალავრი', field: 'კომპიუტერული მეცნიერებები', from: 2014, to: 2018 },
  ],
  interviews: withTexts<InterviewSkeleton, Pick<DemoInterview, 'feedback'>>(STORY_INTERVIEWS, [
    'სისტემების დიზაინში ძლიერია: არჩევანის დადებითი და უარყოფითი მხარეები მკაფიოდ ახსნა. გირჩევთ ფინალურ ეტაპს.',
    '',
    'შესანიშნავი ტექნიკური ცოდნა და მკაფიო კომუნიკაცია.',
  ], 'feedback'),
  offers: [
    { candidate: 'c4', vacancy: 'engineer', status: 'sent', amount: 7500, sentDaysAgo: 3, startInDays: 30, expiryInDays: 7, body: 'მოხარულები ვართ, შემოგთავაზოთ უფროსი პროგრამისტის პოზიცია კომპანიაში „აკმე კორპორაცია“. შემოუერთდებით პლატფორმის გუნდს თბილისში, ჰიბრიდულ რეჟიმში, და დაექვემდებარებით გიორგი კაპანაძეს. შეთავაზება მოიცავს 24 დღე ანაზღაურებად შვებულებას და კერძო სამედიცინო დაზღვევას.', message: 'ყველას ძალიან გვესიამოვნა თქვენი გაცნობა და იმედი გვაქვს, შემოგვიერთდებით. თუ შეთავაზებაში რამე გაუგებარია, უბრალოდ დამირეკეთ.' },
    { candidate: 'c14', vacancy: 'accountant', status: 'accepted', amount: 3200, sentDaysAgo: 36, respondedDaysAgo: 31, startInDays: -20, expiryInDays: -29, body: 'მოხარულები ვართ, შემოგთავაზოთ ბუღალტრის პოზიცია კომპანიაში „აკმე კორპორაცია“, ჩვენს თბილისის ოფისში.' },
    { candidate: 'c16', vacancy: 'support', status: 'accepted', amount: 2200, sentDaysAgo: 28, respondedDaysAgo: 25, startInDays: -14, expiryInDays: -21, body: 'მოხარულები ვართ, შემოგთავაზოთ მომხმარებელთა მხარდაჭერის სპეციალისტის პოზიცია კომპანიაში „აკმე კორპორაცია“.' },
  ],
  evaluations: withAnswers(withTexts<EvaluationSkeleton, Pick<DemoEvaluation, 'reason'>>(STORY_EVALUATIONS, [
    'ძალიან კარგი სისტემების დიზაინი და TypeScript-ის მყარი ცოდნა. მენტორობის შესახებ მეტის მოსმენა მინდა.',
    'კარგად შეესაბამება ტექნიკურ მოთხოვნებს; მშვიდად და სტრუქტურირებულად საუბრობს.',
    'ყველა მიმართულებით გამორჩეულია. ცალსახად ვიღებთ.',
  ], 'reason'), [
    [
      'ნორთლაინში დააპროექტა მოვლენებზე დაფუძნებული ბილინგის სერვისი: რიგები, ხელახალი მცდელობები და იდემპოტენტური დამმუშავებლები. კომპრომისებს ნათლად ხსნის.',
      'ჯერ კოდის წაკითხვადობას ამოწმებს, შემდეგ ტესტებსა და განსაკუთრებულ შემთხვევებს. მცირე pull request-ებს ამჯობინებს და ხსნის, რატომ.',
    ],
    [
      'თავიდან ბოლომდე აღწერა გადახდების API-ის მიგრაცია, მათ შორის, როგორ გაზომა გუნდმა შედეგი.',
      'კონკრეტულ და კეთილგანწყობილ კომენტარებს წერს, რთულ ცვლილებებზე კი ავტორთან ერთად მუშაობს.',
    ],
  ]),
  notes: [
    { candidate: 'c1', author: 'admin', mention: 'owner', text: '@ნინო ბერიძე სისტემების დიზაინის კითხვებს შესანიშნავად უპასუხა. გთავაზობთ, ფინალურ ეტაპზე გადავიყვანოთ.', daysAgo: 1 },
    { candidate: 'c4', author: 'owner', text: 'შეთავაზება გაიგზავნა. შევთანხმდით ხელფასზე — 7 500 ₾ და მუშაობის დაწყებაზე დაახლოებით ერთ თვეში.', daysAgo: 3 },
    { candidate: 'c7', author: 'member', text: 'ძლიერი პორტფოლიო, განსაკუთრებით მობილური აპლიკაციის რედიზაინი.', daysAgo: 5 },
  ],
  rejectionReasons: [
    { name: 'არასაკმარისი გამოცდილება', subject: 'თქვენი განაცხადი პოზიციაზე „{{role}}“ — {{company}}', body: 'ძვირფასო {{candidate_name}},\n\nგმადლობთ პოზიციით „{{role}}“ დაინტერესებისთვის. გადავწყვიტეთ, გავაგრძელოთ კანდიდატებთან, რომელთა გამოცდილებაც ამჟამად უკეთ შეესაბამება პოზიციის მოთხოვნებს.\n\nთქვენს მონაცემებს შევინახავთ და შესაძლოა, მომავალი ვაკანსიების შესახებ დაგიკავშირდეთ.\n\nპატივისცემით,\n{{sender_name}}' },
    { name: 'პოზიცია დაკომპლექტდა', subject: 'პოზიცია „{{role}}“ დაკომპლექტდა', body: 'ძვირფასო {{candidate_name}},\n\nგმადლობთ, რომ განაცხადი გამოგზავნეთ პოზიციაზე „{{role}}“ კომპანიაში {{company}}. ეს პოზიცია უკვე დაკომპლექტდა.\n\nიმედი გვაქვს, მალე სხვა პოზიციაზეც მივიღებთ თქვენს განაცხადს.\n\nპატივისცემით,\n{{sender_name}}' },
    { name: 'ხელფასის მოლოდინი', subject: 'თქვენი განაცხადი პოზიციაზე „{{role}}“ — {{company}}', body: 'ძვირფასო {{candidate_name}},\n\nგმადლობთ დათმობილი დროისთვის. სამწუხაროდ, პოზიციაზე „{{role}}“ თქვენი ხელფასის მოლოდინის დაკმაყოფილებას ვერ შევძლებთ.\n\nპატივისცემით,\n{{sender_name}}' },
  ],
  invite: { email: 'nika.abuladze@example.com', role: 'member' },
  slackChannel: '#დაქირავება',
  linkedInPageId: '104857602',
  aiFit: {
    criteria: [
      { match: 90, evidence: 'ქმნიდა REST API-ებს Node.js-სა და TypeScript-ზე', explanation: 'რამდენიმე წლის გამოცდილება TypeScript-ზე საწარმოო API-ების შექმნაში.' },
      { match: 80, evidence: 'ბილინგის სერვისი მოვლენებზე დაფუძნებულ დამუშავებაზე გადაიყვანა', explanation: 'ძირითადი სერვისის ხელახალი დაპროექტება სისტემების დიზაინის პრაქტიკულ გამოცდილებაზე მიუთითებს.' },
      { match: 65, evidence: 'ხელმძღვანელობს გადახდების API-ის გუნდს', explanation: 'გუნდის ხელმძღვანელობა ჩვეულებრივ კოდის განხილვასაც გულისხმობს, თუმცა CV-ში დეტალები არ არის.' },
      { match: 50, evidence: 'არ არის დადასტურებული', explanation: 'CV-ში არაფერია ნათქვამი იმაზე, როგორ ურთიერთობს კანდიდატი.' },
    ],
    strengths: [
      { text: 'TypeScript API-ებთან მუშაობის ხანგრძლივი პრაქტიკული გამოცდილება', evidence: 'ქმნიდა REST API-ებს Node.js-სა და TypeScript-ზე' },
      { text: 'ხელმძღვანელობდა backend-გუნდს', evidence: 'ხელმძღვანელობს გადახდების API-ის გუნდს' },
    ],
    toVerify: ['როგორ ინარჩუნებს კანდიდატი კოდის ხარისხს გუნდში', 'როგორ უხსნის ტექნიკურ გადაწყვეტილებებს არატექნიკურ კოლეგებს'],
    questions: [
      'როგორ განიხილავთ კოლეგის pull request-ს და რას აქცევთ ყურადღებას პირველ რიგში?',
      'მოგვიყევით შემთხვევაზე, როცა ტექნიკური კომპრომისი ინჟინერიის გარეთ მყოფ ადამიანს აუხსენით.',
    ],
    overrideReason: 'ინტერვიუზე სისტემების დიზაინში შესანიშნავი შედეგი აჩვენა — CV მის ცოდნას სრულად ვერ ასახავს.',
  },
  biasedSentence: 'ვეძებთ ახალგაზრდა, ენერგიულ ბიჭს, რომელიც ჩვენს კულტურას იდეალურად მოერგება.',
  newCustomField: { name: 'დონე', options: ['უმცროსი', 'საშუალო', 'უფროსი'] },
  biasFindings: [
    { phrase: 'ახალგაზრდა', category: 'age_coded', reason: 'მიუთითებს ახალგაზრდა კანდიდატის უპირატესობაზე, რაც ასაკობრივ დისკრიმინაციად შეიძლება ჩაითვალოს.', suggestion: 'ამოიღეთ ეს სიტყვა.' },
    { phrase: 'ბიჭს', category: 'gender_coded', reason: 'მიუთითებს კანდიდატის სქესზე და შეიძლება ქალებს განაცხადის გაგზავნა გადააფიქრებინოს.', suggestion: 'სპეციალისტს' },
    { phrase: 'ჩვენს კულტურას იდეალურად მოერგება', category: 'cultural_fit_code', reason: '„კულტურასთან შესაბამისობა“ ბუნდოვანი მოთხოვნაა და სუბიექტურ, მიკერძოებულ გადაწყვეტილებებს უწყობს ხელს.', suggestion: 'იზიარებს ჩვენს ღირებულებებს: პასუხისმგებლობასა და გუნდურ მუშაობას' },
  ],
  vacancyFields: {
    group: 'დაქირავების დეტალები',
    fields: [
      { name: 'პრიორიტეტი', type: 'dropdown', options: ['მაღალი', 'საშუალო', 'დაბალი'] },
      { name: 'ბიუჯეტი დამტკიცებულია', type: 'checkbox' },
    ],
  },
  candidateFields: {
    group: 'რეკრუტინგის დეტალები',
    fields: [
      { name: 'ვინ გაგვიწია რეკომენდაცია', type: 'text' },
      { name: 'რელოკაცია სჭირდება', type: 'checkbox' },
    ],
    referredBy: 'მარიამ ლომიძე',
  },
  trash: {
    candidate: { key: 't1', firstName: 'თორნიკე', lastName: 'აბაშიძე', email: 'tornike.abashidze@example.com', phone: '+995 555 20 30 60', position: 'ოფისის ადმინისტრატორი', company: 'ნოვა ლაბსი', location: 'თბილისი', source: 'ვაკანსიების გვერდი', years: 2 },
    vacancy: {
      key: 'officeAssistant', title: 'ოფის-ასისტენტი', department: 'ოპერაციები', location: 'თბილისი',
      workMode: 'onsite', employmentType: 'part_time', status: 'draft', salaryMin: null, salaryMax: null, hiringManager: 'owner', daysAgo: 20,
      description: 'იზრუნეთ ოფისის გამართულ მუშაობაზე.', responsibilities: 'სტუმრების დახვედრა.\nსაკანცელარიო ნივთების შეკვეთა.', requirements: 'კეთილგანწყობა და ორგანიზებულობა.',
    },
  },
  wizard: {
    title: 'მონაცემთა ანალიტიკოსი',
    department: 'ანალიტიკა',
    location: 'თბილისი',
    aiContext: '6-კაციანი ანალიტიკის გუნდი. ვიყენებთ PostgreSQL-ს და Power BI-ს. ჰიბრიდული: კვირაში 3 დღე ოფისში.',
    scorecard: [
      { label: 'SQL', mustHave: true },
      { label: 'სტატისტიკა', mustHave: true },
      { label: 'მონაცემთა ვიზუალიზაცია', mustHave: false },
      { label: 'კომუნიკაცია', mustHave: false },
    ],
    screening: {
      yesNo: 'გაქვთ საქართველოში მუშაობის უფლება?',
      number: 'რამდენი წელია, რაც SQL-თან მუშაობთ?',
    },
  },
  cv: {
    firstName: 'ელენე', lastName: 'გოგოლაძე', email: 'elene.gogoladze@example.com', phone: '+995 555 20 30 70',
    title: 'უფროსი QA ინჟინერი', location: 'თბილისი',
    summary: 'QA ინჟინერი ვებ და მობილური პროდუქტების ტესტირების ავტომატიზაციაში 6-წლიანი გამოცდილებით.',
    experience: [
      { title: 'უფროსი QA ინჟინერი', company: 'ბლუპიკი', period: '2022 – დღემდე', text: 'შექმნა end-to-end ტესტები Playwright-ზე; გამოშვების ტესტირება ორი დღიდან სამ საათამდე შეამცირა.' },
      { title: 'QA ინჟინერი', company: 'პიკ დიჯიტალი', period: '2019 – 2022', text: 'ელექტრონული კომერციის ვებ აპლიკაციების ხელით და ავტომატური ტესტირება.' },
    ],
    education: { degree: 'კომპიუტერული მეცნიერებების ბაკალავრი', school: 'თბილისის სახელმწიფო უნივერსიტეტი', period: '2015 – 2019' },
    skills: 'Playwright, Cypress, TypeScript, SQL, CI/CD',
    languages: 'ქართული, ინგლისური',
    headings: { experience: 'სამუშაო გამოცდილება', education: 'განათლება', skills: 'უნარები', languages: 'ენები' },
  },
  importRows: [
    ['მაკა', 'გიორგაძე', 'maka.giorgadze@example.com', '+995 555 21 32 01', 'პიკ დიჯიტალი', 'QA ინჟინერი', '4', '', 'თბილისი', 'დასაქმების საიტი', 'ქართული; ინგლისური', '4 500 ₾', '1 თვე'],
    ['ლაშა', 'ქავთარაძე', 'lasha.kavtaradze@example.com', '+995 555 21 32 02', 'ბლუპიკი', 'DevOps ინჟინერი', '6', '', 'თბილისი', 'LinkedIn', 'ქართული', '6 000 ₾', '2 კვირა'],
    ['სოფო', 'კაკაბაძე', 'sofo.kakabadze@example', '+995 555 21 32 03', 'ნოვა ლაბსი', 'მონაცემთა ანალიტიკოსი', '3', '', 'ბათუმი', 'რეკომენდაცია', 'ქართული', '', ''],
    ['ანა', 'ჯაფარიძე', 'ana.japaridze@example.com', '+995 555 20 30 42', 'პიკ დიჯიტალი', 'Full Stack პროგრამისტი', '5', '', 'თბილისი', 'რეკომენდაცია', '', '', ''],
    ['გიორგი', 'მჭედლიძე', 'giorgi.mchedlidze@example.com', '+995 555 21 32 05', 'ნოვა ლაბსი', 'მონაცემთა ინჟინერი', '5', '', 'დისტანციური', 'დასაქმების საიტი', 'ქართული; ინგლისური', '5 500 ₾', '1 თვე'],
  ],
}

// ── Russian ──────────────────────────────────────────────────────────────────

const RU: DemoOrg = {
  locale: 'ru',
  companyName: 'Акме Корпорация',
  users: [
    { key: 'owner', fullName: 'Анна Смирнова', email: 'guide.ru.owner@example.com', role: 'owner' },
    { key: 'admin', fullName: 'Дмитрий Иванов', email: 'guide.ru.admin@example.com', role: 'admin' },
    { key: 'member', fullName: 'Елена Кузнецова', email: 'guide.ru.member@example.com', role: 'member' },
  ],
  vacancies: [
    {
      key: 'engineer', title: 'Старший разработчик', department: 'Разработка', location: 'Тбилиси',
      workMode: 'hybrid', employmentType: 'full_time', status: 'open', salaryMin: 6000, salaryMax: 8000, hiringManager: 'admin', daysAgo: 21,
      description: 'Присоединяйтесь к команде платформы и создавайте функции, которыми наши клиенты пользуются каждый день. Вы будете вести задачи от проектирования до релиза.',
      responsibilities: 'Проектирование, разработка и выпуск функций.\nКод-ревью и написание тестов.\nНаставничество для разработчиков среднего уровня.',
      requirements: 'От 5 лет коммерческой разработки.\nУверенное знание TypeScript и React.\nОпыт работы с PostgreSQL.',
    },
    {
      key: 'designer', title: 'Продуктовый дизайнер', department: 'Дизайн', location: 'Тбилиси',
      workMode: 'remote', employmentType: 'full_time', status: 'open', salaryMin: 4000, salaryMax: 5500, hiringManager: 'owner', daysAgo: 14,
      description: 'Проектируйте новые части продукта — от исследований до финальных экранов — в тесной работе с разработкой и продуктом.',
      responsibilities: 'Проведение пользовательских исследований.\nСоздание схем, прототипов и макетов.\nПоддержка дизайн-системы.',
      requirements: 'От 3 лет в продуктовом дизайне.\nСвободное владение Figma.\nПортфолио реализованных проектов.',
    },
    {
      key: 'sales', title: 'Менеджер по продажам', department: 'Продажи', location: 'Батуми',
      workMode: 'onsite', employmentType: 'full_time', status: 'open', salaryMin: 3000, salaryMax: 4500, hiringManager: 'admin', daysAgo: 9,
      description: 'Расширяйте клиентскую базу в западной Грузии и ведите ключевых клиентов.',
      responsibilities: 'Поиск и привлечение новых клиентов.\nВедение ключевых клиентов.\nОтчётность по воронке продаж.',
      requirements: 'От 3 лет в B2B-продажах.\nОтличные навыки переговоров.\nВодительские права.',
    },
    {
      key: 'hr', title: 'HR-координатор', department: 'Персонал', location: 'Тбилиси',
      workMode: 'onsite', employmentType: 'part_time', status: 'draft', salaryMin: null, salaryMax: null, hiringManager: 'owner', daysAgo: 3,
      description: 'Помогайте HR-команде с адаптацией новичков, кадровым учётом и HR-политиками.',
      responsibilities: 'Организация адаптации новых сотрудников.\nВедение кадровых документов.',
      requirements: 'От 1 года в HR.\nОрганизованность.',
    },
    {
      key: 'accountant', title: 'Бухгалтер', department: 'Финансы', location: 'Тбилиси',
      workMode: 'onsite', employmentType: 'full_time', status: 'closed', salaryMin: 2500, salaryMax: 3500, hiringManager: 'owner', daysAgo: 60,
      description: 'Ведите точный учёт и помогайте вовремя закрывать каждый месяц.',
      responsibilities: 'Учёт операций.\nПодготовка ежемесячной отчётности.\nРабота с внешними аудиторами.',
      requirements: 'От 2 лет в бухгалтерии.\nЗнание налогового законодательства Грузии.',
    },
    {
      key: 'support', title: 'Специалист службы поддержки', department: 'Поддержка', location: 'Тбилиси',
      workMode: 'onsite', employmentType: 'full_time', status: 'closed', salaryMin: 1800, salaryMax: 2400, hiringManager: 'admin', daysAgo: 45,
      description: 'Помогайте клиентам по почте, в чате и по телефону и следите, чтобы каждый вопрос получал понятный ответ.',
      responsibilities: 'Ответы на вопросы клиентов.\nРегистрация обращений и контроль их решения.\nУлучшение справочных статей.',
      requirements: 'От 1 года в службе поддержки.\nСвободный английский и грузинский.',
    },
  ],
  candidates: [
    { key: 'c1', firstName: 'Алексей', lastName: 'Петров', email: 'aleksei.petrov@example.com', phone: '+995 555 30 40 51', position: 'Старший backend-разработчик', company: 'Нортлайн Софт', location: 'Тбилиси', source: 'LinkedIn', years: 7, languages: ['Русский', 'Английский', 'Грузинский'], salaryExpectation: '7 000 ₾', noticePeriod: '1 месяц' },
    { key: 'c2', firstName: 'Мария', lastName: 'Соколова', email: 'maria.sokolova@example.com', phone: '+995 555 30 40 52', position: 'Fullstack-разработчик', company: 'Пик Диджитал', location: 'Тбилиси', source: 'Рекомендация', years: 5 },
    { key: 'c3', firstName: 'Игорь', lastName: 'Волков', email: 'igor.volkov@example.com', phone: '+995 555 30 40 53', position: 'Разработчик', company: 'Блупик', location: 'Батуми', source: 'Страница вакансий', years: 4 },
    { key: 'c4', firstName: 'Ольга', lastName: 'Морозова', email: 'olga.morozova@example.com', phone: '+995 555 30 40 54', position: 'Ведущий разработчик', company: 'Орбит Студио', location: 'Тбилиси', source: 'LinkedIn', years: 9 },
    { key: 'c5', firstName: 'Сергей', lastName: 'Новиков', email: 'sergei.novikov@example.com', phone: '+995 555 30 40 55', position: 'Frontend-разработчик', company: 'Нова Лабс', location: 'Удалённо', source: 'Страница вакансий', years: 3 },
    { key: 'c6', firstName: 'Наталья', lastName: 'Павлова', email: 'natalia.pavlova@example.com', phone: '+995 555 30 40 56', position: 'UX-дизайнер', company: 'Пик Диджитал', location: 'Тбилиси', source: 'Рекомендация', years: 4 },
    { key: 'c7', firstName: 'Андрей', lastName: 'Фёдоров', email: 'andrei.fedorov@example.com', phone: '+995 555 30 40 57', position: 'Продуктовый дизайнер', company: 'Орбит Студио', location: 'Удалённо', source: 'LinkedIn', years: 6 },
    { key: 'c8', firstName: 'Татьяна', lastName: 'Лебедева', email: 'tatiana.lebedeva@example.com', phone: '+995 555 30 40 58', position: 'Менеджер по работе с клиентами', company: 'Шёлковый Путь Ритейл', location: 'Батуми', source: 'Страница вакансий', years: 5 },
    { key: 'c9', firstName: 'Павел', lastName: 'Егоров', email: 'pavel.egorov@example.com', phone: '+995 555 30 40 59', position: 'Backend-разработчик', company: 'Нова Лабс', location: 'Тбилиси', source: 'Страница вакансий', years: 2 },
    { key: 'c10', firstName: 'Виктория', lastName: 'Белова', email: 'viktoria.belova@example.com', phone: '+995 555 30 40 60', position: 'Разработчик', company: 'Нортлайн Софт', location: 'Тбилиси', source: 'Страница вакансий', years: 6 },
    { key: 'c11', firstName: 'Кирилл', lastName: 'Зайцев', email: 'kirill.zaitsev@example.com', phone: '+995 555 30 40 61', position: 'UI-дизайнер', company: 'Пик Диджитал', location: 'Удалённо', source: 'Страница вакансий', years: 3 },
    { key: 'c12', firstName: 'Алина', lastName: 'Ковалёва', email: 'alina.kovaleva@example.com', phone: '+995 555 30 40 62', position: 'Графический дизайнер', company: 'Орбит Студио', location: 'Тбилиси', source: 'Страница вакансий', years: 2 },
    { key: 'c13', firstName: 'Роман', lastName: 'Николаев', email: 'roman.nikolaev@example.com', phone: '+995 555 30 40 63', position: 'Торговый представитель', company: 'Шёлковый Путь Ритейл', location: 'Батуми', source: 'LinkedIn', years: 4 },
    { key: 'c14', firstName: 'Ксения', lastName: 'Медведева', email: 'ksenia.medvedeva@example.com', phone: '+995 555 30 40 64', position: 'Бухгалтер', company: 'Блупик', location: 'Тбилиси', source: 'Страница вакансий', years: 5 },
    { key: 'c15', firstName: 'Денис', lastName: 'Комаров', email: 'denis.komarov@example.com', phone: '+995 555 30 40 65', position: 'Младший бухгалтер', company: 'Нова Лабс', location: 'Тбилиси', source: 'Рекомендация', years: 1 },
    { key: 'c16', firstName: 'Юлия', lastName: 'Андреева', email: 'yulia.andreeva@example.com', phone: '+995 555 30 40 66', position: 'Специалист поддержки', company: 'Пик Диджитал', location: 'Тбилиси', source: 'LinkedIn', years: 3 },
  ],
  applications: STORY_APPLICATIONS,
  engineerScorecard: [
    { label: 'TypeScript', mustHave: true },
    { label: 'Проектирование систем', mustHave: true },
    { label: 'Качество кода', mustHave: false },
    { label: 'Коммуникация', mustHave: false },
  ],
  engineerGuide: ['Расскажите о системе, которую вы спроектировали от начала до конца.', 'Как вы проводите ревью кода коллеги?'],
  engineerScreening: [
    { label: 'Есть ли у вас право на работу в Грузии?', answerType: 'yes_no', knockout: { yes: true } },
    { label: 'Сколько лет у вас опыта работы с TypeScript?', answerType: 'number', knockout: { atLeast: 3 } },
    { label: 'Когда вы можете приступить к работе?', answerType: 'short_text' },
  ],
  screeningAnswers: [
    { candidate: 'c3', answers: ['yes', '4', 'Через две недели'] },
    { candidate: 'c5', answers: ['yes', '2', 'Со следующего месяца'] },
  ],
  experience: [
    { candidate: 'c1', company: 'Нортлайн Софт', title: 'Старший backend-разработчик', from: '2021-03-01', to: null, description: 'Руководит командой API платежей. Перевёл сервис биллинга на событийную обработку.' },
    { candidate: 'c1', company: 'Пик Диджитал', title: 'Backend-разработчик', from: '2018-06-01', to: '2021-02-28', description: 'Разрабатывал REST API на Node.js и TypeScript для клиентов из e-commerce.' },
  ],
  education: [
    { candidate: 'c1', institution: 'Тбилисский государственный университет', degree: 'Бакалавр', field: 'Информатика', from: 2014, to: 2018 },
  ],
  interviews: withTexts<InterviewSkeleton, Pick<DemoInterview, 'feedback'>>(STORY_INTERVIEWS, [
    'Сильное проектирование систем: чётко объяснил компромиссы. Рекомендую финальный этап.',
    '',
    'Отличная техническая глубина и ясная коммуникация.',
  ], 'feedback'),
  offers: [
    { candidate: 'c4', vacancy: 'engineer', status: 'sent', amount: 7500, sentDaysAgo: 3, startInDays: 30, expiryInDays: 7, body: 'Мы рады предложить вам должность старшего разработчика в компании «Акме Корпорация». Вы присоединитесь к команде платформы в Тбилиси в гибридном формате и будете подчиняться Дмитрию Иванову. Предложение включает 24 дня оплачиваемого отпуска и частную медицинскую страховку.', message: 'Нам всем было очень приятно с вами познакомиться, и мы надеемся, что вы присоединитесь к нам. Если в предложении что-то непонятно, просто позвоните мне.' },
    { candidate: 'c14', vacancy: 'accountant', status: 'accepted', amount: 3200, sentDaysAgo: 36, respondedDaysAgo: 31, startInDays: -20, expiryInDays: -29, body: 'Мы рады предложить вам должность бухгалтера в компании «Акме Корпорация» в нашем тбилисском офисе.' },
    { candidate: 'c16', vacancy: 'support', status: 'accepted', amount: 2200, sentDaysAgo: 28, respondedDaysAgo: 25, startInDays: -14, expiryInDays: -21, body: 'Мы рады предложить вам должность специалиста службы поддержки в компании «Акме Корпорация».' },
  ],
  evaluations: withAnswers(withTexts<EvaluationSkeleton, Pick<DemoEvaluation, 'reason'>>(STORY_EVALUATIONS, [
    'Очень хорошее проектирование систем и уверенный TypeScript. Хотелось бы больше узнать о наставничестве.',
    'Хорошо подходит технически; спокойно и структурированно излагает мысли.',
    'Выдающийся уровень во всём. Однозначно берём.',
  ], 'reason'), [
    [
      'Спроектировал в Нортлайн событийный сервис биллинга: очереди, повторные попытки, идемпотентные обработчики. Чётко объясняет компромиссы.',
      'Сначала смотрит на читаемость, потом на тесты и граничные случаи. Предпочитает небольшие pull request’ы и объясняет, зачем нужно изменение.',
    ],
    [
      'Подробно рассказал о миграции платёжного API от начала до конца, включая то, как команда измеряла результат.',
      'Пишет конкретные и доброжелательные комментарии, а сложные изменения разбирает вместе с автором.',
    ],
  ]),
  notes: [
    { candidate: 'c1', author: 'admin', mention: 'owner', text: '@Анна Смирнова отлично ответил на вопросы по проектированию систем. Предлагаю перевести его на финальный этап.', daysAgo: 1 },
    { candidate: 'c4', author: 'owner', text: 'Оффер отправлен. Договорились о зарплате 7 500 ₾ и выходе примерно через месяц.', daysAgo: 3 },
    { candidate: 'c7', author: 'member', text: 'Сильное портфолио, особенно редизайн мобильного приложения.', daysAgo: 5 },
  ],
  rejectionReasons: [
    { name: 'Недостаточно опыта', subject: 'Ваш отклик на вакансию «{{role}}» в {{company}}', body: 'Здравствуйте, {{candidate_name}}!\n\nСпасибо за интерес к вакансии «{{role}}». Мы решили продолжить с кандидатами, чей опыт сейчас лучше соответствует требованиям позиции.\n\nМы сохраним ваши данные и, возможно, свяжемся с вами по будущим вакансиям.\n\nС уважением,\n{{sender_name}}' },
    { name: 'Вакансия закрыта', subject: 'Вакансия «{{role}}» закрыта', body: 'Здравствуйте, {{candidate_name}}!\n\nСпасибо за отклик на вакансию «{{role}}» в {{company}}. Эта позиция уже закрыта.\n\nНадеемся вскоре увидеть ваш отклик на другую вакансию.\n\nС уважением,\n{{sender_name}}' },
    { name: 'Зарплатные ожидания', subject: 'Ваш отклик на вакансию «{{role}}» в {{company}}', body: 'Здравствуйте, {{candidate_name}}!\n\nСпасибо, что уделили нам время. К сожалению, мы не можем предложить уровень зарплаты, на который вы рассчитываете, для позиции «{{role}}».\n\nС уважением,\n{{sender_name}}' },
  ],
  invite: { email: 'maxim.sorokin@example.com', role: 'member' },
  slackChannel: '#найм',
  linkedInPageId: '104857603',
  aiFit: {
    criteria: [
      { match: 90, evidence: 'Разрабатывал REST API на Node.js и TypeScript', explanation: 'Несколько лет разработки рабочих API на TypeScript.' },
      { match: 80, evidence: 'Перевёл сервис биллинга на событийную обработку', explanation: 'Переработка ключевого сервиса говорит о практическом опыте проектирования систем.' },
      { match: 65, evidence: 'Руководит командой API платежей', explanation: 'Руководство командой обычно включает ревью кода, но в резюме подробностей нет.' },
      { match: 50, evidence: 'не подтверждено', explanation: 'В резюме ничего не сказано о том, как кандидат общается с коллегами.' },
    ],
    strengths: [
      { text: 'Большой практический опыт разработки API на TypeScript', evidence: 'Разрабатывал REST API на Node.js и TypeScript' },
      { text: 'Руководил backend-командой', evidence: 'Руководит командой API платежей' },
    ],
    toVerify: ['Как кандидат поддерживает качество кода в команде', 'Как он объясняет технические решения людям не из разработки'],
    questions: [
      'Как вы проводите ревью pull request’а коллеги и на что смотрите в первую очередь?',
      'Расскажите, как вы объясняли технический компромисс человеку не из разработки.',
    ],
    overrideReason: 'На собеседовании показал отличное проектирование систем — резюме его недооценивает.',
  },
  biasedSentence: 'Ищем молодого энергичного парня, который идеально впишется в нашу культуру.',
  newCustomField: { name: 'Уровень', options: ['Младший', 'Средний', 'Старший'] },
  biasFindings: [
    { phrase: 'молодого', category: 'age_coded', reason: 'Указывает на предпочтение молодых кандидатов, что может быть дискриминацией по возрасту.', suggestion: 'Уберите это слово.' },
    { phrase: 'парня', category: 'gender_coded', reason: 'Указывает на пол кандидата и может отпугнуть женщин.', suggestion: 'специалиста' },
    { phrase: 'идеально впишется в нашу культуру', category: 'cultural_fit_code', reason: 'Расплывчатое требование «культурного соответствия» открывает путь субъективным и предвзятым решениям.', suggestion: 'разделяет наши ценности: ответственность и командную работу' },
  ],
  vacancyFields: {
    group: 'Детали найма',
    fields: [
      { name: 'Приоритет', type: 'dropdown', options: ['Высокий', 'Средний', 'Низкий'] },
      { name: 'Бюджет утверждён', type: 'checkbox' },
    ],
  },
  candidateFields: {
    group: 'Детали подбора',
    fields: [
      { name: 'Кто рекомендовал', type: 'text' },
      { name: 'Нужен переезд', type: 'checkbox' },
    ],
    referredBy: 'Елена Кузнецова',
  },
  trash: {
    candidate: { key: 't1', firstName: 'Артём', lastName: 'Попов', email: 'artem.popov@example.com', phone: '+995 555 30 40 70', position: 'Офис-менеджер', company: 'Нова Лабс', location: 'Тбилиси', source: 'Страница вакансий', years: 2 },
    vacancy: {
      key: 'officeAssistant', title: 'Офис-ассистент', department: 'Операции', location: 'Тбилиси',
      workMode: 'onsite', employmentType: 'part_time', status: 'draft', salaryMin: null, salaryMax: null, hiringManager: 'owner', daysAgo: 20,
      description: 'Помогайте поддерживать порядок в офисе.', responsibilities: 'Встреча посетителей.\nЗаказ канцелярии.', requirements: 'Доброжелательность и организованность.',
    },
  },
  wizard: {
    title: 'Аналитик данных',
    department: 'Аналитика',
    location: 'Тбилиси',
    aiContext: 'Команда из 6 аналитиков. Работаем с PostgreSQL и Power BI. Гибрид: 3 дня в неделю в офисе.',
    scorecard: [
      { label: 'SQL', mustHave: true },
      { label: 'Статистика', mustHave: true },
      { label: 'Визуализация данных', mustHave: false },
      { label: 'Коммуникация', mustHave: false },
    ],
    screening: {
      yesNo: 'Есть ли у вас право на работу в Грузии?',
      number: 'Сколько лет вы работаете с SQL?',
    },
  },
  cv: {
    firstName: 'Светлана', lastName: 'Захарова', email: 'svetlana.zakharova@example.com', phone: '+995 555 30 40 80',
    title: 'Старший QA-инженер', location: 'Тбилиси',
    summary: 'QA-инженер с 6-летним опытом автоматизации тестирования веб- и мобильных продуктов.',
    experience: [
      { title: 'Старший QA-инженер', company: 'Блупик', period: '2022 – наст. время', text: 'Создала набор end-to-end тестов на Playwright; сократила тестирование релиза с двух дней до трёх часов.' },
      { title: 'QA-инженер', company: 'Пик Диджитал', period: '2019 – 2022', text: 'Ручное и автоматизированное тестирование веб-приложений для e-commerce.' },
    ],
    education: { degree: 'Бакалавр информатики', school: 'Тбилисский государственный университет', period: '2015 – 2019' },
    skills: 'Playwright, Cypress, TypeScript, SQL, CI/CD',
    languages: 'Русский, английский',
    headings: { experience: 'Опыт работы', education: 'Образование', skills: 'Навыки', languages: 'Языки' },
  },
  importRows: [
    ['Полина', 'Сергеева', 'polina.sergeeva@example.com', '+995 555 31 42 01', 'Пик Диджитал', 'QA-инженер', '4', '', 'Тбилиси', 'Сайт вакансий', 'Русский; английский', '4 500 ₾', '1 месяц'],
    ['Артур', 'Ким', 'artur.kim@example.com', '+995 555 31 42 02', 'Блупик', 'DevOps-инженер', '6', '', 'Тбилиси', 'LinkedIn', 'Русский', '6 000 ₾', '2 недели'],
    ['Вера', 'Титова', 'vera.titova@example', '+995 555 31 42 03', 'Нова Лабс', 'Аналитик данных', '3', '', 'Батуми', 'Рекомендация', 'Русский', '', ''],
    ['Мария', 'Соколова', 'maria.sokolova@example.com', '+995 555 30 40 52', 'Пик Диджитал', 'Fullstack-разработчик', '5', '', 'Тбилиси', 'Рекомендация', '', '', ''],
    ['Глеб', 'Орехов', 'gleb.orekhov@example.com', '+995 555 31 42 05', 'Нова Лабс', 'Инженер данных', '5', '', 'Удалённо', 'Сайт вакансий', 'Русский; английский', '5 500 ₾', '1 месяц'],
  ],
}

export const DEMO: Record<Locale, DemoOrg> = { en: EN, ka: KA, ru: RU }

/** Shared by every demo login; staging only (the seed refuses other projects). */
export const DEMO_PASSWORD = 'GuideDemo!2026'

/** A demo person's full name. */
export const fullName = (c: Pick<DemoCandidate, 'firstName' | 'lastName'>) => `${c.firstName} ${c.lastName}`

/** The vacancy the walkthroughs use most (open, with candidates in every stage). */
export const SHOWCASE_VACANCY = 'engineer'
/** The candidate the walkthroughs open (interview stage, rich profile). */
export const SHOWCASE_CANDIDATE = 'c1'
