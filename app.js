(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const faNum = n => new Intl.NumberFormat('fa-IR',{useGrouping:false}).format(n);

  const KEYS = {
    tasks: 'loki_pwa_tasks_v1',
    routines: 'loki_pwa_routines_v1',
    settings: 'loki_pwa_settings_v1'
  };

  const REMINDER_KEY = 'loki_pwa_fired_reminders_v1';

  const weekdaysFa = ['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
  const weekdaysEn = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthsFa = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const monthsEn = ['Farvardin','Ordibehesht','Khordad','Tir','Mordad','Shahrivar','Mehr','Aban','Azar','Dey','Bahman','Esfand'];
  const daysFa = ['ش','ی','د','س','چ','پ','ج'];
  const daysEn = ['Sat','Sun','Mon','Tue','Wed','Thu','Fri'];

  const labels = {
    fa: {
      personalAssistant:'دستیار شخصی تو',
      workspace:'فضای کاری',
      dashboard:'داشبورد',
      tasks:'کارها',
      routines:'روتین‌ها',
      calendar:'تقویم شمسی',
      assistant:'دستیار آیرون‌من',
      settings:'تنظیمات',
      localStorage:'ذخیره‌سازی محلی فعال',
      yourWorkspace:'فضای شخصی شما',
      newTask:'کار جدید',
      footer:'ساخته‌شده برای نظم بیشتر، قدم‌به‌قدم.',
      title:'عنوان',
      notes:'توضیحات',
      category:'دسته‌بندی',
      priority:'اولویت',
      date:'تاریخ (شمسی)',
      time:'ساعت',
      repeat:'تکرار',
      confirmCompletion:'برای این روتین تأیید انجام‌شدن هم داشته باش',
      monthDay:'روز ماه (شمسی)',
      cancel:'انصراف',
      save:'ذخیره'
    },
    en: {
      personalAssistant:'Your personal assistant',
      workspace:'WORKSPACE',
      dashboard:'Dashboard',
      tasks:'Tasks',
      routines:'Routines',
      calendar:'Persian calendar',
      assistant:'Iron Man Assistant',
      settings:'Settings',
      localStorage:'Local storage active',
      yourWorkspace:'Your workspace',
      newTask:'New task',
      footer:'Built for better focus, one step at a time.',
      title:'Title',
      notes:'Notes',
      category:'Category',
      priority:'Priority',
      date:'Date',
      time:'Time',
      repeat:'Repeat',
      confirmCompletion:'Allow completion confirmation for this routine',
      monthDay:'Day of month (Jalali)',
      cancel:'Cancel',
      save:'Save'
    }
  };

  const CHARACTERS = [
    {id:'spiderman',fa:'اسپایدرمن',en:'Spider-Man'},
    {id:'ironman',fa:'آیرون‌من',en:'Iron Man'},
    {id:'thor',fa:'ثور',en:'Thor'},
    {id:'hulk',fa:'هالک',en:'Hulk'},
    {id:'captain',fa:'کاپیتان آمریکا',en:'Captain America'},
    {id:'panther',fa:'پلنگ سیاه',en:'Black Panther'},
    {id:'scarlet',fa:'اسکارلت ویچ',en:'Scarlet Witch'}
  ];

  const CATS = ['personal','study','work','health'];
  const PRIOS = ['normal','high','urgent'];
  const REPEATS = ['daily','weekdays','weekly','monthly'];

  const savedSettings = read(KEYS.settings, {});
  let settings = {
    theme: 'dark',
    language: 'fa',
    character: 'ironman',
    ...(savedSettings && typeof savedSettings==='object' ? savedSettings : {})
  };
  if (!['fa','en'].includes(settings.language)) settings.language = 'fa';
  if (!['dark','light'].includes(settings.theme)) settings.theme = 'dark';
  if (settings.character === 'loki') settings.character = 'ironman';
  if (!CHARACTERS.some(c=>c.id===settings.character)) settings.character = 'ironman';

  let tasks = sanitizeList(read(KEYS.tasks, []), sanitizeTask);
  let routines = sanitizeList(read(KEYS.routines, []), sanitizeRoutine);

  let page = 'dashboard';
  let selectedDate = dateKey(new Date());
  let monthCursor = new Date();
  let calendarView = 'month';
  let toastTimer;
  let taskQuery = '';
  let taskStatus = 'all';
  const reminderInFlight = new Set();

  const text = (faText, enText) =>
    settings.language === 'fa' ? faText : enText;

  function read(k, fallback) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function persist() {
    try {
      localStorage.setItem(KEYS.tasks, JSON.stringify(tasks));
      localStorage.setItem(KEYS.routines, JSON.stringify(routines));
      localStorage.setItem(KEYS.settings, JSON.stringify(settings));
    } catch (error) {
      console.error('Iron Man could not save data:', error);
      showToast(text(
        'ذخیره‌سازی انجام نشد؛ حافظه مرورگر پر یا مسدود است.',
        'Could not save: browser storage is full or blocked.'
      ));
    }
  }

  function cleanId(v) {
    const id = String(v ?? '');
    return /^[\w.-]{1,80}$/.test(id) ? id : uid();
  }

  function isDateKey(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    return dateKey(parseKey(v)) === v;
  }

  function isTimeValue(v) {
    return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  }

  function sanitizeTask(t) {
    if (!t || typeof t !== 'object') return null;

    const title = String(t.title ?? '').trim().slice(0, 90);
    if (!title) return null;

    return {
      id: cleanId(t.id),
      title,
      notes: String(t.notes ?? '').slice(0, 2000),
      category: CATS.includes(t.category) ? t.category : 'personal',
      priority: PRIOS.includes(t.priority) ? t.priority : 'normal',
      date: isDateKey(t.date) ? t.date : '',
      time: isTimeValue(t.time) ? t.time : '',
      done: !!t.done,
      createdAt: Number(t.createdAt) || Date.now()
    };
  }

  function sanitizeRoutine(r) {
    if (!r || typeof r !== 'object') return null;

    const title = String(r.title ?? '').trim().slice(0, 90);
    if (!title) return null;

    const weekdays = Array.isArray(r.weekdays)
      ? [...new Set(r.weekdays.map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<=6))]
      : [];

    const weekday = Number(r.weekday);
    const monthDay = Number(r.monthDay);

    return {
      id: cleanId(r.id),
      title,
      notes: String(r.notes ?? '').slice(0, 2000),
      category: CATS.includes(r.category) ? r.category : 'personal',
      time: isTimeValue(r.time) ? r.time : '09:00',
      repeat: REPEATS.includes(r.repeat) ? r.repeat : 'daily',
      weekdays,
      weekday: Number.isInteger(weekday)&&weekday>=0&&weekday<=6 ? weekday : new Date().getDay(),
      monthDay: Number.isInteger(monthDay)&&monthDay>=1&&monthDay<=31 ? monthDay : 1,
      confirm: !!r.confirm,
      enabled: r.enabled !== false,
      createdAt: Number(r.createdAt) || Date.now()
    };
  }

  function sanitizeList(list, fn) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();

    return list.map(fn).filter(x=>{
      if (!x || seen.has(x.id)) return false;
      seen.add(x.id);
      return true;
    });
  }

  function uid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2);
  }

  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function parseKey(k) {
    if (!k) return null;
    const [y,m,d] = k.split('-').map(Number);
    return new Date(y,m-1,d,12);
  }

  const jalaliBreaks = [
    -61,9,38,199,426,686,756,818,1111,1181,
    1210,1635,2060,2097,2192,2262,2324,2394,2456,3178
  ];

  const div = (a,b) => Math.floor(a/b);
  const mod = (a,b) => a - Math.floor(a/b)*b;

  function jalaliCalendar(jy) {
    const bl = jalaliBreaks.length;

    if (jy < jalaliBreaks[0] || jy >= jalaliBreaks[bl-1]) {
      throw new RangeError('Jalali year out of supported range');
    }

    let gy = jy + 621;
    let leapJ = -14;
    let jp = jalaliBreaks[0];
    let jump = 0;

    for (let i=1; i<bl; i++) {
      const jm = jalaliBreaks[i];
      jump = jm-jp;

      if (jy < jm) break;

      leapJ += div(jump,33)*8 + div(mod(jump,33),4);
      jp = jm;
    }

    let n = jy-jp;

    leapJ += div(n,33)*8 + div(mod(n,33)+3,4);

    if (mod(jump,33)===4 && jump-n===4) leapJ++;

    const leapG = div(gy,4)-div((div(gy,100)+1)*3,4)-150;
    const march = 20+leapJ-leapG;

    if (jump-n<6) {
      n = n-jump+div(jump+4,33)*33;
    }

    let leap = mod(mod(n+1,33)-1,4);

    if (leap===-1) leap=4;

    return {leap,gy,march};
  }

  function gregorianJdn(gy,gm,gd) {
    return Math.floor(Date.UTC(gy,gm-1,gd)/86400000)+2440588;
  }

  function jalaliJdn(jy,jm,jd) {
    const c = jalaliCalendar(jy);

    return gregorianJdn(c.gy,3,c.march)
      +(jm-1)*31-div(jm,7)*(jm-7)+jd-1;
  }

  function jalaliParts(date) {
    const jdn = Math.floor(
      Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000
    )+2440588;

    const utc = new Date((jdn-2440588)*86400000);
    let gy = utc.getUTCFullYear();
    let jy = gy-621;
    let c = jalaliCalendar(jy);

    let k = jdn-gregorianJdn(gy,3,c.march);

    if (k<0) {
      jy--;
      c = jalaliCalendar(jy);
      k = jdn-gregorianJdn(gy-1,3,c.march);
    }

    let month,day;

    if (k<=185) {
      month = 1+div(k,31);
      day = mod(k,31)+1;
    } else {
      k -= 186;
      month = 7+div(k,30);
      day = mod(k,30)+1;
    }

    return {year:jy,month,day};
  }

  function jalaliKey(date) {
    const p = jalaliParts(date);

    return `${p.year}/${String(p.month).padStart(2,'0')}/${String(p.day).padStart(2,'0')}`;
  }

  function jalaliLabel(date,withDay=true) {
    const p = jalaliParts(date);

    const month = settings.language==='fa'
      ? monthsFa[p.month-1]
      : monthsEn[p.month-1];

    const day = settings.language==='fa'
      ? faNum(p.day)
      : String(p.day);

    const year = settings.language==='fa'
      ? faNum(p.year)
      : String(p.year);

    const weekday = settings.language==='fa'
      ? weekdaysFa[date.getDay()]
      : weekdaysEn[date.getDay()];

    return `${withDay?weekday+' ':''}${day} ${month} ${year}`;
  }

  function fromJalali(y,m,d) {
    if (
      !Number.isInteger(y) ||
      !Number.isInteger(m) ||
      !Number.isInteger(d) ||
      m<1 ||
      m>12 ||
      d<1 ||
      d>(m<=6?31:m<=11?30:(jalaliCalendar(y).leap===0?30:29))
    ) {
      throw new RangeError('Invalid Jalali date');
    }

    const jdn = jalaliJdn(y,m,d);
    const date = new Date((jdn-2440588)*86400000);

    return new Date(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      12
    );
  }

  function currentJalaliMonth(date) {
    const p = jalaliParts(date);
    return {y:p.year,m:p.month};
  }

  function jalaliMonthLength(y,m) {
    if (m<=6) return 31;
    if (m<=11) return 30;
    return jalaliCalendar(y).leap===0?30:29;
  }

  function shiftJalaliMonth(date,delta) {
    const p = jalaliParts(date);
    let y = p.year;
    let m = p.month+delta;

    while (m<1) {
      m+=12;
      y--;
    }

    while (m>12) {
      m-=12;
      y++;
    }

    return fromJalali(y,m,1);
  }

  function addDays(date,days) {
    const d = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      12
    );

    d.setDate(d.getDate()+days);
    return d;
  }

  function saturdayStart(date) {
    return addDays(date,-((date.getDay()+1)%7));
  }

  function displayDayNumber(date) {
    const n = jalaliParts(date).day;

    return settings.language==='fa'
      ? faNum(n)
      : String(n);
  }

  function monthName(y,m) {
    return settings.language==='fa'
      ? `${monthsFa[m-1]} ${y}`
      : `${monthsEn[m-1]} ${y}`;
  }

  function escapeHtml(s='') {
    return String(s).replace(/[&<>"']/g,c=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c]));
  }

  function showToast(msg) {
    const el = $('#toast');
    if (!el) return;

    el.textContent = msg;
    el.classList.add('show');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(
      () => el.classList.remove('show'),
      2500
    );
  }

  function fmtTime(t) {
    return t||'—';
  }

  function catName(c) {
    return ({
      personal:text('شخصی','Personal'),
      study:text('درس','Study'),
      work:text('کار','Work'),
      health:text('سلامت','Health')
    })[c]||escapeHtml(c);
  }

  function priorityName(p) {
    return ({
      normal:text('معمولی','Normal'),
      high:text('بالا','High'),
      urgent:text('ضروری','Urgent')
    })[p]||escapeHtml(p);
  }

  function applyLanguage() {
    document.documentElement.lang = settings.language;
    document.documentElement.dir =
      settings.language==='fa'?'rtl':'ltr';

    $$('[data-i18n]').forEach(el=>{
      const k = el.dataset.i18n;

      if (labels[settings.language][k]) {
        el.textContent = labels[settings.language][k];
      }
    });

    $('#headerDate').textContent = jalaliLabel(new Date());

    $('#pageTitle').textContent = ({
      dashboard:text('داشبورد','Dashboard'),
      tasks:text('کارها','Tasks'),
      routines:text('روتین‌های ثابت','Fixed routines'),
      calendar:text('تقویم شمسی','Persian calendar'),
      assistant:text('دستیار','Assistant'),
      settings:text('تنظیمات','Settings')
    })[page];

    $('#quickAdd span').textContent =
      text('کار جدید','New task');

    $('#itemTitle').placeholder = text('مثلاً مطالعه فصل اول','e.g. Study chapter one');
    $('#itemNotes').placeholder = text('جزئیات بیشتر...','More details...');
    $('#closeModal').setAttribute('aria-label',text('بستن','Close'));
    $('#themeBtn').setAttribute('aria-label',text('تغییر تم روشن/تاریک','Toggle light/dark theme'));
    $('#menuBtn').setAttribute('aria-label',text('منو','Menu'));

    const setOptions = (sel,map) => $$(sel+' option').forEach(o=>{
      if (map[o.value]) o.textContent = map[o.value];
    });

    setOptions('#itemCategory',{
      personal:catName('personal'),study:catName('study'),
      work:catName('work'),health:catName('health')
    });

    setOptions('#itemPriority',{
      normal:priorityName('normal'),high:priorityName('high'),urgent:priorityName('urgent')
    });

    setOptions('#routineRepeat',{
      daily:text('هر روز','Every day'),
      weekdays:text('روزهای انتخابی هفته','Selected weekdays'),
      weekly:text('هر هفته','Weekly'),
      monthly:text('ماهانه','Monthly')
    });

    $$('#weekdayPicks label').forEach((l,i)=>{
      if (l.lastChild) {
        l.lastChild.textContent = ' '+(settings.language==='fa'?daysFa:daysEn)[i];
      }
    });
  }

  function applyCharacter() {
    // Set on <html> so derived :root variables (--green, --bg ...) follow the theme.
    document.documentElement.dataset.char = settings.character;
    document.body.classList.toggle('light',settings.theme==='light');

    const probe = document.createElement('span');
    probe.style.color = 'var(--bg)';
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta&&color) meta.setAttribute('content',color);
  }

  function setPage(p) {
    if (p!==page) {
      taskQuery = '';
      taskStatus = 'all';
    }

    page = p;

    $$('.nav-item[data-page]').forEach(b=>{
      b.classList.toggle('active',b.dataset.page===p);
    });

    $('#sidebar').classList.remove('open');

    applyLanguage();
    render();
  }

  
  function render() {
    applyLanguage();

    $('#taskCount').textContent =
      tasks.filter(t=>!t.done).length;

    const root = $('#page');

    root.innerHTML = ({
      dashboard: dashboardPage,
      tasks: tasksPage,
      routines: routinesPage,
      calendar: calendarPage,
      assistant: assistantPage,
      settings: settingsPage
    }[page] || dashboardPage)();
  }

  function taskRow(t,card=false) {

    return `
      <div class="${card?'task-card':'task-row'} ${t.done?'done':''}">
        <input
          class="task-check"
          type="checkbox"
          data-done="${t.id}"
          ${t.done?'checked':''}
          aria-label="done"
        >

        <div class="task-main">
          <div class="task-title">${escapeHtml(t.title)}</div>

          <div class="task-meta">
            ${catName(t.category)} ·
            ${t.date
              ?jalaliLabel(parseKey(t.date),false)
              :text('بدون تاریخ','No date')}
            ${t.time?'· '+fmtTime(t.time):''}
          </div>
        </div>

        <span class="tag ${t.priority}">
          ${priorityName(t.priority)}
        </span>

        ${card?`
          <div class="card-actions">
            <button class="mini-btn" data-edit-task="${t.id}">✎</button>
            <button class="mini-btn" data-delete-task="${t.id}">×</button>
          </div>
        `:''}
      </div>
    `;
  }

  function routineMatches(r,date) {
    if (!r.enabled) return false;

    const dow = date.getDay();
    const p = jalaliParts(date);

    if (r.repeat==='daily') return true;

    if (r.repeat==='weekdays') {
      return (r.weekdays||[]).includes(dow);
    }

    if (r.repeat==='weekly') {
      return dow===Number(r.weekday);
    }

    if (r.repeat==='monthly') {
      const len = jalaliMonthLength(p.year,p.month);
      return p.day===Math.min(Number(r.monthDay||1),len);
    }

    return false;
  }

  function routineRow(r,card=false) {
    return `
      <div class="${card?'routine-card':'routine-mini'}">
        <div class="routine-timebox">
          ${escapeHtml(r.time||'09:00')}
        </div>

        <div class="task-main">
          <b>${escapeHtml(r.title)}</b>
          <small>
            ${catName(r.category)} ·
            ${r.confirm
              ?text('با تأیید انجام','Completion check')
              :text('یادآوری ساده','Reminder only')}
          </small>
        </div>

        ${card?`
          <label title="${text('فعال','Enabled')}">
            <input
              class="switch"
              type="checkbox"
              data-routine-toggle="${r.id}"
              ${r.enabled?'checked':''}
            >
          </label>

          <div class="card-actions">
            <button class="mini-btn" data-edit-routine="${r.id}">✎</button>
            <button class="mini-btn" data-delete-routine="${r.id}">×</button>
          </div>
        `:''}
      </div>
    `;
  }

  function dashboardPage() {
    const today = dateKey(new Date());

    const todays = tasks
      .filter(t=>!t.done&&(!t.date||t.date<=today))
      .sort((a,b)=>
        (a.date||'9999').localeCompare(b.date||'9999') ||
        (a.time||'').localeCompare(b.time||'')
      );

    const done = tasks.filter(t=>t.done).length;
    const active = routines.filter(r=>r.enabled);

    const dueR = active
      .filter(r=>routineMatches(r,new Date()))
      .sort((a,b)=>(a.time||'').localeCompare(b.time||''));

    return `
      <div class="welcome">
        <div>
          <div class="eyebrow">YOUR PERSONAL COMMAND CENTER</div>

          <h2>
            ${text(
              'سلام! آماده‌ای امروز رو بسازی؟',
              'Welcome back. Ready to make today count?'
            )}
          </h2>

          <p>
            ${text(
              'کارهای مهمت رو ببین و با یک قدم کوچک شروع کن.',
              'See what matters and start with one small step.'
            )}
          </p>
        </div>

        <div class="welcome-mark">
          ✦ ${text('نسخه اول Iron Man','Iron Man · First release')}
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <span class="stat-icon">▤</span>
          <div class="label">${text('کارهای باقی‌مانده','Open tasks')}</div>
          <strong>${tasks.filter(t=>!t.done).length}</strong>
          <div class="sub">${text('در فهرست کارها','In your task list')}</div>
        </div>

        <div class="stat">
          <span class="stat-icon">✓</span>
          <div class="label">${text('انجام‌شده','Completed')}</div>
          <strong>${done}</strong>
          <div class="sub">${text('تا این لحظه','So far')}</div>
        </div>

        <div class="stat">
          <span class="stat-icon">⟳</span>
          <div class="label">${text('روتین‌های فعال','Active routines')}</div>
          <strong>${active.length}</strong>
          <div class="sub">${text('برنامه‌های تکرارشونده','Recurring habits')}</div>
        </div>

        <div class="stat">
          <span class="stat-icon">◷</span>
          <div class="label">${text('کارهای پیش رو','Upcoming today')}</div>
          <strong>${todays.length+dueR.length}</strong>
          <div class="sub">${text('کار و روتین امروز','Tasks and routines today')}</div>
        </div>
      </div>

      <div class="content-grid">
        <section class="panel">
          <div class="panel-head">
            <h3>${text('کارهای پیش رو','Upcoming tasks')}</h3>
            <button class="text-link" data-goto="tasks">
              ${text('مشاهده همه ←','View all →')}
            </button>
          </div>

          <div class="task-list">
            ${
              todays.length
              ?todays.slice(0,5).map(t=>taskRow(t)).join('')
              :`
                <div class="empty">
                  <b>${text('فعلاً کار فوری نداری','Nothing urgent right now')}</b>
                  ${text('می‌تونی یک کار تازه اضافه کنی.','You can add a new task.')}
                </div>
              `
            }
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h3>${text('روتین‌های امروز','Today’s routines')}</h3>
            <button class="text-link" data-goto="routines">
              ${text('مدیریت ←','Manage →')}
            </button>
          </div>

          ${
            dueR.length
            ?dueR.slice(0,5).map(r=>routineRow(r)).join('')
            :`
              <div class="empty">
                <b>${text('روتینی برای امروز نیست','No routines scheduled')}</b>
                ${text('روتین‌های ثابتت رو اضافه کن.','Add your recurring routines.')}
              </div>
            `
          }

          <div class="quick-actions">
            <button class="quick-action" data-action="task">
              <span>＋</span>${text('افزودن کار','Add task')}
            </button>

            <button class="quick-action" data-action="routine">
              <span>⟳</span>${text('روتین جدید','New routine')}
            </button>
          </div>
        </section>
      </div>
    `;
  }

  function tasksPage() {
    return `
      <div class="toolbar">
        <input
          class="search"
          id="taskSearch"
          value="${escapeHtml(taskQuery)}"
          placeholder="${text('جست‌وجو بین کارها...','Search tasks...')}"
        >

        <select class="filter-select" id="taskFilter">
          <option value="all" ${taskStatus==='all'?'selected':''}>${text('همه کارها','All tasks')}</option>
          <option value="open" ${taskStatus==='open'?'selected':''}>${text('باز','Open')}</option>
          <option value="done" ${taskStatus==='done'?'selected':''}>${text('انجام‌شده','Completed')}</option>
        </select>

        <span class="spacer"></span>

        <button class="primary-btn" data-action="task">
          ＋ ${text('کار جدید','New task')}
        </button>
      </div>

      <div id="taskResults">${taskResultsHtml()}</div>
    `;
  }

  function filteredTasks() {
    const q = taskQuery.toLowerCase();

    return tasks.filter(t=>
      (t.title+' '+(t.notes||'')).toLowerCase().includes(q)&&
      (
        taskStatus==='all'||
        (taskStatus==='done'?t.done:!t.done)
      )
    );
  }

  function taskResultsHtml() {
    if (!tasks.length) {
      return `
        <div class="empty">
          <b>${text('هنوز کاری ثبت نشده','No tasks yet')}</b>
          ${text('اولین کارت رو اضافه کن تا شروع کنیم.','Add your first task to get started.')}
        </div>
      `;
    }

    const list = filteredTasks();

    return list.length
      ?list.map(t=>taskRow(t,true)).join('')
      :`<div class="empty">${text('موردی پیدا نشد.','No matching tasks.')}</div>`;
  }

  function routinesPage() {
    return `
      <div class="welcome">
        <div>
          <div class="eyebrow">REPEATABLE PLANS</div>

          <h2>
            ${text(
              'روتین‌هایی که به برنامه‌ات شکل می‌دن',
              'Build a rhythm that works'
            )}
          </h2>

          <p>
            ${text(
              'هر روتین تنظیمات و شیوه تأیید مستقل خودش رو داره.',
              'Each routine has its own schedule and completion setting.'
            )}
          </p>
        </div>

        <button class="primary-btn" data-action="routine">
          ＋ ${text('روتین جدید','New routine')}
        </button>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h3>${text('فهرست روتین‌ها','Your routines')}</h3>

          <span class="tag">
            ${routines.filter(r=>r.enabled).length}
            ${text('فعال','active')}
          </span>
        </div>

        ${
          routines.length
          ?routines.map(r=>routineRow(r,true)).join('')
          :`
            <div class="empty">
              <b>${text('هنوز روتینی نساختی','No routines created')}</b>
              ${text(
                'روتین‌هایی مثل مطالعه، ورزش یا مرور روزانه رو اضافه کن.',
                'Add routines such as reading, exercise, or daily review.'
              )}
            </div>
          `
        }
      </div>

      <p class="task-meta" style="margin-top:13px">
        ${text(
          'یادآوری‌های نسخه فعلی داخل برنامه نمایش داده می‌شوند؛ برای اعلان حتی وقتی برنامه بسته است، اتصال سرویس اعلان در مرحله بعدی اضافه می‌شود.',
          'This release shows reminders while the app is open. Background notifications can be connected in a later deployment step.'
        )}
      </p>
    `;
  }

  function calendarPage() {
    const selected = parseKey(selectedDate)||new Date();
    const today = dateKey(new Date());
    const anchor = calendarView==='month'?monthCursor:selected;

    const p = jalaliParts(anchor);
    const y = p.year;
    const m = p.month;

    const title = calendarView==='month'
      ?monthName(y,m)
      :`${jalaliLabel(saturdayStart(selected),false)} — ${jalaliLabel(addDays(saturdayStart(selected),6),false)}`;

    const navButtons = `
      <div class="month-controls">
        <button data-period="-1" aria-label="Previous">‹</button>
        <button data-period="0" aria-label="Today">•</button>
        <button data-period="1" aria-label="Next">›</button>
      </div>
    `;

    const viewToggle = `
      <div class="calendar-view-toggle">
        <button
          class="${calendarView==='month'?'active':''}"
          data-calendar-view="month"
        >${text('ماهانه','Month')}</button>

        <button
          class="${calendarView==='week'?'active':''}"
          data-calendar-view="week"
        >${text('هفتگی','Week')}</button>
      </div>
    `;

    let grid = '';

    if (calendarView==='month') {
      const first = fromJalali(y,m,1);
      const len = jalaliMonthLength(y,m);
      const offset = (first.getDay()+1)%7;

      for (let i=0;i<offset;i++) {
        grid += '<div class="day muted" aria-hidden="true"></div>';
      }

      for (let d=1;d<=len;d++) {
        const dt = fromJalali(y,m,d);
        const key = dateKey(dt);
        const isToday = key===today;
        const isSelected = key===selectedDate;

        const hasTask = tasks.some(t=>t.date===key);
        const hasRoutine = routines.some(r=>routineMatches(r,dt));

        grid += `
          <button
            class="day ${isToday?'today':''} ${isSelected?'selected':''}"
            data-date="${key}"
          >
            <span class="day-num">${displayDayNumber(dt)}</span>

            <span class="day-markers">
              ${hasTask?'<i></i>':''}
              ${hasRoutine?'<i class="routine"></i>':''}
            </span>
          </button>
        `;
      }

      const trailing = (7-((offset+len)%7))%7;

      for (let i=0;i<trailing;i++) {
        grid += '<div class="day muted" aria-hidden="true"></div>';
      }

    } else {
      const start = saturdayStart(selected);

      for (let i=0;i<7;i++) {
        const dt = addDays(start,i);
        const key = dateKey(dt);
        const dayTasks = tasks.filter(t=>t.date===key);
        const dayRoutines = routines.filter(r=>routineMatches(r,dt));

        grid += `
          <button
            class="week-day ${key===today?'today':''} ${key===selectedDate?'selected':''}"
            data-date="${key}"
          >
            <span class="week-day-name">
              ${
                (settings.language==='fa'
                  ?['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه']
                  :['Sat','Sun','Mon','Tue','Wed','Thu','Fri'])[i]
              }
            </span>

            <strong>${displayDayNumber(dt)}</strong>

            <span class="week-day-count">
              ${dayTasks.length
                ?text(`${dayTasks.length} کار`,` ${dayTasks.length} tasks`)
                :''}
              ${dayRoutines.length
                ?` · ${dayRoutines.length} ${text('روتین','routines')}`
                :''}
            </span>
          </button>
        `;
      }
    }

    const dt = parseKey(selectedDate);
    const dayTasks = tasks.filter(t=>t.date===selectedDate);
    const dayRoutines = routines.filter(r=>routineMatches(r,dt||new Date()));
    const dayHeading = dt?jalaliLabel(dt):'';

    const details = `
      <div class="selected-day">
        <h4>${dayHeading}</h4>

        ${
          dayTasks.length
          ?dayTasks.map(t=>taskRow(t)).join('')
          :`
            <div class="task-meta">
              ${text('کاری برای این تاریخ ثبت نشده.','No tasks for this date.')}
            </div>
          `
        }

        ${
          dayRoutines.length
          ?`
            <div class="task-meta" style="margin:12px 0 6px">
              ${text('روتین‌های این روز','Routines for this day')}
            </div>

            ${dayRoutines.map(r=>routineRow(r)).join('')}
          `
          :''
        }

        <div style="margin-top:12px">
          <button
            class="secondary-btn"
            data-action="task"
            data-prefill-date="${selectedDate}"
          >
            ＋ ${text('افزودن کار برای این روز','Add task for this day')}
          </button>
        </div>
      </div>
    `;

    return `
      <div class="calendar-wrap">
        <div class="calendar-head">
          <div>
            <div class="eyebrow">${text('تقویم شمسی دقیق','PERSIAN CALENDAR')}</div>
            <h3>${title}</h3>
          </div>

          <div class="calendar-tools">
            ${viewToggle}
            ${navButtons}
          </div>
        </div>

        <div class="calendar-grid ${calendarView==='week'?'week-mode':''}">
          ${
            (settings.language==='fa'?daysFa:daysEn)
              .map(d=>`<div class="weekday">${d}</div>`)
              .join('')
          }
          ${grid}
        </div>

        ${details}
      </div>
    `;
  }

  function assistantPage() {
    return `
      <div class="assistant-box">
        <div class="assistant-intro">
          <div class="assistant-orb">✧</div>
          <div class="eyebrow">IRON MAN</div>

          <h2>${text('دستیار آماده کمک است','Ready to help')}</h2>

          <p>
            ${text(
              'فعلاً می‌تونی با زبان طبیعی کار ثبت کنی و کارهایت را مرور کنی. اتصال هوش مصنوعی آنلاین در مرحله بعدی فعال می‌شود.',
              'For now, create tasks in natural language and review your plans. Online AI integration comes in a later stage.'
            )}
          </p>
        </div>

        <div class="chat-log" id="chatLog">
          <div class="bubble bot">
            ${text(
              'سلام! مثلاً بنویس: «فردا ساعت ۵ ریاضی بخون» تا یک کار برات ثبت کنم.',
              'Hi! Try: “Study math tomorrow at 5” and I’ll create a task.'
            )}
          </div>
        </div>

        <form class="chat-form" id="chatForm">
          <input
            id="chatInput"
            placeholder="${text('به دستیار آیرون‌من بگو چه کاری داری...','Tell Iron Man what you need to do...')}"
          >

          <button class="primary-btn">
            ${text('ارسال','Send')}
          </button>
        </form>

        <div class="suggestions">
          <button data-prompt="${text('فردا ساعت ۵ ریاضی بخون','Study math tomorrow at 5')}">
            ${text('ثبت کار برای فردا','Add task for tomorrow')}
          </button>

          <button data-prompt="${text('کارهای باز من رو نشون بده','Show my open tasks')}">
            ${text('نمایش کارهای باز','Show open tasks')}
          </button>

          <button data-prompt="${text('یک روتین جدید بساز','Create a new routine')}">
            ${text('ساخت روتین','Create routine')}
          </button>
        </div>
      </div>
    `;
  }

  function notificationStatusLabel() {
    if (!('Notification' in window)) {
      return text('این مرورگر اعلان را پشتیبانی نمی‌کند','Notifications unsupported');
    }

    if (
      Notification.permission==='granted' &&
      settings.notificationsEnabled
    ) {
      return text('فعال','Enabled');
    }

    if (Notification.permission==='denied') {
      return text('مجوز مسدود شده','Permission blocked');
    }

    return text('غیرفعال','Disabled');
  }

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBXfTGg2JB6hLCy78WEC0aNOAuXMqg7CV4',
    authDomain: 'loki-2d9d9.firebaseapp.com',
    projectId: 'loki-2d9d9',
    storageBucket: 'loki-2d9d9.firebasestorage.app',
    messagingSenderId: '890801691330',
    appId: '1:890801691330:web:56ecdcbf0138cd851bb95b',
    measurementId: 'G-GGTVKG9CNP'
  };

  const FIREBASE_VAPID_KEY =
    'BByX6sNBDJicLrdhRiA8yjc4HEEPXpCgBxeyKdpac6yu3vO_PMMhs7wG-sNRrfvdUiEC4wLmP8KTBCWLg-BNe2w';

  let firebaseMessagingInstance = null;
  let firebaseAuthInstance = null;
  let cloudUser = null;

  const firebaseScriptPromises = new Map();

  function loadFirebaseCompatScript(src) {
    const ready = () => {
      if (!window.firebase) return false;

      if (src.includes('firebase-app-compat')) {
        return typeof firebase.initializeApp==='function';
      }

      if (src.includes('firebase-auth-compat')) {
        return typeof firebase.auth==='function';
      }

      if (src.includes('firebase-firestore-compat')) {
        return typeof firebase.firestore==='function';
      }

      if (src.includes('firebase-messaging-compat')) {
        return typeof firebase.messaging==='function';
      }

      return false;
    };

    if (ready()) return Promise.resolve();

    if (firebaseScriptPromises.has(src)) {
      return firebaseScriptPromises.get(src);
    }

    const promise = new Promise((resolve,reject)=>{
      const existing = [...document.scripts].find(
        script=>script.src===src
      );

      if (existing) {
        existing.addEventListener('load',()=>{
          ready()
            ?resolve()
            :reject(new Error('Firebase SDK did not initialize'));
        },{once:true});

        existing.addEventListener('error',()=>{
          reject(new Error('Firebase SDK could not be loaded'));
        },{once:true});

        return;
      }

      const script = document.createElement('script');
      script.src = src;

      script.onload = () => {
        ready()
          ?resolve()
          :reject(new Error('Firebase SDK did not initialize'));
      };

      script.onerror = () => {
        reject(new Error('Firebase SDK could not be loaded'));
      };

      document.head.appendChild(script);
    });

    firebaseScriptPromises.set(src,promise);

    promise.catch(()=>{
      firebaseScriptPromises.delete(src);
    });

    return promise;
  }

  async function ensureFirebaseServices() {
    const base = 'https://www.gstatic.com/firebasejs/13.0.0/';

    await loadFirebaseCompatScript(
      base+'firebase-app-compat.js'
    );

    await loadFirebaseCompatScript(
      base+'firebase-auth-compat.js'
    );

    if (!window.firebase) {
      throw new Error('Firebase SDK unavailable');
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    firebaseAuthInstance = firebase.auth();

    return {
      auth:firebaseAuthInstance
    };
  }

  async function registerFirebasePush(registration) {
    const base = 'https://www.gstatic.com/firebasejs/13.0.0/';

    await loadFirebaseCompatScript(
      base+'firebase-app-compat.js'
    );

    await loadFirebaseCompatScript(
      base+'firebase-messaging-compat.js'
    );

    if (!window.firebase) {
      throw new Error('Firebase SDK unavailable');
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }

    firebaseMessagingInstance = firebase.messaging();

    const token = await firebaseMessagingInstance.getToken({
      vapidKey:FIREBASE_VAPID_KEY,
      serviceWorkerRegistration:registration
    });

    if (!token) {
      throw new Error('Firebase did not return a push token');
    }

    localStorage.setItem('loki_fcm_token',token);

    if (!firebaseMessagingInstance.__lokiForegroundHandler) {
      firebaseMessagingInstance.onMessage(payload=>{
        const title =
          payload?.notification?.title||'Iron Man';

        const body =
          payload?.notification?.body||
          payload?.data?.body||
          text(
            'پیام جدیدی دریافت شد.',
            'You received a new message.'
          );

        if (Notification.permission==='granted') {
          registration.showNotification(title,{
            body,
            icon:'./icons/icon-192.png',
            badge:'./icons/icon-192.png',
            tag:'loki-fcm-foreground'
          });
        }
      });

      firebaseMessagingInstance.__lokiForegroundHandler = true;
    }

    return token;
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      showToast(
        text(
          'مرورگر از اعلان پشتیبانی نمی‌کند.',
          'This browser does not support notifications.'
        )
      );
      return;
    }

    if (
      !('serviceWorker' in navigator) ||
      location.protocol==='file:'
    ) {
      showToast(
        text(
          'برای اعلان‌ها Iron Man را از HTTPS یا localhost باز کن.',
          'Open Iron Man over HTTPS or localhost to enable notifications.'
        )
      );
      return;
    }

    let permission = Notification.permission;

    if (permission!=='granted') {
      permission = await Notification.requestPermission();
    }

    if (permission==='granted') {
      settings.notificationsEnabled = true;
      persist();
      render();

      try {
        const reg = await navigator.serviceWorker.ready;

        await reg.showNotification(
          text(
            'اعلان‌های Iron Man فعال شد',
            'Iron Man notifications enabled'
          ),
          {
            body:text(
              'مجوز اعلان فعال است. در حال ثبت دستگاه برای دریافت Push از Firebase…',
              'Notification permission is enabled. Registering this device for Firebase Push…'
            ),
            icon:'./icons/icon-192.png',
            tag:'loki-notifications-enabled'
          }
        );

        try {
          await registerFirebasePush(reg);

          showToast(
            text(
              'اعلان‌ها فعال شدند و دستگاه به Firebase متصل شد.',
              'Notifications enabled and this device registered with Firebase.'
            )
          );

        } catch (pushError) {
          console.error(
            'Iron Man Firebase Push registration:',
            pushError
          );

          showToast(
            text(
              'اعلان محلی فعال شد، اما اتصال Firebase کامل نشد. اتصال HTTPS و تنظیمات Firebase را بررسی می‌کنیم.',
              'Local notifications are enabled, but Firebase Push registration failed. Check HTTPS and Firebase setup.'
            )
          );
        }

      } catch (error) {
        console.error(error);

        showToast(
          text(
            'اعلان‌ها فعال شدند، اما سرویس اعلان آماده نشد.',
            'Notifications are enabled, but the notification service did not become ready.'
          )
        );
      }

      checkReminders();

    } else {
      settings.notificationsEnabled = false;
      persist();
      render();

      showToast(
        text(
          'مجوز اعلان داده نشد؛ تنظیمات مجوز مرورگر را بررسی کن.',
          'Permission was not granted. Check browser notification settings.'
        )
      );
    }
  }

  function reminderHistory() {
    try {
      return JSON.parse(
        localStorage.getItem(REMINDER_KEY)||'[]'
      );
    } catch {
      return [];
    }
  }

  async function sendReminder(key,title,body) {
    if (reminderInFlight.has(key)) return;

    reminderInFlight.add(key);

    try {
      await sendReminderOnce(key,title,body);
    } finally {
      reminderInFlight.delete(key);
    }
  }

  async function sendReminderOnce(key,title,body) {
    const fired = reminderHistory();

    if (fired.includes(key)) return;

    const options = {
      body,
      icon:'./icons/icon-192.png',
      badge:'./icons/icon-192.png',
      tag:key,
      renotify:false,
      dir:document.documentElement.dir||'auto',
      lang:document.documentElement.lang||'fa',
      timestamp:Date.now(),
      data:{
        url:'./',
        reminderKey:key
      }
    };

    let sent = false;

    try {
      const registration = await navigator.serviceWorker.ready;

      await registration.showNotification(title,options);
      sent = true;

    } catch {
      try {
        if (
          'Notification' in window &&
          Notification.permission==='granted'
        ) {
          new Notification(title,options);
          sent = true;
        }
      } catch {}
    }

    if (sent) {
      fired.push(key);

      try {
        localStorage.setItem(
          REMINDER_KEY,
          JSON.stringify(fired.slice(-250))
        );
      } catch {}
    }
  }

  function checkReminders() {
    if (
      !settings.notificationsEnabled ||
      !('Notification' in window) ||
      Notification.permission!=='granted'
    ) {
      return;
    }

    const now = new Date();
    const nowMinute = Math.floor(now.getTime()/60000);
    const today = dateKey(now);

    const due = (date,time) => {
      if (!date||!time) return false;

      const target = new Date(`${date}T${time}:00`);
      const minute = Math.floor(target.getTime()/60000);

      return Number.isFinite(minute) &&
        minute<=nowMinute &&
        minute>=nowMinute-5;
    };

    tasks
      .filter(t=>!t.done&&due(t.date,t.time))
      .forEach(t=>{
        sendReminder(
          `task:${t.id}:${t.date}:${t.time}`,
          text('یادآوری کار در Iron Man','Iron Man task reminder'),
          t.title
        );
      });

    routines
      .filter(r=>r.enabled&&r.time&&routineMatches(r,now))
      .forEach(r=>{
        if (due(today,r.time)) {
          sendReminder(
            `routine:${r.id}:${today}:${r.time}`,
            text('یادآوری روتین در Iron Man','Iron Man routine reminder'),
            r.title
          );
        }
      });
  }

  function authErrorMessage(error,fallbackFa,fallbackEn) {
    const code = (error&&error.code)||'';
    const msg = (error&&error.message)||'';

    const map = {
      'auth/invalid-email':['ایمیل معتبر نیست.','The email address is not valid.'],
      'auth/email-already-in-use':['این ایمیل قبلاً ثبت شده؛ وارد شو.','This email is already registered. Try signing in.'],
      'auth/weak-password':['رمز عبور ضعیف است (حداقل ۶ کاراکتر).','Password is too weak (minimum 6 characters).'],
      'auth/invalid-credential':['ایمیل یا رمز عبور اشتباه است.','Wrong email or password.'],
      'auth/wrong-password':['ایمیل یا رمز عبور اشتباه است.','Wrong email or password.'],
      'auth/user-not-found':['ایمیل یا رمز عبور اشتباه است.','Wrong email or password.'],
      'auth/too-many-requests':['تلاش‌های زیاد؛ کمی بعد دوباره امتحان کن.','Too many attempts. Try again later.'],
      'auth/network-request-failed':['اتصال برقرار نشد؛ اینترنت یا دسترسی به Firebase را بررسی کن.','Network error. Check your connection or Firebase access.'],
      'auth/operation-not-allowed':['ورود با ایمیل در Firebase فعال نیست.','Email/password sign-in is not enabled in Firebase.'],
      'auth/unauthorized-domain':['این دامنه در Firebase مجاز نشده است.','This domain is not authorized in Firebase.']
    };

    if (map[code]) return text(map[code][0],map[code][1]);

    if (/could not be loaded|unavailable|did not initialize/i.test(msg)) {
      return text(map['auth/network-request-failed'][0],map['auth/network-request-failed'][1]);
    }

    return text(fallbackFa,fallbackEn);
  }

  async function initializeLokiAuth() {
    try {
      const {auth} = await ensureFirebaseServices();

      auth.onAuthStateChanged(user=>{
        cloudUser = user;

        if (page==='settings') {
          render();
        }
      });

    } catch (error) {
      console.error('IRON MAN AUTH INIT ERROR:',error);
    }
  }

  
