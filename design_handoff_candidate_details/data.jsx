// Shared candidate data — used by all three variations.
// Inferred from the screenshots: Aleksandre Merabishvili, Business Analyst / Product Owner.

const CANDIDATE = {
  id: 1,
  initials: 'AM',
  firstName: 'Aleksandre',
  lastName: 'Merabishvili',
  fullName: 'Aleksandre Merabishvili',
  status: 'active',
  addedRelative: '9 minutes ago',
  addedDate: 'May 14, 2026',
  lastUpdated: 'May 14, 2026',
  source: 'Public Form',
  // Summary-strip fields (new)
  location: 'Tbilisi, Georgia',
  timezone: 'GMT+4',
  languages: ['English', 'Georgian', 'Russian'],
  salaryExpectation: '$4,000 – $5,500 / mo',
  noticePeriod: '1 month',
  yearsExperience: 12,
  // Headline (derived from latest experience)
  headline: 'Senior Business Analyst at Space Neobank',
  // Skill tags (new — used by V2 hero)
  skills: ['Product Discovery', 'A/B Testing', 'Loan Products', 'Banking', 'CRM', 'Scoring', 'SQL', 'Stakeholder Mgmt'],
  // Contact
  contact: {
    email: 'alexmerabishvili@gmail.com',
    phone: '+995 599 89 29 17',
    linkedinUrl: '#',
  },
  // Documents
  documents: [
    { name: 'Aleksandre_Merabishvili_CV.pdf', kind: 'CV / Resume', size: '217.0 KB', uploaded: 'less than a minute ago' },
    { name: 'Aleksandre_Merabishvili_CV.pdf', kind: 'CV / Resume', size: '217.0 KB', uploaded: '9 minutes ago' },
  ],
  // Applied vacancies
  vacancies: [
    {
      id: 'biz-an',
      title: 'Business Analyst',
      department: 'Engineering',
      stage: 'Applied',
      stageIdx: 0,
      status: 'incomplete',
      applied: 'less than a minute ago',
      appliedShort: 'just now',
    },
    {
      id: 'prod-own',
      title: 'Product Owner',
      department: 'Engineering',
      stage: 'Applied',
      stageIdx: 0,
      status: 'incomplete',
      applied: '9 minutes ago',
      appliedShort: '9 min ago',
    },
  ],
  // Work experience
  experience: [
    {
      id: 'e1',
      title: 'Senior Business Analyst',
      company: 'Space Neobank',
      start: '2024-04',
      end: 'Present',
      duration: '1 yr 1 mo',
      summary: 'Created and integrated Loan Insurance into the loan application flow, improving customer protection. Implemented A/B testing and event tracking tools in loan application flows to optimize user experience.',
      bullets: [
        'Created and integrated Loan Insurance into the loan application flow.',
        'Implemented A/B testing and event tracking in loan flows.',
        'Owned product roadmap for two retail lending squads.',
      ],
    },
    {
      id: 'e2',
      title: 'Senior Product Owner / Business Analyst',
      company: 'Nexus',
      start: '2023-03',
      end: '2024-04',
      duration: '1 yr 1 mo',
      summary: 'Launched the first two loan products for a startup. Delivered full loan origination process across two digital channels and CRM.',
      bullets: [
        'Launched first two loan products for the startup.',
        'Delivered full loan origination across two digital channels + CRM.',
        'Implemented decision management and scoring modules.',
        'Built manual underwriting workflows.',
      ],
    },
    {
      id: 'e3',
      title: 'Senior Product Owner / Business Analyst',
      company: 'Space Neobank',
      start: '2021-04',
      end: '2023-04',
      duration: '2 yrs',
      summary: 'Developed installment loan cancellation process. Created a new refinancing loan product with full origination flow including scoring, mobile application flow.',
      bullets: [
        'Developed installment loan cancellation process initiated by merchants.',
        'Created refinancing loan product with disbursement in tranches.',
        'Owned scoring and mobile application flow.',
      ],
    },
    {
      id: 'e4',
      title: 'Head of Digital Banking Division',
      company: 'Liberty Bank',
      start: '2019-04',
      end: '2021-04',
      duration: '2 yrs',
      summary: 'Created a new digital internet bank for retail and corporate clients with single/batch bill payments and transfers, card-to-card transfers, account management, product activation.',
      bullets: [
        'Created new digital internet bank for retail and corporate clients.',
        'Single/batch bill payments and transfers (SWIFT, internal, tax).',
        'Card-to-card transfers, account management, product activation.',
      ],
    },
    {
      id: 'e5',
      title: 'Product Owner / Business Analyst',
      company: 'Liberty Bank',
      start: '2013-12',
      end: '2019-04',
      duration: '5 yrs 4 mo',
      summary: 'Created two new quick loan products and integrated them into multiple channels: digital banks, tablet sales module, USSD menu, PayBox, ATM, and CRM.',
      bullets: [
        'Created two new quick loan products.',
        'Integrated across digital banks, tablet sales, USSD, PayBox, ATM, CRM.',
        'Developed a dedicated quick loan website.',
      ],
    },
  ],
  // Education
  education: [
    {
      id: 'ed1',
      school: 'Ilia State University',
      degree: 'Master\u2019s',
      field: 'Information Technology, Information Systems',
      start: '2014',
      end: '2016',
    },
    {
      id: 'ed2',
      school: 'University of Georgia',
      degree: 'Bachelor\u2019s',
      field: 'Business Administration, Finance and Banking',
      start: '2010',
      end: '2014',
    },
  ],
  // Activity feed — unified
  activity: [
    { id: 'a1', kind: 'application', actor: null, when: 'just now', text: 'Applied to Business Analyst', meta: 'via Public Form' },
    { id: 'a2', kind: 'document', actor: null, when: 'just now', text: 'Uploaded CV', meta: 'Aleksandre_Merabishvili_CV.pdf' },
    { id: 'a3', kind: 'stage', actor: 'System', when: '9 min ago', text: 'Status set to Applied', meta: 'Product Owner' },
    { id: 'a4', kind: 'application', actor: null, when: '9 min ago', text: 'Applied to Product Owner', meta: 'via Public Form' },
    { id: 'a5', kind: 'document', actor: null, when: '9 min ago', text: 'Uploaded CV', meta: 'Aleksandre_Merabishvili_CV.pdf' },
    { id: 'a6', kind: 'note', actor: 'You', when: '9 min ago', text: 'Strong banking background — recommended for screening call this week.', meta: null },
    { id: 'a7', kind: 'stage', actor: 'System', when: '9 min ago', text: 'Profile created', meta: null },
  ],
};

// Pipeline stages — shown as mini chips beneath each vacancy
const PIPELINE_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];

Object.assign(window, { CANDIDATE, PIPELINE_STAGES });
