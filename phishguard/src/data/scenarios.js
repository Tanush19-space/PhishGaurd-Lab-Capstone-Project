export const difficultyOrder = ["beginner", "intermediate", "advanced"];

export const difficultyConfig = {
  beginner: {
    label: "Beginner",
    description: "Spot obvious lures, fake domains, and urgent requests.",
    accent: "text-emerald-300",
    soft: "bg-emerald-400/10",
    border: "border-emerald-300/40",
  },
  intermediate: {
    label: "Intermediate",
    description: "Handle vendor, HR, and cloud workflow lookalikes.",
    accent: "text-cyan-300",
    soft: "bg-cyan-400/10",
    border: "border-cyan-300/40",
  },
  advanced: {
    label: "Advanced",
    description: "Investigate BEC, OAuth consent, and subtle trust abuse.",
    accent: "text-amber-300",
    soft: "bg-amber-400/10",
    border: "border-amber-300/40",
  },
};

export const roleConfig = {
  trainee: {
    label: "Trainee",
    description: "Practice simulations and review personal progress.",
    views: ["simulator", "dashboard"],
  },
  lead: {
    label: "Team Lead",
    description: "Coach a team with aggregate risk patterns.",
    views: ["simulator", "dashboard", "team"],
  },
  admin: {
    label: "Security Admin",
    description: "Manage scenarios, reporting, and full program controls.",
    views: ["simulator", "dashboard", "team", "library"],
  },
};

export const views = [
  { id: "simulator", label: "Simulator" },
  { id: "dashboard", label: "Dashboard" },
  { id: "team", label: "Team" },
  { id: "library", label: "Library" },
];

