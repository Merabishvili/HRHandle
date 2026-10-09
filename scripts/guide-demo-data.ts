/**
 * Demo data for the guide screenshots — one fictional company per language, so
 * the Georgian guide shows Georgian names and vacancies, the Russian guide
 * Russian ones. Read by `scripts/seed-guide-demo.ts` (writes it to the staging
 * database) and `scripts/capture-screenshots.ts` (logs in as the owner, types
 * the walkthrough examples).
 *
 * Emails use example.com (reserved, never delivered). All names are invented.
 */
import type { Locale } from '@/lib/i18n/locales'

export type StageCode = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected'
export type UserKey = 'owner' | 'admin' | 'member'

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
}

export interface DemoApplication {
  candidate: string
  vacancy: string
  stage: StageCode
  daysAgo: number
  sourceType: 'manual' | 'public_form' | 'linkedin'
}

export interface DemoCustomField {
  name: string
  type: 'text' | 'number' | 'checkbox' | 'dropdown'
  options?: string[]
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
  vacancyFields: { group: string; fields: DemoCustomField[] }
  wizard: DemoWizard
}

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
      key: 'engineer',
      title: 'Senior Software Engineer',
      department: 'Engineering',
      location: 'Tbilisi, Georgia',
      workMode: 'hybrid',
      employmentType: 'full_time',
      status: 'open',
      salaryMin: 6000,
      salaryMax: 8000,
      hiringManager: 'admin',
      daysAgo: 21,
      description:
        'Join our platform team to build the features our customers use every day. You will own work from design to release and help shape how we build software.',
      responsibilities:
        'Design, build and ship features across the stack.\nReview code and write tests.\nMentor mid-level engineers.',
      requirements:
        '5+ years of professional software development.\nStrong TypeScript and React skills.\nExperience with PostgreSQL.',
    },
    {
      key: 'designer',
      title: 'Product Designer',
      department: 'Design',
      location: 'Tbilisi, Georgia',
      workMode: 'remote',
      employmentType: 'full_time',
      status: 'open',
      salaryMin: 4000,
      salaryMax: 5500,
      hiringManager: 'owner',
      daysAgo: 14,
      description:
        'Design new parts of our product from research to final screens, working closely with engineering and product.',
      responsibilities: 'Run user research.\nCreate flows, prototypes and final designs.\nMaintain the design system.',
      requirements: '3+ years of product design.\nFluent in Figma.\nA portfolio of shipped work.',
    },
    {
      key: 'sales',
      title: 'Sales Manager',
      department: 'Sales',
      location: 'Batumi, Georgia',
      workMode: 'onsite',
      employmentType: 'full_time',
      status: 'open',
      salaryMin: 3000,
      salaryMax: 4500,
      hiringManager: 'admin',
      daysAgo: 9,
      description: 'Grow our customer base in western Georgia and look after key accounts.',
      responsibilities: 'Find and win new customers.\nManage key accounts.\nReport on the sales pipeline.',
      requirements: '3+ years in B2B sales.\nExcellent negotiation skills.\nA driving licence.',
    },
    {
      key: 'hr',
      title: 'HR Coordinator',
      department: 'People',
      location: 'Tbilisi, Georgia',
      workMode: 'onsite',
      employmentType: 'part_time',
      status: 'draft',
      salaryMin: null,
      salaryMax: null,
      hiringManager: 'owner',
      daysAgo: 3,
      description: 'Support the people team with onboarding, employee records and HR policies.',
      responsibilities: 'Organise onboarding for new hires.\nKeep employee records up to date.',
      requirements: '1+ year in HR.\nVery well organised.',
    },
    {
      key: 'accountant',
      title: 'Accountant',
      department: 'Finance',
      location: 'Tbilisi, Georgia',
      workMode: 'onsite',
      employmentType: 'full_time',
      status: 'closed',
      salaryMin: 2500,
      salaryMax: 3500,
      hiringManager: 'owner',
      daysAgo: 60,
      description: 'Keep our books accurate and help close each month on time.',
      responsibilities: 'Record transactions.\nPrepare monthly reports.\nWork with external auditors.',
      requirements: '2+ years in accounting.\nKnowledge of Georgian tax rules.',
    },
  ],
  candidates: [
    { key: 'c1', firstName: 'Lukas', lastName: 'Becker', email: 'lukas.becker@example.com', phone: '+995 555 10 20 31', position: 'Senior Backend Engineer', company: 'Northline Software', location: 'Tbilisi, Georgia', source: 'LinkedIn', years: 7 },
    { key: 'c2', firstName: 'Sofia', lastName: 'Rossi', email: 'sofia.rossi@example.com', phone: '+995 555 10 20 32', position: 'Full Stack Developer', company: 'Peak Digital', location: 'Tbilisi, Georgia', source: 'Referral', years: 5 },
    { key: 'c3', firstName: 'Marco', lastName: 'Silva', email: 'marco.silva@example.com', phone: '+995 555 10 20 33', position: 'Software Engineer', company: 'Bluepeak', location: 'Batumi, Georgia', source: 'Careers page', years: 4 },
    { key: 'c4', firstName: 'Olivia', lastName: 'Brown', email: 'olivia.brown@example.com', phone: '+995 555 10 20 34', position: 'Lead Developer', company: 'Orbit Studio', location: 'Tbilisi, Georgia', source: 'LinkedIn', years: 9 },
    { key: 'c5', firstName: 'James', lastName: 'Wilson', email: 'james.wilson@example.com', phone: '+995 555 10 20 35', position: 'Frontend Developer', company: 'Nova Labs', location: 'Remote', source: 'Careers page', years: 3 },
    { key: 'c6', firstName: 'Priya', lastName: 'Sharma', email: 'priya.sharma@example.com', phone: '+995 555 10 20 36', position: 'UX Designer', company: 'Peak Digital', location: 'Tbilisi, Georgia', source: 'Referral', years: 4 },
    { key: 'c7', firstName: 'Ethan', lastName: 'Clarke', email: 'ethan.clarke@example.com', phone: '+995 555 10 20 37', position: 'Product Designer', company: 'Orbit Studio', location: 'Remote', source: 'LinkedIn', years: 6 },
    { key: 'c8', firstName: 'Grace', lastName: 'Taylor', email: 'grace.taylor@example.com', phone: '+995 555 10 20 38', position: 'Account Manager', company: 'Silk Road Retail', location: 'Batumi, Georgia', source: 'Careers page', years: 5 },
  ],
  applications: [],
  vacancyFields: {
    group: 'Hiring details',
    fields: [
      { name: 'Priority', type: 'dropdown', options: ['High', 'Medium', 'Low'] },
      { name: 'Budget approved', type: 'checkbox' },
    ],
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
}

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
      key: 'engineer',
      title: 'უფროსი პროგრამისტი',
      department: 'ტექნოლოგიები',
      location: 'თბილისი',
      workMode: 'hybrid',
      employmentType: 'full_time',
      status: 'open',
      salaryMin: 6000,
      salaryMax: 8000,
      hiringManager: 'admin',
      daysAgo: 21,
      description:
        'შემოუერთდით ჩვენს პლატფორმის გუნდს და შექმენით ფუნქციები, რომლებსაც ჩვენი მომხმარებლები ყოველდღიურად იყენებენ. თქვენ უხელმძღვანელებთ სამუშაოს დიზაინიდან გამოშვებამდე.',
      responsibilities:
        'ფუნქციების დაპროექტება, შექმნა და გამოშვება.\nკოდის მიმოხილვა და ტესტების წერა.\nსაშუალო დონის პროგრამისტების მენტორობა.',
      requirements:
        'პროგრამირების 5+ წლის პროფესიული გამოცდილება.\nTypeScript-ისა და React-ის კარგი ცოდნა.\nPostgreSQL-თან მუშაობის გამოცდილება.',
    },
    {
      key: 'designer',
      title: 'პროდუქტის დიზაინერი',
      department: 'დიზაინი',
      location: 'თბილისი',
      workMode: 'remote',
      employmentType: 'full_time',
      status: 'open',
      salaryMin: 4000,
      salaryMax: 5500,
      hiringManager: 'owner',
      daysAgo: 14,
      description:
        'დააპროექტეთ ჩვენი პროდუქტის ახალი ნაწილები კვლევიდან საბოლოო ეკრანებამდე, პროგრამისტებთან და პროდუქტის გუნდთან მჭიდრო თანამშრომლობით.',
      responsibilities: 'მომხმარებელთა კვლევის ჩატარება.\nსქემების, პროტოტიპებისა და საბოლოო დიზაინის შექმნა.\nდიზაინ-სისტემის მხარდაჭერა.',
      requirements: 'პროდუქტის დიზაინში 3+ წლის გამოცდილება.\nFigma-ს თავისუფალი ფლობა.\nგანხორციელებული პროექტების პორტფოლიო.',
    },
    {
      key: 'sales',
      title: 'გაყიდვების მენეჯერი',
      department: 'გაყიდვები',
      location: 'ბათუმი',
      workMode: 'onsite',
      employmentType: 'full_time',
      status: 'open',
      salaryMin: 3000,
      salaryMax: 4500,
      hiringManager: 'admin',
      daysAgo: 9,
      description: 'გაზარდეთ ჩვენი მომხმარებლების რაოდენობა დასავლეთ საქართველოში და იზრუნეთ მთავარ კლიენტებზე.',
      responsibilities: 'ახალი მომხმარებლების მოძიება და მოზიდვა.\nმთავარი კლიენტების მართვა.\nგაყიდვების ანგარიშგება.',
      requirements: 'B2B გაყიდვებში 3+ წლის გამოცდილება.\nმოლაპარაკების კარგი უნარი.\nმართვის მოწმობა.',
    },
    {
      key: 'hr',
      title: 'HR კოორდინატორი',
      department: 'ადამიანური რესურსები',
      location: 'თბილისი',
      workMode: 'onsite',
      employmentType: 'part_time',
      status: 'draft',
      salaryMin: null,
      salaryMax: null,
      hiringManager: 'owner',
      daysAgo: 3,
      description: 'დაეხმარეთ HR გუნდს ახალი თანამშრომლების ადაპტაციაში, პირადი საქმეების წარმოებასა და HR პოლიტიკებში.',
      responsibilities: 'ახალი თანამშრომლების ადაპტაციის ორგანიზება.\nპირადი საქმეების განახლება.',
      requirements: 'HR-ში 1+ წლის გამოცდილება.\nორგანიზებულობა.',
    },
    {
      key: 'accountant',
      title: 'ბუღალტერი',
      department: 'ფინანსები',
      location: 'თბილისი',
      workMode: 'onsite',
      employmentType: 'full_time',
      status: 'closed',
      salaryMin: 2500,
      salaryMax: 3500,
      hiringManager: 'owner',
      daysAgo: 60,
      description: 'აწარმოეთ ზუსტი ბუღალტერია და დაგვეხმარეთ ყოველი თვის დროულად დახურვაში.',
      responsibilities: 'ტრანზაქციების აღრიცხვა.\nყოველთვიური ანგარიშების მომზადება.\nგარე აუდიტორებთან თანამშრომლობა.',
      requirements: 'ბუღალტერიაში 2+ წლის გამოცდილება.\nსაქართველოს საგადასახადო კანონმდებლობის ცოდნა.',
    },
  ],
  candidates: [
    { key: 'c1', firstName: 'ლევან', lastName: 'გელაშვილი', email: 'levan.gelashvili@example.com', phone: '+995 555 20 30 41', position: 'უფროსი Backend პროგრამისტი', company: 'ნორთლაინ სოფტი', location: 'თბილისი', source: 'LinkedIn', years: 7 },
    { key: 'c2', firstName: 'ანა', lastName: 'ჯაფარიძე', email: 'ana.japaridze@example.com', phone: '+995 555 20 30 42', position: 'Full Stack პროგრამისტი', company: 'პიკ დიჯიტალი', location: 'თბილისი', source: 'რეკომენდაცია', years: 5 },
    { key: 'c3', firstName: 'დავით', lastName: 'ხუციშვილი', email: 'davit.khutsishvili@example.com', phone: '+995 555 20 30 43', position: 'პროგრამისტი', company: 'ბლუპიკი', location: 'ბათუმი', source: 'ვაკანსიების გვერდი', years: 4 },
    { key: 'c4', firstName: 'თამარ', lastName: 'მაისურაძე', email: 'tamar.maisuradze@example.com', phone: '+995 555 20 30 44', position: 'წამყვანი პროგრამისტი', company: 'ორბიტ სტუდიო', location: 'თბილისი', source: 'LinkedIn', years: 9 },
    { key: 'c5', firstName: 'ნიკა', lastName: 'ჩხეიძე', email: 'nika.chkheidze@example.com', phone: '+995 555 20 30 45', position: 'Frontend პროგრამისტი', company: 'ნოვა ლაბსი', location: 'დისტანციური', source: 'ვაკანსიების გვერდი', years: 3 },
    { key: 'c6', firstName: 'ეკა', lastName: 'წერეთელი', email: 'eka.tsereteli@example.com', phone: '+995 555 20 30 46', position: 'UX დიზაინერი', company: 'პიკ დიჯიტალი', location: 'თბილისი', source: 'რეკომენდაცია', years: 4 },
    { key: 'c7', firstName: 'ირაკლი', lastName: 'ბოლქვაძე', email: 'irakli.bolkvadze@example.com', phone: '+995 555 20 30 47', position: 'პროდუქტის დიზაინერი', company: 'ორბიტ სტუდიო', location: 'დისტანციური', source: 'LinkedIn', years: 6 },
    { key: 'c8', firstName: 'სალომე', lastName: 'კვარაცხელია', email: 'salome.kvaratskhelia@example.com', phone: '+995 555 20 30 48', position: 'კლიენტებთან ურთიერთობის მენეჯერი', company: 'აბრეშუმის გზა რითეილი', location: 'ბათუმი', source: 'ვაკანსიების გვერდი', years: 5 },
  ],
  applications: [],
  vacancyFields: {
    group: 'დაქირავების დეტალები',
    fields: [
      { name: 'პრიორიტეტი', type: 'dropdown', options: ['მაღალი', 'საშუალო', 'დაბალი'] },
      { name: 'ბიუჯეტი დამტკიცებულია', type: 'checkbox' },
    ],
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
}

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
      key: 'engineer',
      title: 'Старший разработчик',
      department: 'Разработка',
      location: 'Тбилиси',
      workMode: 'hybrid',
      employmentType: 'full_time',
      status: 'open',
      salaryMin: 6000,
      salaryMax: 8000,
      hiringManager: 'admin',
      daysAgo: 21,
      description:
        'Присоединяйтесь к команде платформы и создавайте функции, которыми наши клиенты пользуются каждый день. Вы будете вести задачи от проектирования до релиза.',
      responsibilities:
        'Проектирование, разработка и выпуск функций.\nКод-ревью и написание тестов.\nНаставничество для разработчиков среднего уровня.',
      requirements:
        'От 5 лет коммерческой разработки.\nУверенное знание TypeScript и React.\nОпыт работы с PostgreSQL.',
    },
    {
      key: 'designer',
      title: 'Продуктовый дизайнер',
      department: 'Дизайн',
      location: 'Тбилиси',
      workMode: 'remote',
      employmentType: 'full_time',
      status: 'open',
      salaryMin: 4000,
      salaryMax: 5500,
      hiringManager: 'owner',
      daysAgo: 14,
      description:
        'Проектируйте новые части продукта — от исследований до финальных экранов — в тесной работе с разработкой и продуктом.',
      responsibilities: 'Проведение пользовательских исследований.\nСоздание схем, прототипов и макетов.\nПоддержка дизайн-системы.',
      requirements: 'От 3 лет в продуктовом дизайне.\nСвободное владение Figma.\nПортфолио реализованных проектов.',
    },
    {
      key: 'sales',
      title: 'Менеджер по продажам',
      department: 'Продажи',
      location: 'Батуми',
      workMode: 'onsite',
      employmentType: 'full_time',
      status: 'open',
      salaryMin: 3000,
      salaryMax: 4500,
      hiringManager: 'admin',
      daysAgo: 9,
      description: 'Расширяйте клиентскую базу в западной Грузии и ведите ключевых клиентов.',
      responsibilities: 'Поиск и привлечение новых клиентов.\nВедение ключевых клиентов.\nОтчётность по воронке продаж.',
      requirements: 'От 3 лет в B2B-продажах.\nОтличные навыки переговоров.\nВодительские права.',
    },
    {
      key: 'hr',
      title: 'HR-координатор',
      department: 'Персонал',
      location: 'Тбилиси',
      workMode: 'onsite',
      employmentType: 'part_time',
      status: 'draft',
      salaryMin: null,
      salaryMax: null,
      hiringManager: 'owner',
      daysAgo: 3,
      description: 'Помогайте HR-команде с адаптацией новичков, кадровым учётом и HR-политиками.',
      responsibilities: 'Организация адаптации новых сотрудников.\nВедение кадровых документов.',
      requirements: 'От 1 года в HR.\nОрганизованность.',
    },
    {
      key: 'accountant',
      title: 'Бухгалтер',
      department: 'Финансы',
      location: 'Тбилиси',
      workMode: 'onsite',
      employmentType: 'full_time',
      status: 'closed',
      salaryMin: 2500,
      salaryMax: 3500,
      hiringManager: 'owner',
      daysAgo: 60,
      description: 'Ведите точный учёт и помогайте вовремя закрывать каждый месяц.',
      responsibilities: 'Учёт операций.\nПодготовка ежемесячной отчётности.\nРабота с внешними аудиторами.',
      requirements: 'От 2 лет в бухгалтерии.\nЗнание налогового законодательства Грузии.',
    },
  ],
  candidates: [
    { key: 'c1', firstName: 'Алексей', lastName: 'Петров', email: 'aleksei.petrov@example.com', phone: '+995 555 30 40 51', position: 'Старший backend-разработчик', company: 'Нортлайн Софт', location: 'Тбилиси', source: 'LinkedIn', years: 7 },
    { key: 'c2', firstName: 'Мария', lastName: 'Соколова', email: 'maria.sokolova@example.com', phone: '+995 555 30 40 52', position: 'Fullstack-разработчик', company: 'Пик Диджитал', location: 'Тбилиси', source: 'Рекомендация', years: 5 },
    { key: 'c3', firstName: 'Игорь', lastName: 'Волков', email: 'igor.volkov@example.com', phone: '+995 555 30 40 53', position: 'Разработчик', company: 'Блупик', location: 'Батуми', source: 'Страница вакансий', years: 4 },
    { key: 'c4', firstName: 'Ольга', lastName: 'Морозова', email: 'olga.morozova@example.com', phone: '+995 555 30 40 54', position: 'Ведущий разработчик', company: 'Орбит Студио', location: 'Тбилиси', source: 'LinkedIn', years: 9 },
    { key: 'c5', firstName: 'Сергей', lastName: 'Новиков', email: 'sergei.novikov@example.com', phone: '+995 555 30 40 55', position: 'Frontend-разработчик', company: 'Нова Лабс', location: 'Удалённо', source: 'Страница вакансий', years: 3 },
    { key: 'c6', firstName: 'Наталья', lastName: 'Павлова', email: 'natalia.pavlova@example.com', phone: '+995 555 30 40 56', position: 'UX-дизайнер', company: 'Пик Диджитал', location: 'Тбилиси', source: 'Рекомендация', years: 4 },
    { key: 'c7', firstName: 'Андрей', lastName: 'Фёдоров', email: 'andrei.fedorov@example.com', phone: '+995 555 30 40 57', position: 'Продуктовый дизайнер', company: 'Орбит Студио', location: 'Удалённо', source: 'LinkedIn', years: 6 },
    { key: 'c8', firstName: 'Татьяна', lastName: 'Лебедева', email: 'tatiana.lebedeva@example.com', phone: '+995 555 30 40 58', position: 'Менеджер по работе с клиентами', company: 'Шёлковый Путь Ритейл', location: 'Батуми', source: 'Страница вакансий', years: 5 },
  ],
  applications: [],
  vacancyFields: {
    group: 'Детали найма',
    fields: [
      { name: 'Приоритет', type: 'dropdown', options: ['Высокий', 'Средний', 'Низкий'] },
      { name: 'Бюджет утверждён', type: 'checkbox' },
    ],
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
}