function accountSettingsCard() {
  if (cloudUser) {
    return `
      <div class="setting-card">
        <div class="eyebrow">STARK ACCOUNT</div>

        <h3>${text('حساب کاربری Iron Man','Iron Man account')}</h3>

        <p>
          ${text(
            'حساب شما متصل است. همگام‌سازی ابری هنوز فعال نیست و اطلاعات فقط روی همین دستگاه می‌ماند.',
            'Your account is connected. Cloud sync is not active yet; your data stays on this device.'
          )}
        </p>

        <div class="setting-row">
          <span>${text('ایمیل حساب','Account email')}</span>
          <span class="tag">${escapeHtml(cloudUser.email||'')}</span>
        </div>

        <div class="setting-row">
          <button class="secondary-btn" id="lokiSignOut">
            ${text('خروج از حساب','Sign out')}
          </button>
        </div>
      </div>
    `;
  }

  const savedEmail = localStorage.getItem('loki_saved_auth_email_v1') || '';

  return `
    <div class="setting-card">
      <div class="eyebrow">STARK ACCOUNT</div>

      <h3>${text('حساب کاربری Iron Man','Iron Man account')}</h3>

      <p>
        ${text(
          'حساب بساز یا وارد شو. همگام‌سازی ابری هنوز فعال نیست و فعلاً اطلاعات فقط روی همین دستگاه ذخیره می‌شود.',
          'Create an account or sign in. Cloud sync is not active yet; your data is stored on this device only.'
        )}
      </p>

      <form id="lokiAuthForm">
        <label>${text('ایمیل','Email')}</label>

        <input
          id="lokiAuthEmail"
          type="email"
          required
          autocomplete="email"
          value="${escapeHtml(savedEmail)}"
          placeholder="name@example.com"
        >

        <label>${text('رمز عبور','Password')}</label>

        <div class="setting-row">
          <input
            id="lokiAuthPassword"
            type="password"
            required
            minlength="6"
            autocomplete="current-password"
            placeholder="${text('حداقل ۶ کاراکتر','At least 6 characters')}"
            style="flex:1;min-width:0"
          >

          <button
            class="secondary-btn"
            type="button"
            id="lokiTogglePassword"
          >
            ${text('نمایش','Show')}
          </button>
        </div>

        <div class="setting-row">
          <button
            class="primary-btn"
            type="submit"
            id="lokiSignIn"
          >
            ${text('ورود','Sign in')}
          </button>

          <button
            class="secondary-btn"
            type="button"
            id="lokiSignUp"
          >
            ${text('ساخت حساب','Create account')}
          </button>
        </div>
      </form>
    </div>
  `;
}

  function settingsPage() {
    return `
      <div class="settings-grid">
        ${accountSettingsCard()}

        <div class="setting-card wide">
          <div class="eyebrow">APPEARANCE</div>

          <h3>${text('ظاهر برنامه','Appearance')}</h3>

          <p>
            ${text(
              'تم برنامه رو مطابق سلیقه‌ات انتخاب کن.',
              'Choose the theme that suits you.'
            )}
          </p>

          <div class="setting-row">
            <span>${text('تم روشن / تاریک','Light / dark theme')}</span>

            <button class="secondary-btn" id="settingTheme">
              ${settings.theme==='dark'
                ?text('تاریک','Dark')
                :text('روشن','Light')}
            </button>
          </div>

          <div class="setting-row" style="display:block">
            <div style="margin-bottom:4px">
              ${text('تم شخصیت‌ها','Hero themes')}
            </div>

            <div class="char-grid">
              ${CHARACTERS.map(c=>`
                <button
                  type="button"
                  class="char-btn ${settings.character===c.id?'active':''}"
                  data-char="${c.id}"
                  data-pick-char="${c.id}"
                  aria-pressed="${settings.character===c.id}"
                >
                  <span class="char-dots"><i></i><i></i><i></i></span>
                  <span>${text(c.fa,c.en)}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="setting-card">
          <div class="eyebrow">LANGUAGE</div>

          <h3>${text('زبان','Language')}</h3>

          <p>
            ${text(
              'رابط کاربری فارسی و انگلیسی.',
              'Persian and English interface.'
            )}
          </p>

          <div class="setting-row">
            <span>${text('زبان فعلی','Current language')}</span>

            <button class="secondary-btn" id="settingLanguage">
              ${settings.language==='fa'?'فارسی':'English'}
            </button>
          </div>
        </div>

        <div class="setting-card">
          <div class="eyebrow">REMINDERS</div>

          <h3>${text('اعلان‌ها و یادآوری‌ها','Notifications & reminders')}</h3>

          <p>
            ${text(
              'برای دریافت یادآوری کارها و روتین‌ها، اعلان‌ها را فعال کن. تا وقتی Iron Man باز است، زمان‌بندی را بررسی می‌کند.',
              'Enable notifications to receive task and routine reminders. In this first version, reminders are checked while Iron Man is open.'
            )}
          </p>

          <div class="setting-row">
            <span>${text('وضعیت اعلان‌ها','Notification status')}</span>

            <span class="tag" id="notificationStatus">
              ${notificationStatusLabel()}
            </span>
          </div>

          <div class="setting-row">
            <span>${text('یادآوری‌ها','Reminders')}</span>

            <button class="secondary-btn" id="enableNotifications">
              ${settings.notificationsEnabled
                ?text('خاموش کردن','Turn off')
                :text('فعال‌سازی اعلان‌ها','Enable notifications')}
            </button>
          </div>

          ${
            localStorage.getItem('loki_fcm_token')
            ?`
              <div class="setting-row">
                <span>${text('اتصال Firebase','Firebase connection')}</span>

                <button class="secondary-btn" id="copyPushToken">
                  ${text('کپی شناسه دستگاه','Copy device token')}
                </button>
              </div>
            `
            :''
          }
        </div>

        <div class="setting-card">
          <div class="eyebrow">DATA & PRIVACY</div>

          <h3>${text('اطلاعات و حریم خصوصی','Data & privacy')}</h3>

          <p>
            ${text(
              'اطلاعات فعلاً فقط در حافظه مرورگر همین دستگاه نگهداری می‌شود. پاک‌کردن داده‌های مرورگر ممکن است اطلاعات را حذف کند.',
              'Your data is currently stored in this browser on this device. Clearing browser data may erase it.'
            )}
          </p>

          <div class="setting-row">
            <span>${text('پشتیبان‌گیری','Backup')}</span>

            <button class="secondary-btn" id="exportData">
              ${text('دریافت فایل JSON','Export JSON')}
            </button>
          </div>

          <div class="setting-row">
            <span>${text('بازیابی اطلاعات','Restore')}</span>

            <label
              class="secondary-btn"
              for="importData"
              style="cursor:pointer"
            >
              ${text('انتخاب فایل','Choose file')}
            </label>

            <input
              id="importData"
              type="file"
              accept="application/json"
              class="hidden"
            >
          </div>
        </div>

        <div class="setting-card">
          <div class="eyebrow">INSTALLATION</div>

          <h3>${text('نصب Iron Man','Install Iron Man')}</h3>

          <p>
            ${text(
              'از منوی مرورگر گزینه Install app یا Add to Home Screen را انتخاب کن. برای نصب، برنامه باید روی HTTPS یا localhost اجرا شود.',
              'Use Install app or Add to Home Screen in your browser. Installation requires HTTPS or localhost.'
            )}
          </p>

          <div class="setting-row">
            <span>${text('وضعیت برنامه','App status')}</span>
            <span class="tag">${text('نسخه وب پیش‌رونده','PWA')}</span>
          </div>
        </div>
      </div>
    `;
  }

  function setupJalaliDatePicker() {
    const original = $('#itemDate');

    if (!original || $('#jalaliDatePicker')) return;

    original.classList.add('hidden');

    const wrap = document.createElement('div');
    wrap.id = 'jalaliDatePicker';
    wrap.className = 'jalali-date-picker';

    wrap.innerHTML = `
      <select id="jalaliYear" aria-label="${text('سال شمسی','Persian year')}"></select>
      <select id="jalaliMonth" aria-label="${text('ماه شمسی','Persian month')}"></select>
      <select id="jalaliDay" aria-label="${text('روز','Day')}"></select>
      <button type="button" id="clearJalaliDate" class="mini-btn">
        ${text('بدون تاریخ','No date')}
      </button>
    `;

    original.insertAdjacentElement('afterend',wrap);

    const year = $('#jalaliYear');
    const month = $('#jalaliMonth');
    const day = $('#jalaliDay');

    const years = Array.from({length:21},(_,i)=>1390+i);

    year.innerHTML =
      `<option value="">${text('سال','Year')}</option>`+
      years.map(y=>`
        <option value="${y}">
          ${settings.language==='fa'
            ?faNum(y)
            :y}
        </option>
      `).join('');

    month.innerHTML =
      `<option value="">${text('ماه','Month')}</option>`+
      monthsFa.map((m,i)=>`
        <option value="${i+1}">
          ${settings.language==='fa'?m:monthsEn[i]}
        </option>
      `).join('');

    day.innerHTML =
      `<option value="">${text('روز','Day')}</option>`;

    const refreshDays = (selected='') => {
      const y = Number(year.value);
      const m = Number(month.value);
      const max = y&&m?jalaliMonthLength(y,m):31;

      day.innerHTML =
        `<option value="">${text('روز','Day')}</option>`+
        Array.from({length:max},(_,i)=>i+1)
          .map(d=>`
            <option value="${d}">
              ${settings.language==='fa'
                ?faNum(d)
                :d}
            </option>
          `).join('');

      if (selected&&Number(selected)<=max) {
        day.value = String(selected);
      }
    };

    year.addEventListener('change',()=>{
      refreshDays(day.value);
      syncHidden();
    });

    month.addEventListener('change',()=>{
      refreshDays(day.value);
      syncHidden();
    });

    day.addEventListener('change',syncHidden);

    $('#clearJalaliDate').addEventListener('click',()=>{
      year.value = '';
      month.value = '';
      refreshDays();
      original.value = '';
    });

    function syncHidden() {
      if (year.value&&month.value&&day.value) {
        try {
          original.value = dateKey(
            fromJalali(
              Number(year.value),
              Number(month.value),
              Number(day.value)
            )
          );
        } catch {
          original.value = '';
        }
      } else {
        original.value = '';
      }
    }

    wrap._setDate = value => {
      if (!value) {
        year.value = '';
        month.value = '';
        refreshDays();
        original.value = '';
        return;
      }

      const p = jalaliParts(parseKey(value));

      if (!years.includes(p.year)) {
        const opt = document.createElement('option');
        opt.value = p.year;
        opt.textContent = p.year;
        year.add(opt);
      }

      year.value = String(p.year);
      month.value = String(p.month);

      refreshDays(p.day);
      syncHidden();
    };

    wrap._sync = syncHidden;

    wrap._incomplete = () =>
      !!(year.value||month.value||day.value) &&
      !(year.value&&month.value&&day.value);

    if ($('#jalaliPickerStyle')) return;

    const style = document.createElement('style');
    style.id = 'jalaliPickerStyle';

    style.textContent = `
      .jalali-date-picker{
        display:flex;
        gap:8px;
        align-items:center;
        flex-wrap:wrap;
        margin-top:7px
      }

      .jalali-date-picker select{
        min-width:82px;
        flex:1;
        background:var(--field-bg,rgba(255,255,255,.05));
        color:inherit;
        border:1px solid var(--border,rgba(255,255,255,.12));
        border-radius:10px;
        padding:10px;
        font:inherit
      }

      .jalali-date-picker option{
        background:#10271d;
        color:#fff
      }

      .jalali-date-picker select:focus{
        outline:2px solid var(--green);
        outline-offset:1px
      }

      #itemDate.hidden{
        display:none!important
      }
    `;

    document.head.appendChild(style);
  }

  function setJalaliDatePicker(value) {
    setupJalaliDatePicker();
    $('#jalaliDatePicker')._setDate(value||'');
  }

  function openModal(kind,id=null,prefill=null) {
    const isRoutine = kind==='routine';

    const item = id
      ?(isRoutine?routines:tasks).find(x=>x.id===id)
      :null;

    $('#itemForm').dataset.kind = kind;
    $('#itemId').value = item?.id||'';

    $('#modalTitle').textContent = item
      ?text('ویرایش مورد','Edit item')
      :isRoutine
        ?text('روتین جدید','New routine')
        :text('کار جدید','New task');

    $('#modalEyebrow').textContent =
      isRoutine?'IRON MAN / ROUTINE':'IRON MAN / TASK';

    $('#itemTitle').value = item?.title||'';
    $('#itemNotes').value = item?.notes||'';
    $('#itemCategory').value = item?.category||'personal';
    $('#itemPriority').value = item?.priority||'normal';

    $('#itemDate').value = item
      ?(item.date||'')
      :(prefill||dateKey(new Date()));

    setJalaliDatePicker($('#itemDate').value);

    $('#itemTime').value = item?.time||'';

    $('#taskFields').classList.toggle('hidden',isRoutine);
    $('#priorityField').classList.toggle('hidden',isRoutine);
    $('#routineFields').classList.toggle('hidden',!isRoutine);

    $('#routineRepeat').value = item?.repeat||'daily';
    $('#routineConfirm').checked = !!item?.confirm;

    const picked = item
      ?(item.repeat==='weekly'?[item.weekday]:(item.weekdays||[]))
      :[];

    $$('#weekdayPicks input').forEach(c=>{
      c.checked = picked.includes(Number(c.value));
    });

    $('#routineMonthDay').value =
      item?.monthDay||jalaliParts(new Date()).day;

    syncRepeatFields();

    $('#itemDialog').showModal();

    setTimeout(()=>$('#itemTitle').focus(),50);
  }

  function closeModal() {
    $('#itemDialog').close();
  }

  function syncRepeatFields() {
    const repeat = $('#routineRepeat').value;

    $('#weekdayPicks').classList.toggle(
      'hidden',
      repeat!=='weekdays'&&repeat!=='weekly'
    );

    $('#monthDayField').classList.toggle('hidden',repeat!=='monthly');

    if (repeat==='weekly'&&!$$('#weekdayPicks input:checked').length) {
      const today = String(new Date().getDay());
      const box = $$('#weekdayPicks input').find(c=>c.value===today);
      if (box) box.checked = true;
    }
  }

  function saveItem(e) {
    e.preventDefault();

    const kind = $('#itemForm').dataset.kind;
    const id = $('#itemId').value;
    const title = $('#itemTitle').value.trim();

    if (!title) return;

    if (kind==='task') {
      const picker = $('#jalaliDatePicker');

      if (picker?._incomplete?.()) {
        showToast(text(
          'تاریخ را کامل انتخاب کن یا «بدون تاریخ» را بزن.',
          'Complete the date or choose “No date”.'
        ));
        return;
      }

      picker?._sync?.();

      const prevTask = id?tasks.find(t=>t.id===id):null;

      const obj = {
        id:id||uid(),
        title,
        notes:$('#itemNotes').value,
        category:$('#itemCategory').value,
        priority:$('#itemPriority').value,
        date:$('#itemDate').value,
        time:$('#itemTime').value,
        done:prevTask?.done||false,
        createdAt:prevTask?.createdAt||Date.now()
      };

      if (id) {
        tasks = tasks.map(t=>t.id===id?obj:t);
      } else {
        tasks.unshift(obj);
      }

    } else {
      const prevRoutine = id?routines.find(r=>r.id===id):null;
      const repeat = $('#routineRepeat').value;

      const picked = $$('#weekdayPicks input:checked')
        .map(c=>Number(c.value));

      const monthDay = Math.min(
        31,
        Math.max(1,parseInt($('#routineMonthDay').value,10)||1)
      );

      const obj = {
        id:id||uid(),
        title,
        notes:$('#itemNotes').value,
        category:$('#itemCategory').value,
        time:$('#itemTime').value||'09:00',
        repeat,
        weekdays:repeat==='weekdays'?picked:[],
        weekday:repeat==='weekly'
          ?picked[0]
          :(prevRoutine?.weekday??new Date().getDay()),
        monthDay,
        confirm:$('#routineConfirm').checked,
        enabled:prevRoutine?.enabled??true,
        createdAt:prevRoutine?.createdAt||Date.now()
      };

      if ((repeat==='weekdays'||repeat==='weekly')&&!picked.length) {
        showToast(
          text(
            'حداقل یک روز هفته انتخاب کن.',
            'Choose at least one weekday.'
          )
        );
        return;
      }

      if (id) {
        routines = routines.map(r=>r.id===id?obj:r);
      } else {
        routines.unshift(obj);
      }
    }

    persist();
    closeModal();
    render();

    showToast(
      text('با موفقیت ذخیره شد.','Saved successfully.')
    );
  }

  function deleteItem(kind,id) {
    if (!confirm(text(
      'از حذف این مورد مطمئنی؟',
      'Are you sure you want to delete this item?'
    ))) return;

    if (kind==='task') {
      tasks = tasks.filter(t=>t.id!==id);
    } else {
      routines = routines.filter(r=>r.id!==id);
    }

    persist();
    render();

    showToast(text('حذف شد.','Deleted.'));
  }

  function toggleDone(id,done) {
    tasks = tasks.map(t=>t.id===id?{...t,done}:t);
    persist();
    render();
  }

  function filterTasks() {
    taskQuery = $('#taskSearch')?.value||'';
    taskStatus = $('#taskFilter')?.value||'all';

    const el = $('#taskResults');
    if (el) el.innerHTML = taskResultsHtml();
  }

  function normalizeDigits(str) {
    return String(str)
      .replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  }

  function parseNatural(rawInput) {
    const input = normalizeDigits(rawInput);
    const lower = input.toLowerCase();

    if (/کارهای باز|کارها.*نشون|show.*tasks|open tasks/.test(lower)) {
      return {type:'list'};
    }

    if (/روتین|routine/.test(lower)) {
      return {type:'routine'};
    }

    const date = new Date();

    if (/پس[\s\u200c]?فردا|day after tomorrow/.test(lower)) {
      date.setDate(date.getDate()+2);
    } else if (/فردا|tomorrow/.test(lower)) {
      date.setDate(date.getDate()+1);
    }

    let time = '';

    const tm =
      lower.match(/(?:ساعت|\bat)\s*(\d{1,2})(?::(\d{2}))?/) ||
      lower.match(/(\d{1,2})(?::(\d{2}))?\s*(?:am|pm|صبح|عصر)/) ||
      lower.match(/\b(\d{1,2}):(\d{2})\b/);

    if (tm) {
      let h = Number(tm[1]);
      const mi = Number(tm[2]||0);

      if (h<=24&&mi<60) {
        const pm = /عصر|بعد\s?از\s?ظهر|شب|pm/.test(lower);
        const am = /صبح|am/.test(lower);

        if (pm&&h<12) {
          h += 12;
        } else if (/ظهر/.test(lower)&&h>=1&&h<6) {
          h += 12;
        } else if (!pm&&!am&&!/ظهر/.test(lower)&&h>=1&&h<=6) {
          h += 12; // "ساعت ۵" without a marker normally means 17:00
        } else if (am&&h===12) {
          h = 0;
        }

        time =
          String(h%24).padStart(2,'0')+':'+String(mi).padStart(2,'0');
      }
    }

    let title = input
      .replace(/پس[\s\u200c]?فردا|day after tomorrow|فردا|tomorrow/gi,' ')
      .replace(/(?:ساعت|\bat)\s*\d{1,2}(?::\d{2})?\s*(?:صبح|ظهر|عصر|شب|بعد\s?از\s?ظهر|am|pm)?/gi,' ')
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi,' ')
      .replace(/\s+/g,' ')
      .trim();

    title = title.replace(
      /^(لطفا|لطفاً|یک کار|یه کار|ثبت کن|یادآوری کن|remind me to|add)\s*/i,
      ''
    ).trim();

    if (!title) title = input.trim();

    return {
      type:'task',
      title:title.slice(0,90),
      date:dateKey(date),
      time
    };
  }

  function assistantSend(input) {
    const log = $('#chatLog');

    const add = (who,msg) => {
      log.insertAdjacentHTML(
        'beforeend',
        `<div class="bubble ${who}">${escapeHtml(msg)}</div>`
      );

      log.scrollTop = log.scrollHeight;
    };

    add('user',input);

    const parsed = parseNatural(input);

    if (parsed.type==='list') {
      const open = tasks.filter(t=>!t.done);

      add(
        'bot',
        open.length
          ?open.map((t,i)=>`${i+1}. ${t.title}`).join(' · ')
          :text('کار بازی نداری.','You have no open tasks.')
      );

      return;
    }

    if (parsed.type==='routine') {
      setPage('routines');
      openModal('routine');
      return;
    }

    if (!parsed.title) {
      add(
        'bot',
        text(
          'متوجه عنوان کار نشدم؛ دوباره واضح‌تر بنویس.',
          'I could not identify the task title. Please rephrase.'
        )
      );

      return;
    }

    tasks.unshift({
      id:uid(),
      title:parsed.title,
      notes:'',
      category:/درس|ریاضی|مطالعه|study|math/.test(input.toLowerCase())
        ?'study'
        :'personal',
      priority:'normal',
      date:parsed.date,
      time:parsed.time,
      done:false,
      createdAt:Date.now()
    });

    persist();

    add(
      'bot',
      text(
        `ثبت شد: ${parsed.title} · ${jalaliLabel(parseKey(parsed.date),false)}${parsed.time?' · '+parsed.time:''}`,
        `Added: ${parsed.title} · ${jalaliLabel(parseKey(parsed.date),false)}${parsed.time?' · '+parsed.time:''}`
      )
    );

    $('#taskCount').textContent =
      tasks.filter(t=>!t.done).length;
  }

  document.addEventListener('click',e=>{
    const nav = e.target.closest('[data-page]');

    if (nav) {
      setPage(nav.dataset.page);
      return;
    }

    const go = e.target.closest('[data-goto]');

    if (go) {
      setPage(go.dataset.goto);
      return;
    }

    const action = e.target.closest('[data-action]');

    if (action) {
      openModal(
        action.dataset.action,
        null,
        action.dataset.prefillDate||null
      );
      return;
    }

    const done = e.target.closest('[data-done]');

    if (done) {
      toggleDone(done.dataset.done,done.checked);
      return;
    }

    const edit = e.target.closest('[data-edit-task]');

    if (edit) {
      openModal('task',edit.dataset.editTask);
      return;
    }

    const del = e.target.closest('[data-delete-task]');

    if (del) {
      deleteItem('task',del.dataset.deleteTask);
      return;
    }

    const er = e.target.closest('[data-edit-routine]');

    if (er) {
      openModal('routine',er.dataset.editRoutine);
      return;
    }

    const dr = e.target.closest('[data-delete-routine]');

    if (dr) {
      deleteItem('routine',dr.dataset.deleteRoutine);
      return;
    }

    const date = e.target.closest('[data-date]');

    if (date) {
      selectedDate = date.dataset.date;

      const chosen = parseKey(selectedDate);

      if (chosen) monthCursor = chosen;

      render();
      return;
    }

    const view = e.target.closest('[data-calendar-view]');

    if (view) {
      calendarView = view.dataset.calendarView;
      render();
      return;
    }

    const period = e.target.closest('[data-period]');

    if (period) {
      const delta = Number(period.dataset.period);

      if (delta===0) {
        selectedDate = dateKey(new Date());
        monthCursor = new Date();

      } else if (calendarView==='month') {
        monthCursor = shiftJalaliMonth(monthCursor,delta);

      } else {
        const selected = parseKey(selectedDate)||new Date();

        selectedDate = dateKey(
          addDays(selected,delta*7)
        );

        monthCursor = parseKey(selectedDate);
      }

      render();
      return;
    }

    const prompt = e.target.closest('[data-prompt]');

    if (prompt) {
      $('#chatInput').value = prompt.dataset.prompt;
      $('#chatForm').requestSubmit();
    }
  });

  document.addEventListener('change',e=>{
    if (e.target.matches('[data-routine-toggle]')) {
      routines = routines.map(r=>
        r.id===e.target.dataset.routineToggle
          ?{...r,enabled:e.target.checked}
          :r
      );

      persist();
      render();
    }

    if (e.target.id==='taskFilter') {
      filterTasks();
    }

    if (e.target.id==='importData'&&e.target.files[0]) {
      const fileInput = e.target;
      const reader = new FileReader();

      reader.onload = () => {
        try {
          const d = JSON.parse(reader.result);

          if (
            !d||
            !Array.isArray(d.tasks)||
            !Array.isArray(d.routines)
          ) {
            throw Error();
          }

          const newTasks = sanitizeList(d.tasks,sanitizeTask);
          const newRoutines = sanitizeList(d.routines,sanitizeRoutine);

          const ok = confirm(text(
            `با بازیابی، اطلاعات فعلی جایگزین می‌شود (${newTasks.length} کار و ${newRoutines.length} روتین). ادامه می‌دهی؟`,
            `Restoring replaces your current data (${newTasks.length} tasks, ${newRoutines.length} routines). Continue?`
          ));

          if (!ok) return;

          tasks = newTasks;
          routines = newRoutines;

          persist();
          render();

          showToast(
            text('اطلاعات بازیابی شد.','Data restored.')
          );

        } catch {
          showToast(
            text('فایل پشتیبان معتبر نیست.','Invalid backup file.')
          );
        } finally {
          fileInput.value = '';
        }
      };

      reader.onerror = () => {
        showToast(text('خواندن فایل ناموفق بود.','Could not read the file.'));
        fileInput.value = '';
      };

      reader.readAsText(fileInput.files[0]);
    }

    if (e.target.id==='routineRepeat') {
      syncRepeatFields();
    }

    if (
      e.target.matches('#weekdayPicks input')&&
      $('#routineRepeat').value==='weekly'
    ) {
      $$('#weekdayPicks input').forEach(c=>{
        if (c!==e.target) c.checked = false;
      });

      if (!e.target.checked) e.target.checked = true;
    }
  });

  document.addEventListener('input',e=>{
    if (e.target.id==='taskSearch') {
      filterTasks();
    }
  });

  $('#quickAdd').addEventListener('click',()=>{
    openModal('task');
  });

  $('#closeModal').addEventListener('click',closeModal);
  $('#cancelModal').addEventListener('click',closeModal);
  $('#itemForm').addEventListener('submit',saveItem);

  $('#menuBtn').addEventListener('click',()=>{
    $('#sidebar').classList.toggle('open');
  });

  $('#themeBtn').addEventListener('click',()=>{
    settings.theme =
      settings.theme==='dark'?'light':'dark';

    persist();
    applyCharacter();
  });

  $('#scrim').addEventListener('click',()=>{
    $('#sidebar').classList.remove('open');
  });

  // Keep delegated listeners registered once; #page content is re-rendered.
  $('#page').addEventListener('input', e => {
    if (e.target.id === 'lokiAuthEmail') {
      const email = e.target.value.trim();

      if (email) {
        localStorage.setItem('loki_saved_auth_email_v1', email);
      } else {
        localStorage.removeItem('loki_saved_auth_email_v1');
      }
    }
  });

  $('#page').addEventListener('click', e => {
    const toggle = e.target.closest('#lokiTogglePassword');
    if (!toggle) return;

    const password = $('#lokiAuthPassword');
    if (!password) return;

    const showing = password.type === 'password';
    password.type = showing ? 'text' : 'password';
    toggle.textContent = showing
      ? text('مخفی','Hide')
      : text('نمایش','Show');
  });

  // This handler owns the settings and account actions that use await.
  $('#page').addEventListener('click', async e => {
    if (e.target.closest('#settingTheme')) {
      $('#themeBtn').click();
      render();
      return;
    }

    const pickChar = e.target.closest('[data-pick-char]');

    if (pickChar) {
      settings.character = pickChar.dataset.pickChar;
      persist();
      applyCharacter();
      render();

      const c = CHARACTERS.find(x=>x.id===settings.character);

      showToast(text(
        `تم «${c.fa}» فعال شد.`,
        `${c.en} theme applied.`
      ));
      return;
    }

    if (e.target.id==='settingLanguage') {
      settings.language =
        settings.language==='fa'?'en':'fa';

      $('#jalaliDatePicker')?.remove();

      persist();
      render();
    }

    if (e.target.id==='enableNotifications') {
      if (settings.notificationsEnabled) {
        settings.notificationsEnabled = false;
        persist();
        render();

        showToast(
          text('اعلان‌ها خاموش شدند.','Notifications disabled.')
        );

      } else {
        enableNotifications();
      }
    }

    if (e.target.id==='copyPushToken') {
      const token = localStorage.getItem('loki_fcm_token');

      if (token&&navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(token)
          .then(()=>{
            showToast(
              text(
                'شناسه دستگاه کپی شد. آن را فقط در Firebase Console وارد کن.',
                'Device token copied. Paste it only in Firebase Console.'
              )
            );
          })
          .catch(()=>{
            showToast(
              text('کپی انجام نشد.','Copy failed.')
            );
          });
      }
    }

    if (e.target.id==='exportData') {
      const blob = new Blob(
        [
          JSON.stringify(
            {
              tasks,
              routines,
              exportedAt:new Date().toISOString()
            },
            null,
            2
          )
        ],
        {type:'application/json'}
      );

      const a = document.createElement('a');
      const url = URL.createObjectURL(blob);

      a.href = url;
      a.download = 'ironman-backup.json';
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(()=>URL.revokeObjectURL(url),1500);
    }

    if (e.target.id==='lokiSignUp') {
      const email = $('#lokiAuthEmail')?.value.trim();
      const password = $('#lokiAuthPassword')?.value;

      if (!email||!password) {
        showToast(
          text(
            'ایمیل و رمز عبور را وارد کن.',
            'Enter your email and password.'
          )
        );

        return;
      }

      try {
        await ensureFirebaseServices();

        await firebaseAuthInstance
          .createUserWithEmailAndPassword(email,password);

        showToast(
          text(
            'حساب Iron Man با موفقیت ساخته شد.',
            'Iron Man account created successfully.'
          )
        );

      } catch (error) {
        console.error('IRON MAN SIGN UP ERROR:',error);

        showToast(authErrorMessage(
          error,
          'ساخت حساب ناموفق بود. اطلاعات را بررسی کن.',
          'Account creation failed. Check your details.'
        ));
      }
    }

    if (e.target.id==='lokiSignOut') {
      try {
        await firebaseAuthInstance.signOut();

        showToast(
          text('از حساب خارج شدی.','Signed out successfully.')
        );

      } catch (error) {
        console.error('IRON MAN SIGN OUT ERROR:',error);

        showToast(
          text('خروج از حساب ناموفق بود.','Sign out failed.')
        );
      }
    }
  });

  $('#page').addEventListener('submit',async e=>{
    if (e.target.id==='chatForm') {
      e.preventDefault();

      const input = $('#chatInput').value.trim();

      if (input) {
        $('#chatInput').value = '';
        assistantSend(input);
      }

      return;
    }

    if (e.target.id==='lokiAuthForm') {
      e.preventDefault();

      const email = $('#lokiAuthEmail').value.trim();
      const password = $('#lokiAuthPassword').value;

      try {
        await ensureFirebaseServices();

        await firebaseAuthInstance
          .signInWithEmailAndPassword(email,password);

        showToast(
          text(
            'با موفقیت وارد حساب شدی.',
            'Signed in successfully.'
          )
        );

      } catch (error) {
        console.error('IRON MAN SIGN IN ERROR:',error);

        showToast(authErrorMessage(
          error,
          'ورود ناموفق بود. ایمیل و رمز عبور را بررسی کن.',
          'Sign in failed. Check your email and password.'
        ));
      }
    }
  });

  applyCharacter();
  applyLanguage();
  render();

  initializeLokiAuth();

  if (
    'serviceWorker' in navigator &&
    location.protocol!=='file:'
  ) {
    navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'})
      .then(reg=>{
        console.log('IRON MAN SW REGISTERED:',reg.scope);
      })
      .catch(err=>{
        console.error('IRON MAN SW ERROR:',err);
      });
  }

  checkReminders();

  setInterval(checkReminders, 15000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      checkReminders();
    }
  });

  // Firebase Push can receive server-sent messages in the background.
  // Scheduled task delivery still needs a trusted server scheduler.

  
})()