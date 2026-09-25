// Long-form legal / informational content for the storefront policy pages
// (Paymob onboarding requires: Terms, Refund, Privacy, Shipping, About, plus a
// Contact section with email / phone / address).
//
// Kept out of the i18n message JSON because it is long-form prose. UI chrome
// still uses next-intl; this module is the single source for page bodies.
//
// ⚠️  REPLACE the placeholder values in SITE_CONTACT with ROMZ's real, verifiable
//     details before submitting to Paymob — they check that these are genuine.

import type { Locale } from "@/lib/types";

export interface SiteContact {
  email: string;
  phone: string;
  whatsapp: string;
  address: Record<Locale, string>;
  hours: Record<Locale, string>;
}

// TODO(ROMZ): swap these placeholders for the real business details.
export const SITE_CONTACT: SiteContact = {
  email: "support@romz.example",
  phone: "+20 100 000 0000",
  whatsapp: "+20 100 000 0000",
  address: {
    en: "[Street address], Cairo, Egypt",
    ar: "[العنوان بالتفصيل]، القاهرة، مصر",
  },
  hours: {
    en: "Sunday–Thursday, 10:00 AM – 6:00 PM (EET)",
    ar: "الأحد – الخميس، ١٠:٠٠ ص – ٦:٠٠ م (بتوقيت القاهرة)",
  },
};

const UPDATED: Record<Locale, string> = {
  en: "July 17, 2026",
  ar: "١٧ يوليو ٢٠٢٦",
};

export interface PolicySection {
  heading: string;
  body: string[];
}

export interface PolicyContent {
  title: string;
  updatedLabel: string;
  updated: string;
  intro?: string;
  sections: PolicySection[];
}

export type PolicyKey =
  | "about"
  | "terms"
  | "refund-policy"
  | "privacy-policy"
  | "shipping-policy";

const { email, phone, whatsapp, address, hours } = SITE_CONTACT;

