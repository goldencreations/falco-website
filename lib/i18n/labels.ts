import type { AppLanguage } from "@/lib/preferences";

/** Translate a UI label; English keys pass through when no Swahili entry exists. */
export function tLabel(label: string, language: AppLanguage): string {
 if (language === "en") return label;
 return SWAHILI[label] ?? label;
}

const SWAHILI: Record<string, string> = {
 // Portal chrome
 "Falco Financial": "Falco Financial",
 "Loan Management System": "Mfumo wa Usimamizi wa Mikopo",
 "Falco Manager Portal": "Portal ya Meneja — Falco",
 "Falco Officer Portal": "Portal ya Afisa Mikopo — Falco",
 "Falco Finance Portal": "Portal ya Fedha — Falco",
 Logout: "Toka",
 Reconciliation: "Upatanisho",
 Disbursements: "Ugavi",
 Accountant: "Mhasibu",
 "Finance Controls": "Udhibiti wa Fedha",

 // Nav groups
 Main: "Kuu",
 "Loan Management": "Usimamizi wa Mikopo",
 "Credit Analysis": "Uchambuzi wa Mkopo",
 Collections: "Ukusanyaji",
 "Reports & Admin": "Ripoti na Utawala",
 Staff: "Wafanyakazi",

 // Nav items
 Dashboard: "Dashibodi",
 Customers: "Wateja",
 Leads: "Wateja Wanaowezekana",
 Branches: "Matawi",
 "Loan Applications": "Maombi ya Mikopo",
 "All Applications": "Maombi Yote",
 "New Application": "Ombi Jipya",
 "Pending Review": "Inasubiri Mapitio",
 "Active Loans": "Mikopo Inayoendelea",
 "Loan Disbursement": "Ugavi wa Mikopo",
 "Vikundi / Group Loans": "Vikundi / Mikopo ya Kikundi",
 "Credit Analysis": "Uchambuzi wa Mkopo",
 "Loan Calculator": "Kikokotoo cha Mkopo",
 Payments: "Malipo",
 Reports: "Ripoti",
 "Loan Products": "Bidhaa za Mikopo",
 "Staff Management": "Usimamizi wa Wafanyakazi",
 Backup: "Hifadhi Nakala",
 Settings: "Mipangilio",
 "Team & assignments": "Timu na Ugavi",
 "Team & Assignment": "Timu na Ugavi",

 // Settings page
 "Account & preferences": "Akaunti na mapendeleo",
 "Change Password": "Badilisha Nenosiri",
 "Current Password": "Nenosiri la Sasa",
 "New Password": "Nenosiri Jipya",
 "Confirm Password": "Thibitisha Nenosiri",
 "Update Password": "Sasisha Nenosiri",
 "Language & personal alerts": "Lugha na arifa za kibinafsi",
 Language: "Lugha",
 English: "Kiingereza",
 Kiswahili: "Kiswahili",
 "Save Preferences": "Hifadhi Mapendeleo",
 "Email security alerts": "Arifa za usalama kwa barua pepe",
 "Auto-lock inactive sessions": "Funga kipindi baada ya kutokuwa hai",
 Profile: "Wasifu",
 Role: "Jukumu",
 "Employee ID": "Nambari ya Mfanyakazi",
 Branch: "Tawi",
 Phone: "Simu",
 Status: "Hali",
 Active: "Hai",
 "Branch manager": "Meneja wa Tawi",
 "Loan officer": "Afisa Mikopo",
 "Super admin": "Msimamizi Mkuu",
 "Manager Controls": "Vidhibiti vya Meneja",
 "Loan Officer Controls": "Vidhibiti vya Afisa Mikopo",
 "Super Admin Controls": "Vidhibiti vya Msimamizi Mkuu",
 Loading: "Inapakia…",
 "Loading settings…": "Inapakia mipangilio…",
 "Sign in required": "Ingia kwanza",
};

export const SETTINGS_COPY = {
 en: {
 headerTitle: "Settings",
 headerLoading: "Loading…",
 accountPrefs: "Account & preferences",
 passwordSection: "Change Password",
 languageSection: "Language & personal alerts",
 savePrefs: "Save Preferences",
 prefsSaved: "Preferences saved successfully.",
 passwordUpdated: "Password updated. Use the new password at your next login.",
 managerDesc:
 "Branch manager account — password and language are saved to your profile on the server.",
 adminDesc:
 "Super admin account — password and language are saved to your profile on the server.",
 officerDesc:
 "Loan officer account — password and language are saved to your profile on the server.",
 accountantDesc:
 "Accountant account — password and language are saved to your profile on the server.",
 defaultDesc: "Account, security, and preferences",
 },
 sw: {
 headerTitle: "Mipangilio",
 headerLoading: "Inapakia…",
 accountPrefs: "Akaunti na mapendeleo",
 passwordSection: "Badilisha Nenosiri",
 languageSection: "Lugha na arifa za kibinafsi",
 savePrefs: "Hifadhi Mapendeleo",
 prefsSaved: "Mipangilio imehifadhiwa kwa mafanikio.",
 passwordUpdated: "Nenosiri limesasishwa. Tumia nenosiri jipya unapoingia tena.",
 managerDesc:
 "Akaunti ya meneja wa tawi — nenosiri na lugha huhifadhiwa kwenye wasifu wako kwenye seva.",
 adminDesc:
 "Akaunti ya msimamizi mkuu — nenosiri na lugha huhifadhiwa kwenye wasifu wako kwenye seva.",
 officerDesc:
 "Akaunti ya afisa mikopo — nenosiri na lugha huhifadhiwa kwenye wasifu wako kwenye seva.",
 accountantDesc:
 "Akaunti ya mhasibu — nenosiri na lugha huhifadhiwa kwenye wasifu wako kwenye seva.",
 defaultDesc: "Akaunti, usalama, na mapendeleo",
 },
} as const;

export function settingsCopy(language: AppLanguage) {
 return SETTINGS_COPY[language];
}
