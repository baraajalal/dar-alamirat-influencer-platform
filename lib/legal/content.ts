import { LEGAL_DOCUMENT_VERSIONS, type LegalLocale } from "./versions";

export type LegalSection = { heading: string; paragraphs: string[] };
export type LegalDocument = {
  title: string;
  intro: string;
  versionLabel: string;
  sections: LegalSection[];
};

const termsAr: LegalDocument = {
  title: "شروط وأحكام الانضمام إلى مجتمع صُنّاع المحتوى",
  intro:
    "تنظم هذه الشروط التسجيل والانضمام واستخدام بوابة مجتمع صُنّاع المحتوى التابعة لدار الأميرات. إرسال الطلب يعني طلب الانضمام فقط ولا يضمن القبول في المجتمع أو في أي حملة.",
  versionLabel: `الإصدار ${LEGAL_DOCUMENT_VERSIONS.terms}`,
  sections: [
    {
      heading: "1. الأهلية وصحة البيانات",
      paragraphs: [
        "يجب أن تكون البيانات المقدمة صحيحة وحديثة وأن تعود الحسابات الاجتماعية إلى مقدم الطلب أو أن يكون مخولًا بإدارتها.",
        "يحق لدار الأميرات طلب معلومات إضافية للتحقق من الملف أو أهلية الانضمام قبل القبول أو أثناء استمرار العضوية.",
      ],
    },
    {
      heading: "2. مراجعة وقبول الطلب",
      paragraphs: [
        "تخضع جميع الطلبات للمراجعة. ويمكن قبول الطلب أو طلب تعديلات أو وضعه قيد الانتظار أو رفضه وفق متطلبات المجتمع والحملات المتاحة.",
        "لا يصبح الحساب نشطًا إلا بعد اعتماد الطلب وإكمال التفعيل من خلال الرابط المخصص للمؤثر.",
      ],
    },
    {
      heading: "3. الحملات والتعاونات",
      paragraphs: [
        "ظهور حملة في البوابة أو تقديم طلب للانضمام إليها لا يعد قبولًا نهائيًا. يتم تأكيد المشاركة بعد موافقة فريق الحملة واستكمال التفاصيل المطلوبة.",
        "تختلف شروط كل حملة من حيث نوع التعاون والمحتوى والمواعيد والمنتجات والمقابل المالي أو غير المالي، وتكون تفاصيل الحملة المعتمدة جزءًا من التزام المشارك فيها.",
      ],
    },
    {
      heading: "4. المحتوى والالتزام المهني",
      paragraphs: [
        "يلتزم صانع المحتوى بالتعليمات والمواعيد والمتطلبات التي تم قبولها لكل تعاون، وبالإفصاحات النظامية المطلوبة على المنصات عند انطباقها.",
        "يجب عدم تقديم معلومات مضللة عن المنتجات أو العلامات التجارية، وعدم نشر مواد سرية أو غير معتمدة إذا كانت الحملة تشترط المراجعة المسبقة.",
      ],
    },
    {
      heading: "5. المقابل والمدفوعات",
      paragraphs: [
        "قد يكون التعاون علاقات عامة (PR) أو منتجات أو قسائم أو مقابلًا ماليًا أو مزيجًا منها. وتحدد تفاصيل كل حملة الاستحقاق وشروطه.",
        "عند وجود مقابل مالي، يتحمل المؤثر مسؤولية تقديم بيانات دفع صحيحة ومحدثة. وقد يتم تعليق التحويل إلى حين استكمال أو اعتماد البيانات المطلوبة.",
      ],
    },
    {
      heading: "6. الحساب والأمان",
      paragraphs: [
        "المؤثر مسؤول عن المحافظة على سرية بيانات دخوله وعدم مشاركة رابط التفعيل أو كلمة المرور مع الآخرين.",
        "يجوز تعليق الوصول عند الاشتباه في إساءة الاستخدام أو انتحال الهوية أو تقديم بيانات جوهرية غير صحيحة أو مخالفة متطلبات التعاون.",
      ],
    },
    {
      heading: "7. تحديث الشروط",
      paragraphs: [
        "قد يتم تحديث هذه الشروط عند تطوير المنصة أو إجراءات المجتمع. عند وجود تغيير جوهري قد يُطلب قبول إصدار أحدث قبل الاستمرار في بعض الخدمات.",
      ],
    },
  ],
};

