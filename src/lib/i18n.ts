export type Locale = "ar" | "en";

/**
 * Every user-facing string lives here so the app can flip between Arabic
 * (RTL, the default) and English without touching a screen.
 */
export const STRINGS = {
  appName: { ar: "Alcode Trips", en: "Alcode Trips" },
  tagline: { ar: "السفر صار سهل", en: "Travel Made Effortless" },
  taglineLine1: { ar: "السفر صار", en: "Travel Made" },
  taglineLine2: { ar: "سهل", en: "Effortless" },
  points: { ar: "نقطة", en: "points" },

  // navigation
  navHome: { ar: "الرئيسية", en: "Home" },
  navTrips: { ar: "رحلاتي", en: "Trips" },
  navDeals: { ar: "العروض", en: "Deals" },
  navMore: { ar: "المزيد", en: "More" },
  navProfile: { ar: "حسابي", en: "Profile" },

  // categories
  trains: { ar: "قطارات", en: "Trains" },
  flights: { ar: "طيران", en: "Flights" },
  boats: { ar: "عبّارات", en: "Boats" },
  bus: { ar: "باصات", en: "Bus" },
  hotels: { ar: "فنادق", en: "Hotels" },
  cars: { ar: "سيارات", en: "Cars" },
  packages: { ar: "باقات", en: "Packages" },
  esim: { ar: "شرائح eSIM", en: "eSIM" },
  // Short form for the home tiles, where the full Arabic label wraps badly.
  esimShort: { ar: "eSIM", en: "eSIM" },
  planner: { ar: "خطة السفر", en: "Trip Planner" },
  assistant: { ar: "المساعد الذكي", en: "AI Assistant" },

  upcomingSchedules: { ar: "رحلاتك القادمة", en: "Upcoming Schedules" },
  recommendations: { ar: "وجهات مقترحة", en: "Recommendations" },
  viewAll: { ar: "عرض الكل", en: "View All" },
  seeDetails: { ar: "التفاصيل", en: "See Details" },
  baggage: { ar: "الأمتعة", en: "Baggage" },

  // search
  findYourBestTrip: { ar: "اعثر على أفضل رحلة", en: "Find Your Best Trip" },
  findLine1: { ar: "اعثر على", en: "Find Your" },
  findLine2: { ar: "أفضل رحلة", en: "Best Trip" },
  oneWay: { ar: "ذهاب فقط", en: "One Way" },
  roundTrip: { ar: "ذهاب وعودة", en: "Round Trip" },
  from: { ar: "من", en: "From" },
  to: { ar: "إلى", en: "To" },
  date: { ar: "التاريخ", en: "Date" },
  durationLabel: { ar: "المدة", en: "Duration" },
  returnDate: { ar: "تاريخ العودة", en: "Return" },
  passenger: { ar: "المسافرون", en: "Passenger" },
  search: { ar: "بحث", en: "Search" },
  vouchers: { ar: "قسائم الخصم", en: "Vouchers" },
  passengers: { ar: "مسافر", en: "Passenger" },
  economy: { ar: "اقتصادية", en: "Economy" },
  business: { ar: "أعمال", en: "Business" },
  first: { ar: "أولى", en: "First" },

  // results
  searchResults: { ar: "نتائج البحث", en: "Search Results" },
  thereAre: { ar: "هناك", en: "There are" },
  resultsFrom: { ar: "نتيجة من", en: "search results from" },
  abilityToReschedule: { ar: "قابلة لتغيير الموعد", en: "Ability to reschedule" },
  perPax: { ar: "للفرد", en: "/pax" },
  sortBy: { ar: "ترتيب", en: "Sort" },
  filter: { ar: "تصفية", en: "Filter" },
  best: { ar: "الأفضل", en: "Best" },
  cheapest: { ar: "الأرخص", en: "Cheapest" },
  fastest: { ar: "الأسرع", en: "Fastest" },
  earliest: { ar: "الأبكر", en: "Earliest" },
  topRated: { ar: "الأعلى تقييماً", en: "Top rated" },
  noResults: { ar: "لا توجد نتائج مطابقة", en: "No matching results" },
  noResultsHint: { ar: "جرّب توسيع التصفية أو تغيير التاريخ.", en: "Try widening the filters or changing the date." },
  direct: { ar: "مباشرة", en: "Direct" },
  stop: { ar: "توقف", en: "stop" },
  stops: { ar: "توقفات", en: "stops" },

  // comparison
  comparePrices: { ar: "مقارنة الأسعار", en: "Price comparison" },
  bestPrice: { ar: "أفضل سعر", en: "Best price" },
  youSave: { ar: "توفّر", en: "You save" },
  sitesCompared: { ar: "موقع تمت مقارنته", en: "sites compared" },
  fees: { ar: "رسوم", en: "fees" },
  noFees: { ar: "بدون رسوم", en: "no fees" },
  freeCancellation: { ar: "إلغاء مجاني", en: "Free cancellation" },
  payLater: { ar: "ادفع لاحقاً", en: "Pay later" },
  bookOn: { ar: "احجز عبر", en: "Book on" },
  total: { ar: "الإجمالي", en: "Total" },

  // booking
  bookNow: { ar: "احجز الآن", en: "Book now" },
  continue: { ar: "متابعة", en: "Continue" },
  confirmBooking: { ar: "تأكيد الحجز", en: "Confirm booking" },
  bookingConfirmed: { ar: "تم تأكيد الحجز", en: "Booking confirmed" },
  downloadTicket: { ar: "تحميل التذكرة", en: "Download Ticket" },
  passengerName: { ar: "اسم المسافر", en: "Passenger Name" },
  gate: { ar: "البوابة", en: "Gate" },
  seat: { ar: "المقعد", en: "Seat" },
  terminal: { ar: "الصالة", en: "Terminal" },
  boardingPass: { ar: "بطاقة الصعود", en: "Boarding pass" },

  // hotels
  checkIn: { ar: "تسجيل الدخول", en: "Check in" },
  checkOut: { ar: "تسجيل الخروج", en: "Check out" },
  nights: { ar: "ليالٍ", en: "nights" },
  night: { ar: "ليلة", en: "night" },
  guests: { ar: "ضيوف", en: "guests" },
  rooms: { ar: "غرف", en: "rooms" },
  perNight: { ar: "لليلة", en: "/night" },
  reviews: { ar: "تقييم", en: "reviews" },
  breakfastIncluded: { ar: "إفطار مشمول", en: "Breakfast included" },
  fromCentre: { ar: "من المركز", en: "from centre" },

  // cars
  perDay: { ar: "لليوم", en: "/day" },
  seats: { ar: "مقاعد", en: "seats" },
  bags: { ar: "حقائب", en: "bags" },
  automatic: { ar: "أوتوماتيك", en: "Automatic" },
  manual: { ar: "عادي", en: "Manual" },
  unlimitedKm: { ar: "كيلومترات غير محدودة", en: "Unlimited km" },
  catAll: { ar: "الكل", en: "All" },
  catEconomy: { ar: "اقتصادية", en: "Economy" },
  catSuv: { ar: "دفع رباعي", en: "SUV" },
  catLuxury: { ar: "فاخرة", en: "Luxury" },
  catVan: { ar: "عائلية", en: "Van" },
  pickUp: { ar: "مكان الاستلام", en: "Pick-up" },
  days: { ar: "أيام", en: "days" },

  // packages
  includes: { ar: "يشمل", en: "Includes" },
  save: { ar: "وفّر", en: "Save" },

  // esim
  esimTitle: { ar: "شرائح إنترنت دولية", en: "International eSIM" },
  esimSub: { ar: "إنترنت فور وصولك — بدون شريحة فعلية", en: "Data the moment you land — no physical SIM" },
  selectCountry: { ar: "اختر الدولة", en: "Select a country" },
  searchCountry: { ar: "ابحث عن دولة", en: "Search a country" },
  data: { ar: "بيانات", en: "Data" },
  validity: { ar: "الصلاحية", en: "Validity" },
  unlimited: { ar: "غير محدود", en: "Unlimited" },
  hotspot: { ar: "نقطة اتصال", en: "Hotspot" },
  calls: { ar: "مكالمات", en: "Calls" },
  perGb: { ar: "للجيجابايت", en: "per GB" },
  buyEsim: { ar: "شراء الشريحة", en: "Buy eSIM" },
  esimHowTitle: { ar: "كيف تعمل؟", en: "How it works" },
  esimStep1: { ar: "اختر الدولة والباقة", en: "Pick your country and plan" },
  esimStep2: { ar: "ادفع واستلم رمز QR", en: "Pay and get a QR code" },
  esimStep3: { ar: "امسح الرمز وفعّل الإنترنت", en: "Scan it and you are online" },

  // planner
  plannerTitle: { ar: "خطة السفر بالذكاء الاصطناعي", en: "AI Trip Planner" },
  plannerSub: { ar: "خطة يوماً بيوم مبنية على أسعار حقيقية وضمن ميزانيتك", en: "A day-by-day plan built from real prices, inside your budget" },
  destination: { ar: "الوجهة", en: "Destination" },
  budget: { ar: "الميزانية", en: "Budget" },
  travellers: { ar: "المسافرون", en: "Travellers" },
  interests: { ar: "الاهتمامات", en: "Interests" },
  generatePlan: { ar: "أنشئ الخطة", en: "Generate plan" },
  regenerate: { ar: "أعد الإنشاء", en: "Regenerate" },
  savePlan: { ar: "حفظ الخطة", en: "Save plan" },
  planSaved: { ar: "تم حفظ الخطة", en: "Plan saved" },
  day: { ar: "اليوم", en: "Day" },
  estimatedTotal: { ar: "التكلفة التقديرية", en: "Estimated total" },
  withinBudget: { ar: "ضمن الميزانية", en: "Within budget" },
  overBudget: { ar: "يتجاوز الميزانية", en: "Over budget" },
  building: { ar: "جارٍ بناء الخطة…", en: "Building your plan…" },

  // interests
  intCulture: { ar: "ثقافة", en: "Culture" },
  intFood: { ar: "طعام", en: "Food" },
  intNature: { ar: "طبيعة", en: "Nature" },
  intShopping: { ar: "تسوق", en: "Shopping" },
  intNightlife: { ar: "حياة ليلية", en: "Nightlife" },
  intFamily: { ar: "عائلي", en: "Family" },
  intAdventure: { ar: "مغامرة", en: "Adventure" },
  intRelax: { ar: "استرخاء", en: "Relax" },

  // assistant
  assistantGreeting: {
    ar: "أهلاً! أنا مساعد Alcode. اسألني عن أرخص رحلة، أو خطة سفر، أو أفضل باقة إنترنت لوجهتك.",
    en: "Hi! I'm the Alcode assistant. Ask me for the cheapest route, a trip plan, or the best data plan for your destination.",
  },
  askAnything: { ar: "اسأل عن أي شيء…", en: "Ask me anything…" },
  send: { ar: "إرسال", en: "Send" },
  onDevice: { ar: "محلي على الجهاز", en: "On-device" },
  liveModel: { ar: "نموذج مباشر", en: "Live model" },

  // trips / bookings
  myTrips: { ar: "رحلاتي", en: "My Trips" },
  upcoming: { ar: "قادمة", en: "Upcoming" },
  completed: { ar: "منتهية", en: "Completed" },
  plans: { ar: "الخطط", en: "Plans" },
  noBookings: { ar: "لا توجد حجوزات بعد", en: "No bookings yet" },
  noBookingsHint: { ar: "ابدأ بالبحث عن رحلتك القادمة.", en: "Start by searching your next trip." },
  noPlans: { ar: "لا توجد خطط محفوظة", en: "No saved plans" },

  // profile
  profile: { ar: "الملف الشخصي", en: "Profile" },
  editProfile: { ar: "تعديل الملف", en: "Edit profile" },
  memberSince: { ar: "عضو منذ", en: "Member since" },
  language: { ar: "اللغة", en: "Language" },
  currency: { ar: "العملة", en: "Currency" },
  savedTravellers: { ar: "المسافرون المحفوظون", en: "Saved travellers" },
  paymentMethods: { ar: "طرق الدفع", en: "Payment methods" },
  notifications: { ar: "الإشعارات", en: "Notifications" },
  priceAlerts: { ar: "تنبيهات الأسعار", en: "Price alerts" },
  favourites: { ar: "المفضّلة", en: "Favourites" },
  help: { ar: "المساعدة والدعم", en: "Help & support" },
  about: { ar: "عن التطبيق", en: "About" },
  signOut: { ar: "تسجيل الخروج", en: "Sign out" },
  loyaltyTier: { ar: "المستوى", en: "Tier" },
  pointsToNext: { ar: "نقطة للمستوى التالي", en: "points to next tier" },

  // misc
  search_: { ar: "بحث", en: "Search" },
  saved: { ar: "محفوظ", en: "Saved" },
  addedToFavourites: { ar: "أُضيف إلى المفضلة", en: "Added to favourites" },
  removedFromFavourites: { ar: "أُزيل من المفضلة", en: "Removed from favourites" },
  demoDataTitle: { ar: "أسعار تجريبية", en: "Demo prices" },
  demoDataBody: {
    ar: "لم تُضبط مفاتيح شركاء الحجز بعد، لذا الأسعار من كتالوج تجريبي مدمج. أضف مفاتيح الشركاء لتفعيل الأسعار الحقيقية.",
    en: "No partner API keys are configured, so prices come from the bundled demo catalogue. Add partner keys to switch to live fares.",
  },
  liveDataTitle: { ar: "أسعار مباشرة", en: "Live prices" },
  back: { ar: "رجوع", en: "Back" },
  close: { ar: "إغلاق", en: "Close" },
  apply: { ar: "تطبيق", en: "Apply" },
  reset: { ar: "إعادة ضبط", en: "Reset" },
  maxPrice: { ar: "أقصى سعر", en: "Max price" },
  cabinClass: { ar: "الدرجة", en: "Cabin" },
  share: { ar: "مشاركة", en: "Share" },
  copied: { ar: "تم النسخ", en: "Copied" },
} as const;

export type StringKey = keyof typeof STRINGS;

export const t = (key: StringKey, locale: Locale): string => STRINGS[key][locale];
