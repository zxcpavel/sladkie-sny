/* =========================================================
   Сладкие сны — общая логика сайта (Firebase-версия)

   Номера (ROOMS) — статический список прямо в коде.
   Заявки на бронирование хранятся в облаке — Firebase Firestore,
   поэтому администратор видит их с любого устройства.

   Функции validateBookingData / filterRooms / hasApprovedOverlap
   выделены отдельно — это "слой бизнес-логики", который в полноценном
   приложении выполнялся бы на сервере.
   ========================================================= */
(function(window){
"use strict";

var CATS = {
  "Стандарт": "#7c9885",
  "Комфорт": "#c9a24b",
  "Люкс": "#8b5fbf",
  "Семейный": "#4a90a4"
};

var ROOMS = [
  {id:"r1",category:"Стандарт",title:"Стандарт с видом во двор",price:2500,area:18,capacity:2,characteristics:["Двуспальная кровать","Wi-Fi","Кондиционер","Санузел"]},
  {id:"r2",category:"Стандарт",title:"Стандарт с двумя кроватями",price:2800,area:20,capacity:2,characteristics:["2 отдельные кровати","Wi-Fi","Телевизор","Санузел"]},
  {id:"r3",category:"Комфорт",title:"Комфорт с видом на парк",price:3800,area:24,capacity:2,characteristics:["Двуспальная кровать","Wi-Fi","Мини-бар","Балкон"]},
  {id:"r4",category:"Комфорт",title:"Комфорт делюкс",price:4200,area:26,capacity:3,characteristics:["Кровать + диван","Wi-Fi","Кофемашина","Халаты"]},
  {id:"r5",category:"Люкс",title:"Люкс с гостиной",price:7500,area:42,capacity:2,characteristics:["Спальня и гостиная","Джакузи","Мини-бар","Вид на город"]},
  {id:"r6",category:"Люкс",title:"Президентский люкс",price:9200,area:60,capacity:4,characteristics:["2 спальни","Терраса","Джакузи","Кухня"]},
  {id:"r7",category:"Семейный",title:"Семейный номер",price:5200,area:32,capacity:4,characteristics:["2 спальни","Детская кроватка","Wi-Fi","Санузел"]},
  {id:"r8",category:"Семейный",title:"Семейный делюкс",price:5800,area:38,capacity:5,characteristics:["3 кровати","Кухонный уголок","Балкон","Wi-Fi"]},
  {id:"r9",category:"Стандарт",title:"Стандарт эконом",price:2100,area:16,capacity:1,characteristics:["Односпальная кровать","Wi-Fi","Санузел"]},
  {id:"r10",category:"Комфорт",title:"Комфорт угловой",price:4000,area:25,capacity:2,characteristics:["Двуспальная кровать","Wi-Fi","Вид на парк","Кондиционер"]}
];

var CONTACTS = {
  address:"г. Москва, ул. Гостиничная, д. 5",
  hours:"Круглосуточно, без выходных",
  phone:"+7(495)123-45-67",
  email:"info@sladkiesny.ru"
};

var ADMIN_KEY = "sn_admin";

/* ---------- Firebase ---------- */
var firestore = null;
var firebaseError = null;
try{
  if(window.firebase && window.FIREBASE_CONFIG){
    firebase.initializeApp(window.FIREBASE_CONFIG);
    firestore = firebase.firestore();
  } else {
    firebaseError = "Firebase не подключён (проверьте подключение скриптов на странице).";
  }
}catch(e){
  firebaseError = "Ошибка подключения к Firebase: " + e.message;
}

/* ---------- реактивный кэш заявок ---------- */
var bookingsCache = null; // null пока данные не загружены
var bookingsListeners = [];

function subscribeBookings(cb){
  bookingsListeners.push(cb);
  if(bookingsCache !== null) cb(bookingsCache);
}

if(firestore){
  firestore.collection("bookings").onSnapshot(function(snap){
    bookingsCache = snap.docs.map(function(d){
      var o = d.data(); o.id = d.id; return o;
    });
    bookingsListeners.forEach(function(cb){ cb(bookingsCache); });
  }, function(err){
    firebaseError = "Не удалось получить данные из Firestore: " + err.message;
    bookingsCache = [];
    bookingsListeners.forEach(function(cb){ cb(bookingsCache); });
  });
}

function addBooking(booking){
  if(!firestore) return Promise.reject(new Error(firebaseError || "Firebase недоступен"));
  return firestore.collection("bookings").add(booking);
}
function updateBookingStatus(id, status){
  if(!firestore) return Promise.reject(new Error(firebaseError || "Firebase недоступен"));
  return firestore.collection("bookings").doc(id).update({status: status});
}
function deleteBooking(id){
  if(!firestore) return Promise.reject(new Error(firebaseError || "Firebase недоступен"));
  return firestore.collection("bookings").doc(id).delete();
}

/* ---------- утилиты ---------- */
function pickRandom(arr, n){
  var copy = arr.slice();
  for(var i = copy.length - 1; i > 0; i--){
    var j = Math.floor(Math.random() * (i + 1));
    var t = copy[i]; copy[i] = copy[j]; copy[j] = t;
  }
  return copy.slice(0, n);
}
function roomById(id){
  for(var i=0;i<ROOMS.length;i++){ if(ROOMS[i].id === id) return ROOMS[i]; }
  return null;
}
function esc(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}
function roomSvg(category){
  var c = CATS[category] || "#b98046";
  return '<svg viewBox="0 0 300 170" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">' +
    '<rect width="300" height="170" fill="' + c + '22"/>' +
    '<circle cx="250" cy="45" r="34" fill="' + c + '44"/>' +
    '<rect x="0" y="118" width="300" height="52" fill="' + c + '"/>' +
    '<rect x="26" y="60" width="90" height="46" rx="8" fill="' + c + '"/>' +
    '<rect x="34" y="42" width="26" height="24" rx="5" fill="' + c + '"/>' +
    '<rect x="66" y="42" width="26" height="24" rx="5" fill="' + c + '"/>' +
    '<text x="26" y="145" font-family="Segoe UI, Arial, sans-serif" font-size="15" fill="#fff" font-weight="700">' + category + '</text>' +
  '</svg>';
}
function roomCardHtml(r){
  return '<div class="card">' +
    '<div class="room-img">' + roomSvg(r.category) + '</div>' +
    '<div class="card-body">' +
      '<span class="cat">' + esc(r.category) + '</span>' +
      '<div class="title">' + esc(r.title) + '</div>' +
      '<div class="price">' + r.price + ' ₽ / сутки</div>' +
      '<ul>' + r.characteristics.slice(0,4).map(function(c){return '<li>'+esc(c)+'</li>';}).join('') + '</ul>' +
      '<span style="flex:1"></span>' +
      '<a class="btn" href="booking.html?id=' + r.id + '">Забронировать</a>' +
    '</div>' +
  '</div>';
}

/* ---------- "серверная" бизнес-логика ---------- */
function filterRooms(categories){
  if(!categories || categories.length === 0) return ROOMS.slice();
  return ROOMS.filter(function(r){ return categories.indexOf(r.category) !== -1; });
}
function hasApprovedOverlap(list, roomId, checkIn, checkOut, excludeId){
  return (list || []).some(function(b){
    if(b.id === excludeId) return false;
    if(b.roomId !== roomId) return false;
    if(b.status !== "approved") return false;
    return (checkIn < b.checkOut) && (checkOut > b.checkIn);
  });
}
function approvedRangesForRoom(list, roomId){
  return (list || []).filter(function(b){ return b.roomId === roomId && b.status === "approved"; })
    .map(function(b){ return {from:b.checkIn, to:b.checkOut}; })
    .sort(function(a,b){ return a.from < b.from ? -1 : 1; });
}

/* ---------- парсинг и форматирование дат ---------- */
function parseDMY(str){
  var m = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if(!m) return null;
  var d = parseInt(m[1],10), mo = parseInt(m[2],10), y = parseInt(m[3],10);
  var dt = new Date(y, mo-1, d);
  if(dt.getFullYear() !== y || dt.getMonth() !== mo-1 || dt.getDate() !== d) return null;
  dt.setHours(0,0,0,0);
  return dt;
}
function dmyToISO(str){
  var m = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m[3] + "-" + m[2] + "-" + m[1];
}
function isoToDMY(iso){
  var p = iso.split("-");
  return p[2] + "." + p[1] + "." + p[0];
}

/* ---------- валидация формы бронирования ---------- */
function validateBookingData(data, bookingsList){
  var errors = {};
  var nameRe = /^[А-ЯЁа-яё]+(?:[ .-][А-ЯЁа-яё]+)*$/;
  var phoneRe = /^\+7\(\d{3}\)\d{3}-\d{2}-\d{2}$/;
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var dateRe = /^(\d{2})\.(\d{2})\.(\d{4})$/;

  if(!data.firstName || !data.firstName.trim()) errors.firstName = "Укажите имя";
  else if(!nameRe.test(data.firstName.trim())) errors.firstName = "Только кириллица, пробелы, точки и тире";

  if(!data.lastName || !data.lastName.trim()) errors.lastName = "Укажите фамилию";
  else if(!nameRe.test(data.lastName.trim())) errors.lastName = "Только кириллица, пробелы, точки и тире";

  if(!data.phone || !data.phone.trim()) errors.phone = "Укажите телефон";
  else if(!phoneRe.test(data.phone.trim())) errors.phone = "Формат: +7(999)123-45-67";

  if(!data.email || !data.email.trim()) errors.email = "Укажите e-mail";
  else if(!emailRe.test(data.email.trim())) errors.email = "Некорректный e-mail";

  var checkInDate = null, checkOutDate = null;

  if(!data.checkIn || !dateRe.test(data.checkIn.trim())) errors.checkIn = "Формат: ДД.ММ.ГГГГ";
  else {
    checkInDate = parseDMY(data.checkIn.trim());
    if(!checkInDate) errors.checkIn = "Некорректная дата";
  }
  if(!data.checkOut || !dateRe.test(data.checkOut.trim())) errors.checkOut = "Формат: ДД.ММ.ГГГГ";
  else {
    checkOutDate = parseDMY(data.checkOut.trim());
    if(!checkOutDate) errors.checkOut = "Некорректная дата";
  }

  if(checkInDate){
    var today = new Date(); today.setHours(0,0,0,0);
    if(checkInDate < today) errors.checkIn = "Дата заезда не раньше сегодняшней";
  }
  if(checkInDate && checkOutDate && !errors.checkOut){
    if(checkOutDate <= checkInDate) errors.checkOut = "Дата выезда должна быть позже даты заезда";
  }

  if(!errors.checkIn && !errors.checkOut && checkInDate && checkOutDate && data.roomId){
    if(hasApprovedOverlap(bookingsList, data.roomId, dmyToISO(data.checkIn.trim()), dmyToISO(data.checkOut.trim()))){
      errors.checkIn = "Номер уже забронирован на выбранные даты";
    }
  }

  return {errors: errors};
}

/* ---------- маски ввода ---------- */
function attachPhoneMask(input){
  input.addEventListener("input", function(){
    var digits = input.value.replace(/\D/g,"");
    if(digits.charAt(0) === "7") digits = digits.slice(1);
    if(digits.charAt(0) === "8") digits = digits.slice(1);
    digits = digits.slice(0,10);
    var out = "+7";
    if(digits.length > 0) out += "(" + digits.slice(0,3);
    if(digits.length >= 3) out += ")";
    if(digits.length > 3) out += digits.slice(3,6);
    if(digits.length > 6) out += "-" + digits.slice(6,8);
    if(digits.length > 8) out += "-" + digits.slice(8,10);
    input.value = out;
  });
}
function attachDateMask(input){
  input.addEventListener("input", function(){
    var digits = input.value.replace(/\D/g,"").slice(0,8);
    var out = digits.slice(0,2);
    if(digits.length > 2) out += "." + digits.slice(2,4);
    if(digits.length > 4) out += "." + digits.slice(4,8);
    input.value = out;
  });
}

/* ---------- header/footer ---------- */
function paintFooter(){
  var el = document.getElementById("siteFooter");
  if(!el) return;
  el.innerHTML =
    '<div class="footer-inner">' +
      '<div><b>Адрес</b>' + esc(CONTACTS.address) + '</div>' +
      '<div><b>Режим работы</b>' + esc(CONTACTS.hours) + '</div>' +
      '<div><b>Телефон</b>' + esc(CONTACTS.phone) + '</div>' +
      '<div><b>E-mail</b>' + esc(CONTACTS.email) + '</div>' +
      '<div class="footer-admin"><a href="admin.html">Панель администратора</a></div>' +
    '</div>';
}
function paintFirebaseWarning(){
  if(!firebaseError) return;
  var main = document.querySelector("main");
  if(!main) return;
  var div = document.createElement("div");
  div.className = "banner";
  div.style.background = "var(--bad-bg)";
  div.style.color = "var(--bad)";
  div.textContent = "Внимание: " + firebaseError + " Проверьте js/firebase-config.js и подключение скриптов Firebase.";
  main.insertBefore(div, main.firstChild);
}

/* ======================= ИНИЦИАЛИЗАЦИЯ СТРАНИЦ ======================= */

function initHome(){
  var el = document.getElementById("homeRooms");
  if(!el) return;
  var rooms = pickRandom(ROOMS, Math.min(5, ROOMS.length));
  el.innerHTML = rooms.map(roomCardHtml).join('');
}

function initCatalog(){
  var grid = document.getElementById("catalogGrid");
  if(!grid) return;

  var chipsWrap = document.getElementById("catalogFilters");
  var selected = [];
  var appliedCats = [];
  var randomIds = pickRandom(ROOMS, Math.min(6, ROOMS.length)).map(function(r){return r.id;});

  chipsWrap.innerHTML = Object.keys(CATS).map(function(cat){
    return '<label class="chip"><input type="checkbox" data-cat="' + esc(cat) + '"> ' + esc(cat) + '</label>';
  }).join('');

  function draw(){
    var list = appliedCats.length > 0
      ? filterRooms(appliedCats)
      : ROOMS.filter(function(r){ return randomIds.indexOf(r.id) !== -1; });
    grid.innerHTML = list.length
      ? list.map(roomCardHtml).join('')
      : '<div class="empty-note">Нет номеров, удовлетворяющих условиям фильтрации.</div>';
  }

  chipsWrap.querySelectorAll('[data-cat]').forEach(function(el){
    el.addEventListener('change', function(){
      var cat = el.getAttribute('data-cat');
      if(el.checked){ if(selected.indexOf(cat) === -1) selected.push(cat); }
      else { selected = selected.filter(function(c){return c!==cat;}); }
    });
  });
  document.getElementById("btnApply").addEventListener('click', function(){
    appliedCats = selected.slice();
    draw();
  });
  document.getElementById("btnReset").addEventListener('click', function(){
    selected = [];
    appliedCats = [];
    chipsWrap.querySelectorAll('[data-cat]').forEach(function(el){ el.checked = false; });
    draw();
  });

  draw();
}

function initBooking(){
  var area = document.getElementById("bookingArea");
  if(!area) return;
  var params = new URLSearchParams(window.location.search);
  var roomId = params.get("id");
  var room = roomById(roomId);

  if(!room){
    document.getElementById("roomSummary").style.display = "none";
    document.getElementById("availNote").textContent = "";
    document.getElementById("formHolder").innerHTML = '<div class="empty-note">Номер не найден. <a href="catalog.html">Вернуться в каталог</a></div>';
    return;
  }

  document.getElementById("roomSummary").innerHTML =
    roomSvg(room.category).replace('viewBox="0 0 300 170"','viewBox="0 0 300 170" width="110" height="74"') +
    '<div><div style="font-weight:700;">' + esc(room.title) + '</div>' +
    '<div class="muted">' + esc(room.category) + ' · ' + room.area + ' м² · до ' + room.capacity + ' гостей</div>' +
    '<div class="price">' + room.price + ' ₽ / сутки</div></div>';

  document.getElementById("availNote").textContent = "Загрузка данных о занятых датах…";
  document.getElementById("formHolder").innerHTML = '<p class="muted">Загрузка…</p>';

  var latestBookings = [];

  function fieldHtml(name, label, placeholder, value, error){
    return '<div class="field ' + (error ? 'has-err' : '') + '">' +
      '<label>' + label + '</label>' +
      '<input type="text" name="' + name + '" placeholder="' + placeholder + '" value="' + esc(value || '') + '">' +
      (error ? '<div class="err">' + esc(error) + '</div>' : '') +
    '</div>';
  }

  function drawForm(values, errors, submitting){
    values = values || {}; errors = errors || {};
    document.getElementById("formHolder").innerHTML =
      '<form class="box" id="bookingForm">' +
        fieldHtml('firstName','Имя *','Иван', values.firstName, errors.firstName) +
        fieldHtml('lastName','Фамилия *','Иванов', values.lastName, errors.lastName) +
        fieldHtml('phone','Телефон *','+7(999)123-45-67', values.phone, errors.phone) +
        fieldHtml('email','E-mail *','ivan@example.com', values.email, errors.email) +
        '<div class="row2">' +
          fieldHtml('checkIn','Дата заезда *','ДД.ММ.ГГГГ', values.checkIn, errors.checkIn) +
          fieldHtml('checkOut','Дата выезда *','ДД.ММ.ГГГГ', values.checkOut, errors.checkOut) +
        '</div>' +
        '<button type="submit" class="btn" ' + (submitting ? 'disabled' : '') + '>' + (submitting ? 'Отправка…' : 'Отправить заявку') + '</button>' +
      '</form>';

    var phoneInput = document.querySelector('input[name="phone"]');
    if(phoneInput) attachPhoneMask(phoneInput);
    document.querySelectorAll('input[name="checkIn"], input[name="checkOut"]').forEach(attachDateMask);

    document.getElementById("bookingForm").addEventListener('submit', function(e){
      e.preventDefault();
      var fd = new FormData(e.target);
      var data = {
        roomId: room.id,
        firstName: fd.get('firstName') || '',
        lastName: fd.get('lastName') || '',
        phone: fd.get('phone') || '',
        email: fd.get('email') || '',
        checkIn: fd.get('checkIn') || '',
        checkOut: fd.get('checkOut') || ''
      };
      var result = validateBookingData(data, latestBookings);
      if(Object.keys(result.errors).length > 0){
        drawForm(data, result.errors);
        return;
      }
      drawForm(data, {}, true);
      addBooking({
        roomId: data.roomId,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        phone: data.phone.trim(),
        email: data.email.trim(),
        checkIn: dmyToISO(data.checkIn.trim()),
        checkOut: dmyToISO(data.checkOut.trim()),
        status: "pending",
        createdAt: Date.now()
      }).then(function(){
        document.getElementById("formHolder").innerHTML =
          '<div class="success">Заявка успешно отправлена! Мы свяжемся с вами для подтверждения бронирования.<br><br>' +
          '<a class="btn" href="catalog.html">Вернуться в каталог</a></div>';
      }).catch(function(err){
        drawForm(data, {checkIn: "Не удалось отправить заявку: " + err.message});
      });
    });
  }

  subscribeBookings(function(list){
    latestBookings = list;
    var ranges = approvedRangesForRoom(list, room.id);
    document.getElementById("availNote").textContent = ranges.length
      ? 'Занятые даты для этого номера: ' + ranges.map(function(r){ return isoToDMY(r.from) + '–' + isoToDMY(r.to); }).join(', ')
      : 'Свободных ограничений по датам нет — номер доступен на любые даты.';
    if(document.getElementById("bookingForm") === null){
      drawForm();
    }
  });
}

function statusBadge(s){
  if(s === "approved") return '<span class="badge approved">Одобрена</span>';
  if(s === "rejected") return '<span class="badge rejected">Отклонена</span>';
  return '<span class="badge pending">Ожидает</span>';
}

function initAdmin(){
  var loginBox = document.getElementById("adminLogin");
  var panelBox = document.getElementById("adminPanel");
  if(!loginBox || !panelBox) return;

  function isLoggedIn(){ return sessionStorage.getItem(ADMIN_KEY) === "1"; }

  function drawPanel(list){
    if(list === null){
      panelBox.innerHTML = '<p class="muted">Загрузка заявок…</p>';
      return;
    }
    var rows = list.map(function(b){
      var room = roomById(b.roomId);
      return '<tr>' +
        '<td>' + esc(room ? room.title : b.roomId) + '</td>' +
        '<td>' + esc(b.lastName) + ' ' + esc(b.firstName) + '<br><span class="muted">' + esc(b.phone) + '<br>' + esc(b.email) + '</span></td>' +
        '<td>' + isoToDMY(b.checkIn) + ' — ' + isoToDMY(b.checkOut) + '</td>' +
        '<td>' + statusBadge(b.status) + '</td>' +
        '<td>' +
          (b.status !== "approved" ? '<button class="btn small" data-approve="' + b.id + '">Одобрить</button> ' : '') +
          '<button class="btn danger small" data-delete="' + b.id + '">Удалить</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    panelBox.innerHTML =
      '<div class="top-actions"><h2 class="section-title" style="margin:0;">Заявки на бронирование</h2>' +
      '<button class="btn secondary small" id="btnLogout">Выйти</button></div>' +
      (rows ? '<table class="admin"><thead><tr><th>Номер</th><th>Гость</th><th>Даты</th><th>Статус</th><th>Действия</th></tr></thead><tbody>' + rows + '</tbody></table>'
            : '<div class="empty-note">Заявок пока нет.</div>');

    panelBox.querySelectorAll('[data-approve]').forEach(function(btn){
      btn.addEventListener('click', function(){
        btn.disabled = true;
        updateBookingStatus(btn.getAttribute('data-approve'), 'approved').catch(function(err){ alert("Ошибка: " + err.message); });
      });
    });
    panelBox.querySelectorAll('[data-delete]').forEach(function(btn){
      btn.addEventListener('click', function(){
        btn.disabled = true;
        deleteBooking(btn.getAttribute('data-delete')).catch(function(err){ alert("Ошибка: " + err.message); });
      });
    });
    document.getElementById('btnLogout').addEventListener('click', function(){
      sessionStorage.removeItem(ADMIN_KEY);
      loginBox.style.display = "block";
      panelBox.style.display = "none";
      panelBox.innerHTML = "";
    });
  }

  function showPanel(){
    loginBox.style.display = "none";
    panelBox.style.display = "block";
    subscribeBookings(drawPanel);
  }

  loginBox.querySelector('form').addEventListener('submit', function(e){
    e.preventDefault();
    var fd = new FormData(e.target);
    if(fd.get('login') === 'hotel123' && fd.get('password') === 'adminHotel'){
      sessionStorage.setItem(ADMIN_KEY, "1");
      showPanel();
    } else {
      document.getElementById("adminLoginError").textContent = "Неверный логин или пароль";
    }
  });

  if(isLoggedIn()) showPanel();
}

/* ---------- запуск ---------- */
document.addEventListener("DOMContentLoaded", function(){
  paintFooter();
  paintFirebaseWarning();
  initHome();
  initCatalog();
  initBooking();
  initAdmin();
});

window.SN = { ROOMS: ROOMS, CATS: CATS };
})(window);