const termsEn: LegalDocument = {
  title: "Creator Community Membership Terms",
  intro:
    "These terms govern registration, membership, and use of the Dar Al Amirat Creator Community portal. Submitting an application is a request to join and does not guarantee acceptance into the community or any campaign.",
  versionLabel: `Version ${LEGAL_DOCUMENT_VERSIONS.terms}`,
  sections: [
    {
      heading: "1. Eligibility and accurate information",
      paragraphs: [
        "Information submitted must be accurate and current, and the social accounts must belong to the applicant or be accounts the applicant is authorized to manage.",
        "Dar Al Amirat may request additional information to verify the profile or assess eligibility before acceptance or while membership remains active.",
      ],
    },
    {
      heading: "2. Application review and acceptance",
      paragraphs: [
        "All applications are subject to review. An application may be accepted, returned for changes, placed on hold, or rejected based on community requirements and available opportunities.",
        "An account becomes active only after the application is approved and the creator completes activation using the dedicated activation link.",
      ],
    },
    {
      heading: "3. Campaigns and collaborations",
      paragraphs: [
        "Seeing a campaign in the portal or applying to join it is not final acceptance. Participation is confirmed only after the campaign team approves the creator and required details are completed.",
        "Each campaign may have different collaboration types, deliverables, deadlines, products, and financial or non-financial compensation. The approved campaign details form part of the creator's obligations for that collaboration.",
      ],
    },
    {
      heading: "4. Content and professional conduct",
      paragraphs: [
        "Creators must follow the agreed instructions, deadlines, and deliverables for each collaboration and make required platform disclosures when applicable.",
        "Creators must not provide misleading product or brand claims, or publish confidential or unapproved materials when a campaign requires prior review.",
      ],
    },
    {
      heading: "5. Compensation and payments",
      paragraphs: [
        "Collaborations may be PR, products, vouchers, paid, or a combination. The applicable campaign details determine entitlement and conditions.",
        "For paid collaborations, the creator is responsible for providing accurate and current payment information. Transfers may be held until required information is completed and approved.",
      ],
    },
    {
      heading: "6. Account security",
      paragraphs: [
        "Creators are responsible for keeping login credentials confidential and must not share activation links or passwords with others.",
        "Access may be suspended when misuse, impersonation, materially inaccurate information, or violations of collaboration requirements are suspected.",
      ],
    },
    {
      heading: "7. Updates to these terms",
      paragraphs: [
        "These terms may be updated as the platform or community processes evolve. If a material change is introduced, acceptance of a newer version may be required before some services can continue.",
      ],
    },
  ],
};

const privacyAr: LegalDocument = {
  title: "سياسة الخصوصية لمجتمع صُنّاع المحتوى",
  intro:
    "توضح هذه السياسة بصورة مبسطة البيانات التي تستخدمها منصة مجتمع صُنّاع المحتوى ولماذا نحتاجها لتشغيل التسجيل والمراجعة والحملات والمدفوعات.",
  versionLabel: `الإصدار ${LEGAL_DOCUMENT_VERSIONS.privacy}`,
  sections: [
    {
      heading: "1. البيانات التي نجمعها",
      paragraphs: [
        "قد تشمل البيانات الاسم ورقم الجوال والبريد والمدينة وسنة الميلاد ومعلومات الحسابات الاجتماعية وتفضيلات المحتوى وبيانات موثوق والمعلومات التي يضيفها المؤثر خلال الحملات.",
        "عند وجود مستحق مالي قد تتم معالجة بيانات الدفع والبيانات البنكية اللازمة لإتمام التحويل والمراجعة المالية.",
      ],
    },
    {
      heading: "2. لماذا نستخدم البيانات",
      paragraphs: [
        "نستخدم البيانات للتحقق من الملف، تقييم أهلية الانضمام، منع التكرار، إدارة الحساب، مطابقة المؤثر بالفرص، تشغيل الحملات، مراجعة المحتوى، إدارة المستحقات، ودعم المستخدم.",
        "قد نستخدم بيانات الأداء والتعاونات السابقة داخليًا لتحسين قرارات اختيار المؤثرين وتقييم نتائج الحملات.",
      ],
    },
    {
      heading: "3. الوصول الداخلي والمشاركة",
      paragraphs: [
        "يتم تقييد الوصول بحسب دور الموظف وحاجته للعمل. لا يفترض أن تظهر البيانات البنكية أو الحساسة لموظفين لا تتطلب مهامهم الوصول إليها.",
        "قد تتم مشاركة البيانات الضرورية مع مزودي خدمات يستخدمون لتشغيل المنصة أو تنفيذ المدفوعات أو خدمات تقنية مرتبطة، بالقدر اللازم لتقديم الخدمة.",
      ],
    },
    {
      heading: "4. الأرشيف ومنع التكرار",
      paragraphs: [
        "قد تتم مطابقة بيانات التسجيل مع سجلات تعاون سابقة لدى دار الأميرات بهدف منع إنشاء ملفات مكررة وربط تاريخ التعاون بالملف الصحيح.",
        "لا يعني وجود تطابق أرشيفي قبول الطلب تلقائيًا، وقد تتم مراجعة التطابق يدويًا عند وجود أكثر من احتمال.",
      ],
    },
    {
      heading: "5. الاحتفاظ والحماية",
      paragraphs: [
        "نحتفظ بالبيانات للمدة اللازمة لتشغيل المجتمع وإدارة التعاونات والسجلات المالية والتشغيلية ذات الصلة، مع تطبيق ضوابط وصول وحماية تقنية مناسبة لطبيعة البيانات.",
      ],
    },
    {
      heading: "6. تحديث البيانات والطلبات",
      paragraphs: [
        "يمكن للمؤثر تحديث البيانات المتاحة له من خلال البوابة أو التواصل مع فريق دار الأميرات عند الحاجة لتصحيح معلومات لا يمكن تعديلها ذاتيًا.",
      ],
    },
    {
      heading: "7. تحديث السياسة",
      paragraphs: [
        "قد يتم تحديث هذه السياسة مع تطور المنصة. يحتفظ النظام برقم إصدار سياسة الخصوصية التي تمت الموافقة عليها ووقت الموافقة لأغراض التدقيق التشغيلي.",
      ],
    },
  ],
};