const POLICIES: Record<PolicyKey, Record<Locale, PolicyContent>> = {
  about: {
    en: {
      title: "About Us",
      updatedLabel: "Last updated",
      updated: UPDATED.en,
      intro:
        "ROMZ is an Egyptian activewear brand built on one idea: wear your power. We design performance sportswear for athletes and everyday movers who never slow down.",
      sections: [
        {
          heading: "Who We Are",
          body: [
            "ROMZ is a homegrown Egyptian brand creating high-performance athletic wear designed and made for the Egyptian climate and lifestyle. From compression fits to everyday training essentials, every piece is engineered to move with you.",
          ],
        },
        {
          heading: "Our Mission",
          body: [
            "We exist to help you train harder, feel stronger and look sharp doing it. We obsess over fabric, fit and finish so that you can focus on performance — not on your gear.",
          ],
        },
        {
          heading: "What We Make",
          body: [
            "Our range covers men's and women's activewear: tops, bottoms, compression pieces and training essentials. We work with technical, breathable fabrics and test our fits on real bodies in real workouts.",
          ],
        },
        {
          heading: "Quality & Fit",
          body: [
            "Every product page includes a size chart. Our compression fit runs snug by design — if you prefer a relaxed feel, we recommend sizing up. If anything doesn't fit right, our exchange and return policy has you covered.",
          ],
        },
        {
          heading: "Get in Touch",
          body: [
            `Questions, feedback or partnership ideas? Email us at ${email} or call ${phone}. We'd love to hear from you.`,
          ],
        },
      ],
    },
    ar: {
      title: "من نحن",
      updatedLabel: "آخر تحديث",
      updated: UPDATED.ar,
      intro:
        "رومز علامة مصرية للملابس الرياضية اتبنت على فكرة واحدة: البس قوتك. بنصمم ملابس أداء رياضية للرياضيين ولكل شخص بيتحرك طول اليوم ومبيبطّأش.",
      sections: [
        {
          heading: "مين إحنا",
          body: [
            "رومز علامة مصرية بتصنع ملابس رياضية عالية الأداء مصممة للمناخ وأسلوب الحياة المصري. من الملابس الضاغطة لأساسيات التمرين اليومية، كل قطعة متصممة إنها تتحرك معاك.",
          ],
        },
        {
          heading: "رسالتنا",
          body: [
            "موجودين علشان نساعدك تتمرن أقوى، تحس إنك أقوى، وتبان شيك وانت بتعمل كده. بنهتم بالخامة والقصّة والتشطيب علشان انت تركّز على الأداء بس.",
          ],
        },
        {
          heading: "بنصنع إيه",
          body: [
            "تشكيلتنا بتغطي ملابس رياضية للرجال والنساء: توبات، بناطيل، قطع ضاغطة وأساسيات التمرين. بنستخدم خامات تقنية بتسمح بالتهوية، وبنجرّب القصّات على أجسام حقيقية في تمارين حقيقية.",
          ],
        },
        {
          heading: "الجودة والمقاس",
          body: [
            "كل صفحة منتج فيها جدول مقاسات. القصّة الضاغطة بتيجي ضيقة بالتصميم — لو بتحب إحساس أوسع ننصحك تختار مقاس أكبر. ولو أي حاجة مش مظبوطة، سياسة الاستبدال والاسترجاع بتغطيك.",
          ],
        },
        {
          heading: "تواصل معنا",
          body: [
            `عندك سؤال أو اقتراح أو فكرة شراكة؟ ابعتلنا على ${email} أو اتصل بينا على ${phone}. يسعدنا نسمع منك.`,
          ],
        },
      ],
    },
  },

  terms: {
    en: {
      title: "Terms & Conditions",
      updatedLabel: "Last updated",
      updated: UPDATED.en,
      intro:
        "These Terms & Conditions govern your use of the ROMZ website and your purchase of products from us. By placing an order, you agree to these terms.",
      sections: [
        {
          heading: "1. Acceptance of Terms",
          body: [
            "By accessing this website and/or placing an order, you confirm that you are at least 18 years old (or have the consent of a parent or guardian) and that you accept these Terms & Conditions in full.",
          ],
        },
        {
          heading: "2. Products & Availability",
          body: [
            "We make every effort to display product colors, descriptions and prices accurately. However, we do not guarantee that your screen's display of any color is accurate. All products are subject to availability and may be withdrawn at any time.",
          ],
        },
        {
          heading: "3. Orders & Acceptance",
          body: [
            "Your order is an offer to buy. We reserve the right to accept or decline any order, and to limit or cancel quantities. If we cancel an order after payment, you will receive a full refund.",
          ],
        },
        {
          heading: "4. Pricing & Payment",
          body: [
            "All prices are listed in Egyptian Pounds (EGP) and include applicable taxes unless stated otherwise. We accept payment via Paymob (credit/debit cards, mobile wallets and installments) and Cash on Delivery (COD).",
            "Card and wallet payments are processed securely by Paymob. ROMZ does not store your full card details.",
          ],
        },
        {
          heading: "5. Shipping & Delivery",
          body: [
            "Delivery times and fees are described in our Shipping Policy. Delivery estimates are provided in good faith but are not guaranteed and may be affected by factors outside our control.",
          ],
        },
        {
          heading: "6. Returns & Refunds",
          body: [
            "Your rights to return items and receive refunds are set out in our Refund Policy. Please review it before purchasing.",
          ],
        },
        {
          heading: "7. Intellectual Property",
          body: [
            "All content on this website — including the ROMZ name, logo, designs, images and text — is the property of ROMZ and is protected by law. You may not use it without our written permission.",
          ],
        },
        {
          heading: "8. Limitation of Liability",
          body: [
            "To the maximum extent permitted by law, ROMZ is not liable for any indirect or consequential loss arising from your use of the website or products. Our total liability is limited to the value of the products you purchased.",
          ],
        },
        {
          heading: "9. Governing Law",
          body: [
            "These terms are governed by the laws of the Arab Republic of Egypt, and any disputes are subject to the jurisdiction of the Egyptian courts.",
          ],
        },
        {
          heading: "10. Changes to These Terms",
          body: [
            "We may update these Terms & Conditions from time to time. The version published on this page at the time of your order applies to that order.",
          ],
        },
        {
          heading: "11. Contact",
          body: [
            `For any questions about these terms, contact us at ${email} or ${phone}.`,
          ],
        },
      ],
    },
    ar: {
      title: "الشروط والأحكام",
      updatedLabel: "آخر تحديث",
      updated: UPDATED.ar,
      intro:
        "الشروط والأحكام دي بتنظّم استخدامك لموقع رومز وشرائك للمنتجات منّا. بمجرد ما تعمل طلب، انت بتوافق على الشروط دي.",
      sections: [
        {
          heading: "١. قبول الشروط",
          body: [
            "بدخولك الموقع و/أو عملك لطلب، انت بتأكد إن عمرك ١٨ سنة على الأقل (أو معاك موافقة ولي الأمر) وإنك موافق على الشروط والأحكام دي بالكامل.",
          ],
        },
        {
          heading: "٢. المنتجات والتوافر",
          body: [
            "بنبذل كل جهد لعرض ألوان المنتجات وأوصافها وأسعارها بدقة. لكن مش بنضمن إن عرض الألوان على شاشتك دقيق ١٠٠٪. كل المنتجات خاضعة للتوافر وممكن تتسحب في أي وقت.",
          ],
        },
        {
          heading: "٣. الطلبات وقبولها",
          body: [
            "طلبك بيُعتبر عرض شراء. بنحتفظ بحقنا في قبول أو رفض أي طلب، وتحديد أو إلغاء الكميات. لو ألغينا طلب بعد الدفع، هتستلم استرداد كامل.",
          ],
        },
        {
          heading: "٤. الأسعار والدفع",
          body: [
            "كل الأسعار بالجنيه المصري (ج.م) وشاملة الضرائب المطبقة إلا لو اتذكر غير كده. بنقبل الدفع عن طريق Paymob (كروت ائتمان/خصم، محافظ إلكترونية، وتقسيط) والدفع عند الاستلام (COD).",
            "مدفوعات الكروت والمحافظ بتتم بشكل آمن من خلال Paymob. رومز مبتخزّنش بيانات كارتك كاملة.",
          ],
        },
        {
          heading: "٥. الشحن والتوصيل",
          body: [
            "مواعيد ورسوم التوصيل موضحة في سياسة الشحن. تقديرات التوصيل بنقدّمها بحسن نية لكنها مش مضمونة وممكن تتأثر بعوامل خارجة عن إرادتنا.",
          ],
        },
        {
          heading: "٦. الاسترجاع والاسترداد",
          body: [
            "حقوقك في إرجاع المنتجات واسترداد المبالغ موضحة في سياسة الاسترجاع. من فضلك راجعها قبل الشراء.",
          ],
        },
        {
          heading: "٧. الملكية الفكرية",
          body: [
            "كل المحتوى على الموقع — بما في ذلك اسم رومز والشعار والتصميمات والصور والنصوص — ملك لرومز ومحمي قانونًا. مينفعش تستخدمه من غير إذن كتابي منّا.",
          ],
        },
        {
          heading: "٨. حدود المسؤولية",
          body: [
            "لأقصى حد يسمح به القانون، رومز غير مسؤولة عن أي خسارة غير مباشرة أو تبعية ناتجة عن استخدامك للموقع أو المنتجات. إجمالي مسؤوليتنا محدود بقيمة المنتجات اللي اشتريتها.",
          ],
        },
        {
          heading: "٩. القانون الحاكم",
          body: [
            "الشروط دي خاضعة لقوانين جمهورية مصر العربية، وأي نزاعات تخضع لاختصاص المحاكم المصرية.",
          ],
        },
        {
          heading: "١٠. تعديل الشروط",
          body: [
            "ممكن نحدّث الشروط والأحكام دي من وقت للتاني. النسخة المنشورة على الصفحة دي وقت طلبك هي اللي بتنطبق على الطلب ده.",
          ],
        },
        {
          heading: "١١. التواصل",
          body: [
            `لأي استفسار عن الشروط دي، تواصل معانا على ${email} أو ${phone}.`,
          ],
        },
      ],
    },
  },

  "refund-policy": {
    en: {
      title: "Refund & Return Policy",
      updatedLabel: "Last updated",
      updated: UPDATED.en,
      intro:
        "We want you to love what you ordered. If something isn't right, you can return or exchange eligible items within 14 days of delivery.",
      sections: [
        {
          heading: "1. Return Window",
          body: [
            "You may request a return or exchange within 14 days of receiving your order.",
          ],
        },
        {
          heading: "2. Eligibility",
          body: [
            "To be eligible, items must be unworn, unwashed, with all original tags attached and in their original packaging. We may refuse returns that show signs of use.",
          ],
        },
        {
          heading: "3. Non-Returnable Items",
          body: [
            "For hygiene reasons, certain items (such as innerwear) cannot be returned unless they are faulty. Final-sale or clearance items marked as non-returnable are also excluded.",
          ],
        },
        {
          heading: "4. How to Request a Return",
          body: [
            `Contact us at ${email} or ${phone} within the return window with your order number and the item(s) you'd like to return or exchange. Our team will guide you through the next steps.`,
          ],
        },
        {
          heading: "5. Refund Method & Timeline",
          body: [
            "Once we receive and inspect your return, we'll notify you of the outcome. Approved refunds for card and wallet payments are issued to your original Paymob payment method, typically within 7–14 business days depending on your bank.",
            "For Cash on Delivery orders, refunds are made via bank transfer or mobile wallet to the details you provide.",
          ],
        },
        {
          heading: "6. Exchanges",
          body: [
            "Want a different size or color? We offer free exchanges on eligible items within the return window, subject to stock availability.",
          ],
        },
        {
          heading: "7. Damaged, Faulty or Wrong Items",
          body: [
            "If you receive a damaged, faulty or incorrect item, contact us within 48 hours of delivery with photos. We'll arrange a replacement or full refund at no cost to you.",
          ],
        },
        {
          heading: "8. Return Shipping",
          body: [
            "For faulty or incorrect items, ROMZ covers return shipping. For change-of-mind returns, return shipping arrangements will be confirmed by our team when you contact us.",
          ],
        },
        {
          heading: "9. Contact",
          body: [
            `Questions about a return or refund? Reach us at ${email} or ${phone}.`,
          ],
        },
      ],
    },
    ar: {
      title: "سياسة الاسترجاع والاسترداد",
      updatedLabel: "آخر تحديث",
      updated: UPDATED.ar,
      intro:
        "عايزينك تحب اللي طلبته. لو في حاجة مش مظبوطة، تقدر ترجّع أو تستبدل المنتجات المؤهلة خلال ١٤ يوم من الاستلام.",
      sections: [
        {
          heading: "١. مدة الاسترجاع",
          body: [
            "تقدر تطلب استرجاع أو استبدال خلال ١٤ يوم من استلام طلبك.",
          ],
        },
        {
          heading: "٢. شروط الأهلية",
          body: [
            "علشان يكون المنتج مؤهل، لازم يكون غير ملبوس وغير مغسول، بكل التيكيتات الأصلية وفي عبوته الأصلية. ممكن نرفض المرتجعات اللي عليها علامات استخدام.",
          ],
        },
        {
          heading: "٣. منتجات غير قابلة للاسترجاع",
          body: [
            "لأسباب صحية، بعض المنتجات (زي الملابس الداخلية) لا يمكن إرجاعها إلا لو كانت معيبة. المنتجات المخفّضة نهائيًا أو المعلّم عليها إنها غير قابلة للاسترجاع مستثناة كمان.",
          ],
        },
        {
          heading: "٤. إزاي تطلب الاسترجاع",
          body: [
            `تواصل معانا على ${email} أو ${phone} خلال مدة الاسترجاع ومعاك رقم الطلب والمنتج/المنتجات اللي عايز ترجّعها أو تستبدلها. فريقنا هيرشدك للخطوات التالية.`,
          ],
        },
        {
          heading: "٥. طريقة ومدة الاسترداد",
          body: [
            "بمجرد ما نستلم المرتجع ونفحصه، هنبلّغك بالنتيجة. المبالغ المستردة للدفع بالكارت أو المحفظة بترجع لنفس وسيلة الدفع عبر Paymob، عادةً خلال ٧–١٤ يوم عمل حسب البنك.",
            "بالنسبة لطلبات الدفع عند الاستلام، الاسترداد بيتم عن طريق تحويل بنكي أو محفظة إلكترونية على البيانات اللي هتقدّمها.",
          ],
        },
        {
          heading: "٦. الاستبدال",
          body: [
            "عايز مقاس أو لون مختلف؟ بنوفّر استبدال مجاني للمنتجات المؤهلة خلال مدة الاسترجاع، حسب توافر المخزون.",
          ],
        },
        {
          heading: "٧. منتجات تالفة أو معيبة أو خاطئة",
          body: [
            "لو استلمت منتج تالف أو معيب أو خطأ، تواصل معانا خلال ٤٨ ساعة من الاستلام ومعاك صور. هنرتّب استبدال أو استرداد كامل من غير أي تكلفة عليك.",
          ],
        },
        {
          heading: "٨. شحن المرتجعات",
          body: [
            "بالنسبة للمنتجات المعيبة أو الخاطئة، رومز بتتحمّل مصاريف شحن الإرجاع. أما في حالة تغيير الرأي، هيتم تأكيد ترتيبات شحن الإرجاع من فريقنا وقت تواصلك معانا.",
          ],
        },
        {
          heading: "٩. التواصل",
          body: [
            `عندك سؤال عن الاسترجاع أو الاسترداد؟ تواصل معانا على ${email} أو ${phone}.`,
          ],
        },
      ],
    },
  },

  "privacy-policy": {
    en: {
      title: "Privacy Policy",
      updatedLabel: "Last updated",
      updated: UPDATED.en,
      intro:
        "This Privacy Policy explains what information ROMZ collects, how we use it, and the choices you have. We are committed to protecting your privacy.",
      sections: [
        {
          heading: "1. Information We Collect",
          body: [
            "We collect information you provide when you place an order or create an account: your name, email, phone number, shipping address and order details. We also collect basic technical data such as your IP address and browser type.",
          ],
        },
        {
          heading: "2. How We Use Your Information",
          body: [
            "We use your information to process and deliver orders, provide customer support, send order updates, prevent fraud, and — with your consent — send marketing communications.",
          ],
        },
        {
          heading: "3. Payment Processing",
          body: [
            "Card and wallet payments are processed by Paymob, a PCI-DSS compliant payment provider. Your full card details are entered on Paymob's secure systems and are not stored by ROMZ.",
          ],
        },
        {
          heading: "4. Sharing Your Information",
          body: [
            "We share information only as needed to run our business: with delivery couriers to fulfil your order, with Paymob to process payment, and where required by law. We do not sell your personal data.",
          ],
        },
        {
          heading: "5. Cookies",
          body: [
            "We use cookies and similar technologies to keep your cart, remember preferences and understand how the site is used. You can control cookies through your browser settings.",
          ],
        },
        {
          heading: "6. Data Security",
          body: [
            "We use appropriate technical and organizational measures to protect your data. However, no method of transmission over the internet is 100% secure.",
          ],
        },
        {
          heading: "7. Data Retention",
          body: [
            "We keep your personal data for as long as needed to fulfil orders and meet legal, accounting or reporting requirements.",
          ],
        },
        {
          heading: "8. Your Rights",
          body: [
            `You may request access to, correction of, or deletion of your personal data. To exercise these rights, contact us at ${email}.`,
          ],
        },
        {
          heading: "9. Children's Privacy",
          body: [
            "Our website is not directed at children under 18, and we do not knowingly collect their personal data.",
          ],
        },
        {
          heading: "10. Changes to This Policy",
          body: [
            "We may update this Privacy Policy from time to time. The latest version will always be available on this page.",
          ],
        },
        {
          heading: "11. Contact",
          body: [
            `For privacy questions, email ${email} or call ${phone}.`,
          ],
        },
      ],
    },
    ar: {
      title: "سياسة الخصوصية",
      updatedLabel: "آخر تحديث",
      updated: UPDATED.ar,
      intro:
        "سياسة الخصوصية دي بتوضّح البيانات اللي رومز بتجمعها، وإزاي بنستخدمها، والاختيارات المتاحة ليك. إحنا ملتزمين بحماية خصوصيتك.",
      sections: [
        {
          heading: "١. البيانات اللي بنجمعها",
          body: [
            "بنجمع البيانات اللي بتقدّمها وقت عمل الطلب أو إنشاء حساب: اسمك، الإيميل، رقم التليفون، عنوان الشحن وتفاصيل الطلب. وبنجمع كمان بيانات تقنية أساسية زي عنوان الـIP ونوع المتصفح.",
          ],
        },
        {
          heading: "٢. إزاي بنستخدم بياناتك",
          body: [
            "بنستخدم بياناتك لتنفيذ وتوصيل الطلبات، وتقديم الدعم، وإرسال تحديثات الطلب، ومنع الاحتيال، و— بموافقتك — إرسال رسائل تسويقية.",
          ],
        },
        {
          heading: "٣. معالجة المدفوعات",
          body: [
            "مدفوعات الكروت والمحافظ بتتم من خلال Paymob، مزوّد دفع متوافق مع معيار PCI-DSS. بيانات كارتك الكاملة بتتدخل على أنظمة Paymob الآمنة ومبتتخزّنش عند رومز.",
          ],
        },
        {
          heading: "٤. مشاركة بياناتك",
          body: [
            "بنشارك البيانات بس بالقدر اللازم لتشغيل نشاطنا: مع شركات الشحن لتوصيل طلبك، ومع Paymob لمعالجة الدفع، وحيثما يتطلب القانون. إحنا مبنبيعش بياناتك الشخصية.",
          ],
        },
        {
          heading: "٥. ملفات الكوكيز",
          body: [
            "بنستخدم الكوكيز وتقنيات مشابهة للحفاظ على السلة، وتذكّر تفضيلاتك، وفهم طريقة استخدام الموقع. تقدر تتحكم في الكوكيز من إعدادات متصفحك.",
          ],
        },
        {
          heading: "٦. أمان البيانات",
          body: [
            "بنستخدم إجراءات تقنية وتنظيمية مناسبة لحماية بياناتك. لكن، مفيش أي وسيلة نقل عبر الإنترنت آمنة ١٠٠٪.",
          ],
        },
        {
          heading: "٧. الاحتفاظ بالبيانات",
          body: [
            "بنحتفظ ببياناتك الشخصية للمدة اللازمة لتنفيذ الطلبات والوفاء بالمتطلبات القانونية والمحاسبية.",
          ],
        },
        {
          heading: "٨. حقوقك",
          body: [
            `تقدر تطلب الاطّلاع على بياناتك الشخصية أو تصحيحها أو حذفها. لممارسة الحقوق دي، تواصل معانا على ${email}.`,
          ],
        },
        {
          heading: "٩. خصوصية الأطفال",
          body: [
            "موقعنا مش موجّه للأطفال تحت ١٨ سنة، وإحنا مبنجمعش بياناتهم الشخصية عن قصد.",
          ],
        },
        {
          heading: "١٠. تعديل السياسة",
          body: [
            "ممكن نحدّث سياسة الخصوصية دي من وقت للتاني. أحدث نسخة هتكون دايمًا متاحة على الصفحة دي.",
          ],
        },
        {
          heading: "١١. التواصل",
          body: [
            `لأي استفسار عن الخصوصية، ابعتلنا على ${email} أو اتصل على ${phone}.`,
          ],
        },
      ],
    },
  },

  "shipping-policy": {
    en: {
      title: "Shipping Policy",
      updatedLabel: "Last updated",
      updated: UPDATED.en,
      intro:
        "We deliver across Egypt. Here's everything you need to know about how and when your ROMZ order arrives.",
      sections: [
        {
          heading: "1. Coverage",
          body: [
            "We currently ship to all governorates within the Arab Republic of Egypt.",
          ],
        },
        {
          heading: "2. Processing Time",
          body: [
            "Orders are usually processed and handed to our courier within 1–2 business days after the order is confirmed.",
          ],
        },
        {
          heading: "3. Delivery Times",
          body: [
            "Cairo & Giza: 1–2 working days.",
            "Alexandria & Delta: 2–3 working days.",
            "Upper Egypt & remote areas: 3–5 working days.",
            "These are estimates and may vary during peak periods or due to courier delays.",
          ],
        },
        {
          heading: "4. Order Tracking",
          body: [
            "Once your order ships, you can follow its progress on our Track Order page using your order number and the phone or email you ordered with.",
          ],
        },
        {
          heading: "5. Failed or Delayed Delivery",
          body: [
            "Our courier will attempt delivery and may contact you to arrange a suitable time. If delivery repeatedly fails due to incorrect details or no response, the order may be returned to us.",
          ],
        },
        {
          heading: "6. Contact",
          body: [
            `Questions about your shipment? Contact us at ${email} or ${phone}.`,
          ],
        },
      ],
    },
    ar: {
      title: "سياسة الشحن",
      updatedLabel: "آخر تحديث",
      updated: UPDATED.ar,
      intro:
        "بنوصّل في كل أنحاء مصر. دي كل التفاصيل اللي محتاج تعرفها عن إزاي وإمتى هيوصلك طلب رومز.",
      sections: [
        {
          heading: "١. مناطق التغطية",
          body: [
            "حاليًا بنشحن لكل محافظات جمهورية مصر العربية.",
          ],
        },
        {
          heading: "٢. مدة التجهيز",
          body: [
            "عادةً بنجهّز الطلبات ونسلّمها لشركة الشحن خلال ١–٢ يوم عمل بعد تأكيد الطلب.",
          ],
        },
        {
          heading: "٣. مواعيد التوصيل",
          body: [
            "القاهرة والجيزة: ١–٢ يوم عمل.",
            "الإسكندرية والدلتا: ٢–٣ يوم عمل.",
            "صعيد مصر والمناطق النائية: ٣–٥ يوم عمل.",
            "دي تقديرات وممكن تختلف في أوقات الذروة أو بسبب تأخير شركة الشحن.",
          ],
        },
        {
          heading: "٤. تتبّع الطلب",
          body: [
            "بمجرد ما يتشحن طلبك، تقدر تتابع حالته من صفحة تتبّع الطلب باستخدام رقم الطلب والموبايل أو الإيميل اللي طلبت بيه.",
          ],
        },
        {
          heading: "٥. فشل أو تأخّر التوصيل",
          body: [
            "شركة الشحن هتحاول التوصيل وممكن تتواصل معاك لتحديد وقت مناسب. لو التوصيل فشل أكتر من مرة بسبب بيانات غير صحيحة أو عدم الرد، ممكن يترجع الطلب لينا.",
          ],
        },
        {
          heading: "٦. التواصل",
          body: [
            `عندك سؤال عن الشحنة؟ تواصل معانا على ${email} أو ${phone}.`,
          ],
        },
      ],
    },
  },
};

/**
 * `contact` is the email/phone the admin set under Settings → Contact info;
 * when given, it replaces the SITE_CONTACT placeholders in the policy text.
 */
export function getPolicy(
  key: PolicyKey,
  locale: Locale,
  contact?: { email?: string; phone?: string }
): PolicyContent {
  const policy = POLICIES[key][locale] ?? POLICIES[key].en;
  const realEmail = contact?.email?.trim();
  const realPhone = contact?.phone?.trim();
  if (!realEmail && !realPhone) return policy;

  const fill = (text: string) => {
    let out = text;
    if (realEmail) out = out.split(email).join(realEmail);
    if (realPhone) out = out.split(phone).join(realPhone);
    return out;
  };
  return {
    ...policy,
    intro: policy.intro && fill(policy.intro),
    sections: policy.sections.map((s) => ({ ...s, body: s.body.map(fill) })),
  };
}

/** Localized site contact details for the Contact page and footers. */
export function getContactDetails(locale: Locale) {
  return {
    email,
    phone,
    whatsapp,
    address: address[locale] ?? address.en,
    hours: hours[locale] ?? hours.en,
  };
}