export const scenarios = [
  {
    id: "hr-password-reset",
    title: "HR password reset warning",
    difficulty: "beginner",
    senderName: "Human Resources",
    senderEmail: "hr-alerts@workday-secure.co",
    replyTo: "passworddesk.workday@gmail.com",
    subject: "Action required: password reset before 5 PM",
    received: "Today, 8:12 AM",
    preview: "Your benefits portal password expires today. Confirm access immediately.",
    body: [
      "Hello employee,",
      "Our yearly compliance audit found that your benefits portal password is out of date. Confirm your account before 5 PM today or your payroll profile may be locked.",
      "Use the secure verification page below and sign in with your company email password.",
      "Human Resources Security Desk",
    ],
    linkLabel: "Confirm my Workday access",
    linkUrl: "https://workday-secure.co/company-login",
    classification: "phishing",
    points: 70,
    tags: ["Credential theft", "Urgency", "Lookalike domain"],
    signals: [
      { id: "sender-domain", label: "Sender domain is not the official company or Workday domain", kind: "risk", valid: true },
      { id: "reply-gmail", label: "Reply-to address points to a free Gmail mailbox", kind: "risk", valid: true },
      { id: "urgent-lock", label: "Threatens payroll lockout with a same-day deadline", kind: "risk", valid: true },
      { id: "generic-greeting", label: "Uses a generic greeting instead of a named employee", kind: "risk", valid: true },
      { id: "display-name", label: "It says Human Resources in the display name", kind: "trust", valid: false },
    ],
    explanation: "This is phishing. The display name imitates HR, but the sender and reply-to domains do not match trusted HR systems. The urgent lockout language is designed to rush a credential submission.",
    recommendedAction: "Report the message, do not use the link, and visit Workday from a saved bookmark if you need to check your account.",
  },
  {
    id: "calendar-migration",
    title: "IT calendar migration notice",
    difficulty: "beginner",
    senderName: "IT Service Desk",
    senderEmail: "service.desk@northbank.example",
    replyTo: "service.desk@northbank.example",
    subject: "Calendar maintenance window on Saturday",
    received: "Yesterday, 4:48 PM",
    preview: "No action is required during the planned calendar migration.",
    body: [
      "Hi team,",
      "We will migrate shared calendars this Saturday from 10:00 PM to midnight. Calendar access may be read-only during the window.",
      "No password reset or sign-in action is required. The change ticket is CHG-4188 and is listed in the internal status portal.",
      "Thanks, IT Service Desk",
    ],
    linkLabel: "Internal status portal",
    linkUrl: "https://status.northbank.example/change/CHG-4188",
    classification: "legitimate",
    points: 55,
    tags: ["Legitimate notice", "Internal change"],
    signals: [
      { id: "matching-reply", label: "Sender and reply-to addresses match the company domain", kind: "trust", valid: true },
      { id: "no-password", label: "The message says no password or sign-in action is required", kind: "trust", valid: true },
      { id: "change-ticket", label: "Includes an internal change ticket reference", kind: "trust", valid: true },
      { id: "weekend-window", label: "Mentions a weekend maintenance window", kind: "risk", valid: false },
      { id: "status-link", label: "Link points to the internal status domain", kind: "trust", valid: true },
    ],
    explanation: "This appears legitimate. The domain is consistent, the reply-to matches, the link uses an internal status domain, and the notice does not ask for credentials or payment.",
    recommendedAction: "Verify through the internal status portal if needed, but no security report is required.",
  },
  {
    id: "payroll-direct-deposit",
    title: "Direct deposit verification",
    difficulty: "beginner",
    senderName: "Payroll Updates",
    senderEmail: "payroll@northbank.example.support-pay.com",
    replyTo: "payroll@support-pay.com",
    subject: "Verify direct deposit to avoid failed payment",
    received: "Today, 6:33 AM",
    preview: "Your next salary transfer may fail unless you verify your banking profile.",
    body: [
      "Dear staff member,",
      "We could not validate your direct deposit information for this week's payroll. Please open the attached secure form and enter your banking details.",
      "Failure to verify within 24 hours may delay your salary payment.",
      "Payroll Updates",
    ],
    attachment: "Direct_Deposit_Update.xlsm",
    classification: "phishing",
    points: 75,
    tags: ["Malicious attachment", "Payroll fraud"],
    signals: [
      { id: "external-subdomain", label: "Company name is buried inside an external support-pay.com domain", kind: "risk", valid: true },
      { id: "macro-file", label: "Attachment is an Excel macro-enabled file", kind: "risk", valid: true },
      { id: "banking-info", label: "Requests sensitive banking information by email", kind: "risk", valid: true },
      { id: "salary-pressure", label: "Uses salary delay pressure to force action", kind: "risk", valid: true },
      { id: "payroll-topic", label: "Payroll messages are always safe if they mention salary", kind: "trust", valid: false },
    ],
    explanation: "This is phishing. Payroll and banking themes are common lures, and the sender domain plus macro-enabled attachment make it unsafe.",
    recommendedAction: "Report the email and contact payroll through a known internal channel before making any banking changes.",
  },
  {
    id: "vendor-invoice",
    title: "Vendor invoice address change",
    difficulty: "intermediate",
    senderName: "Riverton Supplies",
    senderEmail: "ap@rivertonsupplies.com",
    replyTo: "rivertonsupplies-ap@outlook.com",
    subject: "Updated remittance details for invoice RS-2048",
    received: "Today, 10:22 AM",
    preview: "Please use the attached updated banking details for pending payment.",
    body: [
      "Hello Accounts Payable,",
      "We recently changed banks and need your team to update remittance details before processing invoice RS-2048.",
      "The invoice amount is unchanged. Please confirm once the payment profile is updated so we can avoid a service pause.",
      "Regards, Dana from Riverton Supplies",
    ],
    attachment: "RS-2048_New_Bank_Details.pdf",
    classification: "phishing",
    points: 95,
    tags: ["Business email compromise", "Payment fraud"],
    signals: [
      { id: "reply-outlook", label: "Reply-to changes from the vendor domain to an Outlook mailbox", kind: "risk", valid: true },
      { id: "bank-change", label: "Requests a payment profile or bank detail change", kind: "risk", valid: true },
      { id: "service-pause", label: "Mentions service pause to pressure AP approval", kind: "risk", valid: true },
      { id: "known-invoice", label: "References a real-looking invoice number", kind: "trust", valid: false },
      { id: "no-link", label: "No login link is present, so the email cannot be phishing", kind: "trust", valid: false },
    ],
    explanation: "This is likely payment fraud. BEC attempts often avoid obvious login links and instead request bank detail changes while hiding behind a believable invoice thread.",
    recommendedAction: "Use the approved vendor callback process. Never update banking details from email instructions alone.",
  },
  {
    id: "cloud-storage-policy",
    title: "Cloud storage retention policy",
    difficulty: "intermediate",
    senderName: "Collaboration Admin",
    senderEmail: "collaboration.admin@northbank.example",
    replyTo: "collaboration.admin@northbank.example",
    subject: "New file retention labels available next week",
    received: "Mon, 2:14 PM",
    preview: "New retention labels are rolling out. Training is optional and hosted internally.",
    body: [
      "Hi all,",
      "New file retention labels will appear in the cloud storage menu next week. They support our records management policy and do not require any file migration today.",
      "Optional training is available in the learning portal under Records Basics. The article ID is KB-7712.",
      "Collaboration Admin Team",
    ],
    linkLabel: "Learning portal article KB-7712",
    linkUrl: "https://learn.northbank.example/articles/KB-7712",
    classification: "legitimate",
    points: 75,
    tags: ["Legitimate notice", "Internal training"],
    signals: [
      { id: "company-domain", label: "Sender and link both use company-controlled domains", kind: "trust", valid: true },
      { id: "optional-training", label: "Training is optional and does not request credentials", kind: "trust", valid: true },
      { id: "kb-reference", label: "Knowledge base article ID can be verified internally", kind: "trust", valid: true },
      { id: "policy-change", label: "Any policy change email should be treated as malicious", kind: "risk", valid: false },
      { id: "cloud-mention", label: "Mentions cloud storage, which always means credential theft", kind: "risk", valid: false },
    ],
    explanation: "This appears legitimate. It has consistent internal domains, no credential request, and gives a verifiable internal article reference.",
    recommendedAction: "No report is needed. Open the learning portal directly if you want to review the article.",
  },
  {
    id: "mfa-fatigue",
    title: "MFA support verification",
    difficulty: "intermediate",
    senderName: "Identity Support",
    senderEmail: "identity-support@northbank.helpdesk.io",
    replyTo: "identity-support@northbank.helpdesk.io",
    subject: "MFA push failures detected on your account",
    received: "Today, 9:07 PM",
    preview: "Reply with the six digit MFA code so support can stop repeated prompts.",
    body: [
      "Hi,",
      "We detected repeated MFA push failures for your account. To stop the prompts, reply to this message with the six digit code you are about to receive.",
      "This is required to keep your account active overnight.",
      "Identity Support",
    ],
    classification: "phishing",
    points: 90,
    tags: ["MFA theft", "Credential security"],
    signals: [
      { id: "asks-code", label: "Requests a one-time MFA code by email", kind: "risk", valid: true },
      { id: "third-party-domain", label: "Sender is not on the company identity domain", kind: "risk", valid: true },
      { id: "overnight-threat", label: "Uses overnight account disablement pressure", kind: "risk", valid: true },
      { id: "support-topic", label: "Support teams can ask for MFA codes when troubleshooting", kind: "trust", valid: false },
      { id: "no-attachment", label: "No attachment means the email is safe", kind: "trust", valid: false },
    ],
    explanation: "This is phishing. Support should never ask for MFA codes, passwords, or approval prompts. Attackers use these messages to bypass multi-factor authentication.",
    recommendedAction: "Do not reply. Deny unexpected MFA prompts, report the email, and contact the service desk through the official portal.",
  },
  {
    id: "ceo-gift-card",
    title: "Executive gift card request",
    difficulty: "advanced",
    senderName: "Nora Patel",
    senderEmail: "nora.patel@northbank.example",
    replyTo: "nora.patel.board@gmail.com",
    subject: "Quick favor before the board session",
    received: "Today, 7:51 AM",
    preview: "Can you buy several digital gift cards? I am in meetings and cannot talk.",
    body: [
      "Are you available for a quick task? I need five digital gift cards for a client thank-you before the board session starts.",
      "I cannot take calls right now. Purchase them, scratch the codes, and reply here with the numbers. I will reimburse you by end of day.",
      "Nora",
    ],
    classification: "phishing",
    points: 120,
    tags: ["Executive impersonation", "Gift card fraud"],
    signals: [
      { id: "reply-personal", label: "Reply-to is a personal Gmail address despite a company sender", kind: "risk", valid: true },
      { id: "gift-cards", label: "Asks for gift card codes, a common irreversible payment method", kind: "risk", valid: true },
      { id: "no-calls", label: "Blocks normal verification by saying calls are impossible", kind: "risk", valid: true },
      { id: "executive-name", label: "The display name matches a real executive", kind: "trust", valid: false },
      { id: "short-email", label: "A short email from an executive is automatically trustworthy", kind: "trust", valid: false },
    ],
    explanation: "This is BEC fraud. Attackers often use a real executive name, urgency, and a personal reply-to address to push gift card or wire requests outside normal controls.",
    recommendedAction: "Report the message and verify any executive payment request through a known phone number or approved finance workflow.",
  },
  {
    id: "oauth-consent",
    title: "OAuth app consent request",
    difficulty: "advanced",
    senderName: "Secure Documents",
    senderEmail: "share@docu-signature.cloud",
    replyTo: "share@docu-signature.cloud",
    subject: "Encrypted document shared: Q4 compensation plan",
    received: "Today, 11:41 AM",
    preview: "Review the encrypted file and approve access for Secure Documents Viewer.",
    body: [
      "A protected compensation document has been shared with you.",
      "To view the file, approve Secure Documents Viewer for mail, files, contacts, and offline access. This keeps your session active while the document decrypts.",
      "This request expires in 30 minutes.",
    ],
    linkLabel: "Open encrypted document",
    linkUrl: "https://docu-signature.cloud/oauth/authorize",
    classification: "phishing",
    points: 130,
    tags: ["OAuth consent phishing", "Data access"],
    signals: [
      { id: "wide-permissions", label: "Requests broad mail, file, contact, and offline access", kind: "risk", valid: true },
      { id: "lookalike-brand", label: "Domain imitates a document signing brand but is not official", kind: "risk", valid: true },
      { id: "sensitive-topic", label: "Uses compensation data to create curiosity and urgency", kind: "risk", valid: true },
      { id: "oauth-not-password", label: "OAuth consent cannot be dangerous because it does not ask for a password", kind: "trust", valid: false },
      { id: "encrypted-word", label: "The word encrypted guarantees the file is safe", kind: "trust", valid: false },
    ],
    explanation: "This is phishing. OAuth consent attacks can grant attackers persistent access without stealing a password. The requested permissions are far broader than needed to view a document.",
    recommendedAction: "Do not approve the app. Report the email and ask identity administrators to review suspicious app consent activity.",
  },
  {
    id: "security-bulletin",
    title: "Security bulletin with verified advisory",
    difficulty: "advanced",
    senderName: "Security Operations",
    senderEmail: "soc@northbank.example",
    replyTo: "soc@northbank.example",
    subject: "Advisory: browser patch required by Friday",
    received: "Tue, 1:05 PM",
    preview: "Managed devices will patch automatically. Personal devices should use the vendor updater.",
    body: [
      "Team,",
      "A critical browser update was released today. Managed company devices will patch automatically. If you use an approved personal device, update through the browser's built-in updater or the vendor website.",
      "The advisory is mirrored in the security portal as SOC-2026-019. We will never attach browser installers to these notices.",
      "Security Operations",
    ],
    linkLabel: "Security portal advisory SOC-2026-019",
    linkUrl: "https://security.northbank.example/advisories/SOC-2026-019",
    classification: "legitimate",
    points: 105,
    tags: ["Legitimate security notice", "Patch management"],
    signals: [
      { id: "soc-domain", label: "Sender and advisory link use company security domains", kind: "trust", valid: true },
      { id: "no-installer", label: "Explicitly says installers will not be attached", kind: "trust", valid: true },
      { id: "verifiable-advisory", label: "Provides a security portal advisory ID that can be verified", kind: "trust", valid: true },
      { id: "critical-word", label: "The word critical means the message is always phishing", kind: "risk", valid: false },
      { id: "browser-update", label: "Any browser update message should be ignored", kind: "risk", valid: false },
    ],
    explanation: "This appears legitimate. It keeps users on trusted update paths, provides a verifiable internal advisory, and avoids attachments or credential requests.",
    recommendedAction: "Follow the standard patch process. If uncertain, open the security portal directly rather than clicking from the email.",
  },
];

export const scenarioLookup = new Map(scenarios.map((scenario) => [scenario.id, scenario]));






