const privacyEn: LegalDocument = {
  title: "Creator Community Privacy Policy",
  intro:
    "This policy provides a concise explanation of the data used by the Creator Community platform and why it is needed for registration, review, campaigns, and payments.",
  versionLabel: `Version ${LEGAL_DOCUMENT_VERSIONS.privacy}`,
  sections: [
    {
      heading: "1. Data we collect",
      paragraphs: [
        "Data may include name, mobile number, email, city, birth year, social account information, content preferences, Mawthooq information, and information a creator provides during collaborations.",
        "Where a financial entitlement exists, payment and bank information needed to review and complete the transfer may also be processed.",
      ],
    },
    {
      heading: "2. Why we use the data",
      paragraphs: [
        "We use data to verify profiles, assess membership eligibility, prevent duplicates, manage accounts, match creators with opportunities, operate campaigns, review content, manage entitlements, and support users.",
        "Performance data and prior collaborations may be used internally to improve creator selection and evaluate campaign results.",
      ],
    },
    {
      heading: "3. Internal access and sharing",
      paragraphs: [
        "Access is restricted according to employee role and business need. Bank or sensitive information should not be exposed to employees whose responsibilities do not require it.",
        "Necessary data may be shared with service providers used to operate the platform, process payments, or provide related technical services, only to the extent needed to provide those services.",
      ],
    },
    {
      heading: "4. Archive matching and duplicate prevention",
      paragraphs: [
        "Registration data may be matched against Dar Al Amirat's prior collaboration records to avoid duplicate profiles and connect collaboration history to the correct creator profile.",
        "An archive match does not automatically approve an application, and ambiguous matches may be reviewed manually.",
      ],
    },
    {
      heading: "5. Retention and protection",
      paragraphs: [
        "Data is retained for the period needed to operate the community and manage related collaborations, financial records, and operational records, with access controls and technical safeguards appropriate to the data.",
      ],
    },
    {
      heading: "6. Updates and correction requests",
      paragraphs: [
        "Creators may update information made available in the portal or contact the Dar Al Amirat team when information that cannot be edited directly needs correction.",
      ],
    },
    {
      heading: "7. Policy updates",
      paragraphs: [
        "This policy may be updated as the platform evolves. The system records the version of the privacy policy accepted and the acceptance time for operational audit purposes.",
      ],
    },
  ],
};

export function getLegalDocument(kind: "terms" | "privacy", locale: LegalLocale): LegalDocument {
  if (kind === "terms") return locale === "en" ? termsEn : termsAr;
  return locale === "en" ? privacyEn : privacyAr;
}
