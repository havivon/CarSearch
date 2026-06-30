# CarSearch 🚗 — מצרף מודעות רכב

אתר שמרכז מודעות רכב יד-שנייה ממספר אתרים ישראליים (יד2, WinWin, Facebook
Marketplace ועוד) לחיפוש אחד. מזינים מאפיינים — יצרן, דגם, טווח שנים, טווח מחיר,
ק"מ, יד, אזור — ומקבלים מודעות מכל המקורות יחד, מאוחדות וממוינות.

## הרצה

```bash
npm install      # אופציונלי — רק עבור מנוע הדפדפן (Playwright) למודעות חיות
npm start        # מריץ את השרת על http://localhost:3000
# הליבה רצה גם ללא התקנה: node server.js
```

פתחו את הדפדפן בכתובת `http://localhost:3000`, מלאו מאפיינים ולחצו **חפש**.
לחצן **🩺 בדוק חיבור למקורות** מציג אבחון חי: לאיזה מקור יש גישה, האם הוא חסום,
והאם מנוע הדפדפן זמין.

## ארכיטקטורה

```
server.js              שרת HTTP (מודול node מובנה) — מגיש UI + /api/search + /api/health
src/
  config.js            קונפיגורציה מ-env: מצב חי, בחירת מנוע, timeouts, פרוקסי, נתיב Chromium
  aggregator.js        מריץ את כל הספקים במקביל, מאחד, מסיר כפילויות, ממיין + checkHealth
  normalize.js         סכמת מודעה אחידה + סינון/דדופ/מיון
  sampleData.js        מאגר דוגמאות ריאליסטי (גיבוי כשמקור חי חסום)
  providers/
    http.js            עוזר fetch מודע-פרוקסי + probe לאבחון נגישות
    browser.js         מנוע Playwright (Chromium אמיתי) — הדרך לעקוף אנטי-בוט
    yad2.js            משיכה חיה: מנוע http או browser, פרסור feed/__NEXT_DATA__, נפילה לדוגמאות
    winwin.js          WinWin
    facebook.js        Facebook Marketplace
    auto.js            Auto.co.il (דוגמה להוספת מקור)
public/                ממשק משתמש בעברית (RTL): index.html, styles.css, app.js
```

### הוספת מקור חדש

מממשים אובייקט ספק עם `search(criteria)` שמחזיר את המעטפה הסטנדרטית
(`{ id, name, live, status, message, listings }`) ומוסיפים אותו ל-`PROVIDERS`
ב-`src/aggregator.js`. זהו.

## מודעות חיות — מה צריך כדי שזה יעבוד

הקוד למשיכה חיה **ממומש ובדוק**. שני דברים קובעים אם יחזרו מודעות אמיתיות:
גישת רשת ליעד, ומנוע שמתגבר על אנטי-בוט.

### 1. גישת רשת (החסם המרכזי בסביבת הענן)

בסביבת ההרצה של Claude Code on the web, התעבורה היוצאת עוברת דרך פרוקסי שאוכף
**מדיניות רשת**. הדומיינים `yad2.co.il`, `winwin.co.il`, `facebook.com`
ו-`auto.co.il` אינם ברשימת ההיתר כברירת מחדל, ולכן הפרוקסי מחזיר `403` על ה-CONNECT
(נראה כ-`ERR_TUNNEL_CONNECTION_FAILED`). זו חסימה מכוונת ברמת הסביבה — **שום קוד לא
יכול לעקוף אותה**. לחצן "בדוק חיבור" יסמן מצב זה כ-`policy_blocked`.

כדי לאפשר מודעות חיות, בחרו אחת:

- **הרצה מקומית** על המחשב שלכם (`node server.js`) — אין פרוקסי, הגישה פתוחה.
- **סביבת web עם מדיניות רשת מתירה** — צרו סביבה שמתירה את הדומיינים הנ"ל.
  ראו: https://code.claude.com/docs/en/claude-code-on-the-web (הגדרות רשת/Network).

### 2. מנוע משיכה (מתגבר על אנטי-בוט)

- **מנוע `http`** — פונה ישירות ל-`gw.yad2.co.il` (JSON). מהיר, אך הגנת PerimeterX
  של יד2 חוסמת לרוב בקשות שרת ב-`403`.
- **מנוע `browser`** — מריץ Chromium אמיתי (Playwright), שמבצע את אתגר האנטי-בוט,
  ואז קורא את ה-`__NEXT_DATA__` או את ה-DOM. זו הדרך הנכונה לפרודקשן.
  Chromium כבר מותקן (`/opt/pw-browsers`); הקוד מזהה אותו אוטומטית.

ברירת המחדל `YAD2_ENGINE=auto` בוחרת `browser` אם חבילת Playwright מותקנת, אחרת `http`.

### משתני סביבה

| משתנה | ברירת מחדל | תיאור |
|-------|-----------|-------|
| `PORT` | `3000` | פורט השרת |
| `LIVE` | `true` | מתג ראשי למשיכה חיה |
| `LIVE_YAD2` / `LIVE_WINWIN` / `LIVE_AUTO` | כמו `LIVE` | מצב חי לכל מקור |
| `LIVE_FACEBOOK` | `false` | דורש התחברות — כבוי כברירת מחדל |
| `YAD2_ENGINE` | `auto` | `http` \| `browser` \| `auto` |
| `CHROMIUM_PATH` | זיהוי אוטומטי | נתיב מפורש ל-Chromium |
| `HTTP_TIMEOUT_MS` | `9000` | timeout למנוע http |
| `BROWSER_TIMEOUT_MS` | `25000` | timeout למנוע הדפדפן |
| `USER_AGENT` | Chrome | User-Agent לבקשות |

דוגמה להרצה מקומית עם מנוע דפדפן:

```bash
npm install
YAD2_ENGINE=browser node server.js
```

### מצב המקורות

- **יד2** — משיכה חיה מלאה (http + browser), כולל פרסור feed ו-`__NEXT_DATA__`.
- **WinWin / Auto.co.il** — אין API ציבורי; נדרש פרסר HTML ייעודי (תשתית המנוע מוכנה,
  הפרסר הספציפי הוא הצעד הבא). כרגע מגישים דוגמאות מסומנות.
- **Facebook Marketplace** — דורש התחברות; נדרש Graph API עם הרשאות או דפדפן מחובר.

כל מודעה מסומנת בבירור **חי** (ירוק) או **דוגמה** (כתום), וכל מקור מציג סטטוס
(חי / דוגמה / חסום / דורש התחברות) — כך שתמיד ברור מה אמיתי ומה לא.

### הצעדים הבאים להרחבה

1. פרסרי HTML ל-WinWin/Auto דרך מנוע הדפדפן הקיים (`browser.js` + `withPage`).
2. Facebook Graph API עם token והרשאות, או אינטגרציה דרך חשבון מחובר.
3. **Caching** (למשל Redis) כדי לכבד rate limits ולא להציף את המקורות.
4. ניטור תקופתי לשינויי מבנה ב-`__NEXT_DATA__` / ב-selectors.

> שימו לב לתנאי השימוש ול-robots.txt של כל אתר לפני משיכה אוטומטית בפרודקשן.
