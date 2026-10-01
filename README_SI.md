# තේ දළු එකතු කිරීමේ POS — ස්ථාපන මාර්ගෝපදේශය

මෙය GitHub Pages මත සත්කාරක කර Firebase Authentication සහ Cloud Firestore සමඟ ක්‍රියාත්මක කළ හැකි මූලික වෙබ් යෙදුමකි. එය සජීවී ව්‍යාපාරයක භාවිතයට පෙර පරීක්ෂණ දත්ත සමඟ පරීක්ෂා කර ආරක්ෂක සැකසුම් සම්පූර්ණ කරන්න.

## ඇතුළත් විශේෂාංග

- සිංහල අතුරුමුහුණත; ජංගම දුරකථන සහ PC සඳහා ප්‍රතිචාරාත්මක සැලසුම
- හිමිකරු සහ දළු එකතු කරන සේවකයා සඳහා login/role පාලනය
- ගොවි ලියාපදිංචිය
- ස්ථාවර කිලෝ මිල භාවිතයෙන් දළු එකතු කිරීම් සහ ස්වයංක්‍රීය ගණනය
- මාසික ගෙවීම්, අත්තිකාරම්, අඩු කිරීම්, ශේෂය
- ගෙවීම් පත්‍රය මුද්‍රණය/PDF
- එකතු කළ දළු, යැවූ දළු සහ ඇස්තමේන්තුගත තොගය
- දිනය අනුව වාර්තා, CSV බාගැනීම (Excel මඟින් විවෘත කළ හැක)
- සෑම ගොවියකුටම වෙනම QR Code එකක් සාදා QR හැඳුනුම්පත මුද්‍රණය කිරීම
- දළු එකතු කිරීමේ පිටුවෙන් කැමරාව භාවිත කර QR Code ස්කෑන් කර ගොවියා තෝරාගැනීම
- PWA manifest සහ app-shell cache

## 1. Firebase ව්‍යාපෘතියක් සකස් කිරීම

1. https://console.firebase.google.com/ වෙත ගොස් නව project එකක් සාදන්න.
2. Project settings → General → Your apps යටතේ Web app එකක් එකතු කරන්න.
3. ලැබෙන Firebase web configuration එක `app.js` හි `firebaseConfig` object එකට ඇතුළත් කරන්න.
4. Authentication → Sign-in method යටතේ **Email/Password** සක්‍රීය කරන්න.
5. Firestore Database එකක් සාදන්න. ව්‍යාපාරයට අදාළ සැබෑ දත්ත සඳහා සුදුසු region එකක් තෝරන්න.
6. Firestore → Rules තුළ `firestore.rules` ගොනුවේ නීති ඇතුළත් කර Publish කරන්න.
7. Authentication → Users තුළ හිමිකරුගේ email/password ගිණුම සාදන්න.
8. Firestore හි `users` collection එක සාදන්න. Document ID එක හිමිකරුගේ Firebase Auth UID විය යුතුය. එහි field එකක් ලෙස `role` = `owner` (string) දමන්න.
9. සේවක ගිණුමක් සාදා එහි UID සඳහා `users/{UID}` document එකක් `role` = `collector` ලෙස සාදන්න. සේවකයන්ට හිමිකරුගේ role එක ලබා නොදෙන්න.
10. පළමු login එකෙන් පසු සැකසුම් පිටුවේ ව්‍යාපාරයේ නම සුරකින්න. කිලෝවක මිල සෑම මාසයක අවසානයේම සැකසුම් පිටුවේ "මාසික දළු මිල" යටතේ ඇතුළත් කරන්න (මිල ඇතුළත් කළ පසු පමණක් මාසික ගෙවීම් ගණනය කළ හැක).

**වැදගත්:** `users` role documents සාදන්න/වෙනස් කරන්න Firebase Console හරහා පමණක් කරන්න. යෙදුමෙන් role වෙනස් කිරීමට ඉඩ නොදෙන්න. Firebase Admin SDK/service account key එක browser code එකට කිසිවිටෙක දමන්න එපා.

## 2. GitHub Pages වෙත ප්‍රකාශ කිරීම

1. GitHub හි නව repository එකක් සාදන්න (උදා: `tea-leaf-pos`).
2. `index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js` සහ `firestore.rules` upload කරන්න. `README_SI.md` ද තබාගන්න.
3. `app.js` හි Firebase configuration නිවැරදිදැයි පරීක්ෂා කරන්න.
4. Repository → Settings → Pages යන්න.
5. Build and deployment යටතේ `Deploy from a branch` තෝරන්න. `main` branch සහ `/(root)` තෝරා Save කරන්න.
6. GitHub ලබාදෙන Pages URL එක විවෘත කර login පරීක්ෂා කරන්න.
7. Firebase Authentication → Settings → Authorized domains යටතේ GitHub Pages domain එක (උදා: `yourname.github.io`) එකතු කරන්න.

## 3. පරිශීලක භූමිකා