/** The same hiring story in every language: who applied where, and how far they got. */
const APPLICATIONS: DemoApplication[] = [
  { candidate: 'c1', vacancy: 'engineer', stage: 'interview', daysAgo: 18, sourceType: 'linkedin' },
  { candidate: 'c2', vacancy: 'engineer', stage: 'screening', daysAgo: 12, sourceType: 'manual' },
  { candidate: 'c3', vacancy: 'engineer', stage: 'applied', daysAgo: 4, sourceType: 'public_form' },
  { candidate: 'c4', vacancy: 'engineer', stage: 'offer', daysAgo: 20, sourceType: 'linkedin' },
  { candidate: 'c5', vacancy: 'engineer', stage: 'applied', daysAgo: 2, sourceType: 'public_form' },
  { candidate: 'c6', vacancy: 'designer', stage: 'screening', daysAgo: 10, sourceType: 'manual' },
  { candidate: 'c7', vacancy: 'designer', stage: 'interview', daysAgo: 11, sourceType: 'linkedin' },
  { candidate: 'c8', vacancy: 'sales', stage: 'applied', daysAgo: 5, sourceType: 'public_form' },
]

for (const org of [EN, KA, RU]) org.applications = APPLICATIONS

export const DEMO: Record<Locale, DemoOrg> = { en: EN, ka: KA, ru: RU }

/** Shared by every demo login; staging only (the seed refuses other projects). */
export const DEMO_PASSWORD = 'GuideDemo!2026'