- **owner**: ගොවීන් එකතු කිරීම, ස්ථාවර මිල වෙනස් කිරීම, ගෙවීම් සුරැකීම, තොග යැවීම්, වාර්තා.
- **collector**: ගොවීන්ගේ දත්ත බැලීම සහ දළු එකතු කිරීම් සටහන් කිරීම.
- Firestore Rules යනු සැබෑ ආරක්ෂක පාලනයයි; UI එකේ බොත්තම් සඟවා තැබීම පමණක් ආරක්ෂාවක් නොවේ.

## 4. දත්ත ආකෘතිය

- `farmers`: `code`, `name`, `phone`, `address`, `active`, `createdBy`
- `collections`: `date`, `farmerId`, `kg`, `note`, `createdBy` (මිල නැත; මාසය අවසානයේ ගණනය කෙරේ)
- `monthlyPrices/{YYYY-MM}`: `pricePerKg`
- `payments`: `farmerId`, `month` (YYYY-MM), `kg`, `gross`, `advance`, `deductions`, `paidAmount`, `balance`
- `inventory`: `type: dispatch`, `date`, `kg`, `destination`, `note`, `createdBy`
- `settings/main`: `businessName`, `businessPhone`, `businessAddress`
- `users/{Firebase Auth UID}`: `role: owner` හෝ `collector`

## 5. වැදගත් ගිණුම්කරණ සහ ආරක්ෂක සීමා

- මෙය ආරම්භක සංස්කරණයකි. සජීවී ව්‍යාපාරයකට යෙදවීමට පෙර ගෙවීම් ක්‍රියාවලිය, බදු/ගිණුම්කරණ අවශ්‍යතා සහ මුද්‍රණ ආකෘති පරීක්ෂා කරන්න.
- දළු එකතු කිරීමේ ලේඛන වෙනස්/මකා දැමීම Firestore Rules මඟින් අවහිර කර ඇත. වැරදි සටහන් සඳහා හිමිකරුගේ අනුමැතිය සහිත adjustment/void workflow එකක් ඉදිරියේදී එකතු කරන්න.
- මෙම මූලික version එකේ ගෙවීම් document එක farmer+month අනුව unique කිරීම client-side පමණි. එකවර බහු හිමිකරු sessions භාවිත කරන්නේ නම් Cloud Function/transaction සහ server-side unique-key pattern එකක් එක් කරන්න.
- තොග ඉතිරිය එකතු කිරීම් එකතුවෙන් dispatch එකතුව අඩු කර ගණනය කරන ඇස්තමේන්තුවකි. නාස්තිය, තෙතමනය/බර වෙනස්වීම්, return/adjustment සහ භෞතික stock reconciliation තවම ඇතුළත් නොවේ.
- Service worker එක app shell පමණක් cache කරයි. Offline දළු සුරැකීම ඇතුළත් නොවේ; දත්ත සුරැකීමට අන්තර්ජාලය අවශ්‍යය.
- GitHub Pages යනු static hosting පමණි. Cloud database access control, backups, monitoring සහ account security වෙනම සකස් කළ යුතුය.
- `apiKey` වැනි Firebase web config එක සාමාන්‍යයෙන් client-side වේ; එහෙත් Firestore rules සහ Authentication නිවැරදිව සකස් නොකළහොත් දත්ත අනාරක්ෂිත විය හැකිය.
- පළමුව ව්‍යාජ ගොවීන් සහ ව්‍යාජ ගනුදෙනු සමඟ පරීක්ෂා කර පසුව පමණක් සැබෑ දත්ත ඇතුළත් කරන්න.

## 6. QR Code භාවිතය

- ගොවීන් පිටුවේ එක් එක් ගොවියා අසල ඇති `QR / මුද්‍රණය` බොත්තම භාවිතයෙන් QR Code එක බලන්න සහ ගොවි හැඳුනුම්පත මුද්‍රණය කරන්න.
- QR Code එක තුළ ගොවියාගේ පුද්ගලික විස්තර නොව, `TEA-FARMER:` prefix එක සහ Firestore document ID එක පමණක් ඇත.
- දළු එකතු කිරීමේ පිටුවේ `QR Scanner ආරම්භ කරන්න` තෝරා browser camera permission ලබා දෙන්න. ස්කෑන් කිරීම HTTPS URL එකක (GitHub Pages වැනි) ක්‍රියාත්මක කරන්න.
- QR Code සහ camera scanner libraries CDN හරහා load වන බැවින් library load කිරීමට අන්තර්ජාලය අවශ්‍ය වේ.

## 7. ඉදිරි වැඩිදියුණු කිරීම්

- දළු එකතු කිරීමේ receipt number සහ receipt print
- මුදල් ගෙවීමේ partial-payment ledger
- payment history/settlement adjustment audit log
- CSV වලට අමතරව සත්‍ය XLSX සහ PDF reports
- Cloud Function මඟින් මාසික settlement ගණනය සහ duplicate prevention
- automated backups, monitoring, recovery tests
- business-level stock reconciliation සහ expense/profit reports
