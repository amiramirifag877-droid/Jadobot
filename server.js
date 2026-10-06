const http = require("http");
const crypto = require("crypto");

const BOT_TOKEN = "8802340831:AAHdNczEj3G8wJhH0KtCsPMvqXPH6iNIRoY";
const OWNER_ID = "8639455918";
const BOT_USERNAME = "Managerjadomutbot";
const DEFAULT_CHANNEL = "@JadoMovie";

const admins = new Set();
const channels = new Map([[DEFAULT_CHANNEL, {
  id: DEFAULT_CHANNEL,
  username: DEFAULT_CHANNEL,
  title: "JadoMovie"
}]]);
const states = new Map();
const downloads = new Map();
const emojiSamples = new Map();

const PORT = process.env.PORT || 10000;

async function tg(method, body = {}) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body)
  });
  return r.json();
}

function isAdmin(id) {
  return String(id) === OWNER_ID || admins.has(String(id));
}

function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

async function send(chatId, text, extra = {}) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...extra
  });
}

async function startMenu(chatId, uid) {
  states.set(String(uid), {step:"choose_channel", chatId});
  const buttons = [...channels.values()].map(c => [{
    text: c.title || c.username,
    callback_data: "channel:" + String(c.id)
  }]);
  return send(chatId, "کانالی که می‌خواهی پست در آن منتشر شود را انتخاب کن:", {
    reply_markup: {inline_keyboard: buttons}
  });
}

async function handle(update) {
  if (update.callback_query) {
    const q = update.callback_query;
    await tg("answerCallbackQuery", {callback_query_id:q.id});
    const uid = q.from.id, chatId = q.message.chat.id;
    if (!isAdmin(uid)) return;
    if (q.data?.startsWith("channel:")) {
      const key = q.data.slice(8);
      const ch = [...channels.values()].find(c => String(c.id) === key);
      if (!ch) return send(chatId, "کانال پیدا نشد.");
      states.set(String(uid), {step:"poster", chatId, channel:ch});
      return send(chatId, "مرحله ۱/۱۰\nپوستر فیلم را به صورت عکس بفرست.");
    }
    return;
  }

  const msg = update.message;
  if (!msg) return;

  const uid = msg.from?.id;
  const chatId = msg.chat.id;
  if (!uid) return;

  if (msg.text?.startsWith("/start")) {
    const arg = msg.text.split(/\s+/)[1];
    if (arg?.startsWith("download_")) return sendDownload(chatId, arg.slice(9));
    if (isAdmin(uid)) return startMenu(chatId, uid);
    return send(chatId, "سلام 👋\n\nاین ربات مدیریت و انتشار پست‌های JadoMovie است.");
  }

  if (msg.text === "/cancel") {
    states.delete(String(uid));
    return send(chatId, "عملیات لغو شد.");
  }

  if (msg.text === "/menu" && isAdmin(uid)) return startMenu(chatId, uid);

  if (msg.text === "/addadmin" && String(uid) === OWNER_ID) {
    states.set(String(uid), {step:"addadmin", chatId});
    return send(chatId, "آیدی عددی ادمین جدید را بفرست.");
  }

  if (msg.text === "/deladmin" && String(uid) === OWNER_ID) {
    states.set(String(uid), {step:"deladmin", chatId});
    return send(chatId, "آیدی عددی ادمینی که باید حذف شود را بفرست.");
  }

  if (msg.text === "/admins" && String(uid) === OWNER_ID) {
    return send(chatId, `مالک: ${OWNER_ID}\n\nادمین‌ها:\n${[...admins].join("\n") || "موردی ثبت نشده."}`);
  }

  if (msg.text === "/addchannel" && isAdmin(uid)) {
    states.set(String(uid), {step:"addchannel", chatId});
    return send(chatId, "یوزرنیم کانال را بفرست؛ مثلاً @JadoMovie\nربات باید در کانال ادمین باشد.");
  }

  if (msg.text === "/channels" && isAdmin(uid)) {
    return send(chatId, [...channels.values()].map(c => `${c.title} — ${c.username}`).join("\n"));
  }

  if (msg.text === "/emoji" && isAdmin(uid)) {
    states.set(String(uid), {step:"emoji_sample", chatId});
    return send(chatId, "حالا پست نمونه‌ای که ایموجی‌های پریمیوم دارد را برای ربات فوروارد کن.");
  }

  if (!isAdmin(uid)) return;

  const st = states.get(String(uid));
  if (!st) return;

  if (st.step === "poster" && msg.photo?.length) {
    st.poster = msg.photo[msg.photo.length-1].file_id;
    st.step = "fa"; states.set(String(uid), st);
    return send(chatId, "مرحله ۲/۱۰\nنام فارسی فیلم را بفرست.");
  }

  const textSteps = [
    ["fa","سال انتشار را بفرست.","year"],
    ["year","نام انگلیسی فیلم را بفرست.","en"],
    ["en","امتیاز IMDb را بفرست؛ مثلاً 6.6","imdb"],
    ["imdb","کشور سازنده را بفرست.","country"],
    ["country","ژانر را بفرست.","genre"],
    ["genre","خلاصه داستان را بفرست.","summary"]
  ];

  for (const [step,prompt,next] of textSteps) {
    if (st.step === step && msg.text) {
      st[step] = msg.text.trim();
      st.step = next; states.set(String(uid), st);
      return send(chatId, prompt);
    }
  }

  if (st.step === "summary" && msg.text) {
    st.summary = msg.text.trim();
    st.step = "type"; states.set(String(uid), st);
    return send(chatId, "نوع دانلود را انتخاب کن:", {
      reply_markup: {keyboard:[
        [{text:"فقط زیرنویس"}],
        [{text:"فقط دوبله"}],
        [{text:"هر دو"}],
        [{text:"/cancel"}]
      ], resize_keyboard:true}
    });
  }

  if (st.step === "type" && msg.text) {
    if (!["فقط زیرنویس","فقط دوبله","هر دو"].includes(msg.text))
      return send(chatId, "یکی از گزینه‌ها را انتخاب کن.");
    st.type = msg.text;
    st.step = msg.text === "فقط دوبله" ? "dub" : "sub";
    states.set(String(uid), st);
    return send(chatId, msg.text === "هر دو"
      ? "فایل زیرنویس/نسخه اول را به صورت Document بفرست."
      : msg.text === "فقط دوبله"
        ? "فایل دوبله را به صورت Document بفرست."
        : "فایل زیرنویس را به صورت Document بفرست.");
  }

  if ((st.step === "sub" || st.step === "dub") && msg.document) {
    const f = {file_id:msg.document.file_id, name:msg.document.file_name || "file"};
    if (st.step === "sub") {
      st.sub = f;
      if (st.type === "هر دو") {
        st.step = "dub"; states.set(String(uid), st);
        return send(chatId, "حالا فایل دوبله را بفرست.");
      }
    } else {
      st.dub = f;
    }
    return publish(uid, st);
  }

  if (st.step === "emoji_sample") {
    const entities = [...(msg.entities||[]), ...(msg.caption_entities||[])]
      .filter(e => e.type === "custom_emoji");
    const ids = [...new Set(entities.map(e => e.custom_emoji_id))];
    if (!ids.length) return send(chatId, "ایموجی پریمیوم قابل تشخیص پیدا نشد. پست نمونه را با Forward بفرست.");
    emojiSamples.set(String(uid), ids);
    states.delete(String(uid));
    return send(chatId, `ایموجی‌های پریمیوم پیدا شد:\n\n${ids.map((x,i)=>`${i+1}. ${x}`).join("\n")}\n\nذخیره شد. برای ساخت پست /menu را بزن.`);
  }

  if (st.step === "addadmin" && msg.text && String(uid) === OWNER_ID) {
    admins.add(msg.text.trim());
    states.delete(String(uid));
    return send(chatId, "ادمین اضافه شد ✅");
  }

  if (st.step === "deladmin" && msg.text && String(uid) === OWNER_ID) {
    admins.delete(msg.text.trim());
    states.delete(String(uid));
    return send(chatId, "ادمین حذف شد ✅");
  }

  if (st.step === "addchannel" && msg.text) {
    const username = msg.text.trim();
    const r = await tg("getChat", {chat_id:username});
    if (!r.ok) return send(chatId, "کانال پیدا نشد یا ربات دسترسی ندارد.");
    const c = {
      id:r.result.id,
      username:r.result.username ? "@"+r.result.username : username,
      title:r.result.title || username
    };
    channels.set(String(c.id), c);
    states.delete(String(uid));
    return send(chatId, `کانال «${c.title}» اضافه شد ✅\nربات باید در کانال ادمین باشد.`);
  }
}

async function publish(uid, st) {
  const links = [];
  if (st.sub) {
    const key = saveDownload(st.sub.file_id, st.sub.name, "زیرنویس");
    links.push(`<a href="https://t.me/${BOT_USERNAME}?start=download_${key}"><b>🎬 دانلود زیرنویس</b></a>`);
  }
  if (st.dub) {
    const key = saveDownload(st.dub.file_id, st.dub.name, "دوبله");
    links.push(`<a href="https://t.me/${BOT_USERNAME}?start=download_${key}"><b>🎙 دانلود دوبله</b></a>`);
  }

  const channelName = (st.channel.username || DEFAULT_CHANNEL).replace(/^@/,"");
  const post =
`<b>🎬 فیلم : ${esc(st.fa)} ${esc(st.year)}</b>\n`+
`<b>🎞 Movie : ${esc(st.en)} | IMDb ${esc(st.imdb)}</b>\n`+
`<b>🌍 کشور : ${esc(st.country)}</b>\n`+
`<b>🎭 ژانر : ${esc(st.genre)}</b>\n\n`+
`<blockquote><b>📖 ${esc(st.summary)}</b></blockquote>\n\n`+
links.join("\n")+
`\n\n<b>📢 @${esc(channelName)}</b>`;

  const r = await tg("sendPhoto", {
    chat_id:st.channel.id,
    photo:st.poster,
    caption:post,
    parse_mode:"HTML"
  });

  states.delete(String(uid));
  return send(st.chatId || uid, r.ok
    ? "پست با موفقیت در کانال منتشر شد ✅"
    : "انتشار ناموفق بود ❌\nمطمئن شو ربات در کانال ادمین است.");
}

function saveDownload(file_id,name,type) {
  const key = crypto.randomBytes(10).toString("hex");
  downloads.set(key,{file_id,name,type});
  return key;
}

function sendDownload(chatId,key) {
  const d = downloads.get(key);
  if (!d) return send(chatId,"این لینک منقضی یا نامعتبر است.");
  return tg("sendDocument", {
    chat_id:chatId,
    document:d.file_id,
    caption:`${d.type}\n${d.name}`
  });
}

async function setWebhook(baseUrl) {
  return tg("setWebhook",{url:baseUrl + "/webhook"});
}

const server = http.createServer(async (req,res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200,{"content-type":"text/plain; charset=utf-8"});
      return res.end("JadoMovie Bot is running.");
    }

    if (req.method === "GET" && req.url === "/setup") {
      const base = `https://${req.headers.host}`;
      const r = await setWebhook(base);
      res.writeHead(r.ok ? 200 : 500,{"content-type":"application/json"});
      return res.end(JSON.stringify(r));
    }

    if (req.method === "POST" && req.url === "/webhook") {
      let body = "";
      req.on("data", c => body += c);
      req.on("end", async () => {
        try { await handle(JSON.parse(body)); } catch(e) { console.error(e); }
        res.writeHead(200); res.end("ok");
      });
      return;
    }

    res.writeHead(404); res.end("Not found");
  } catch(e) {
    console.error(e);
    res.writeHead(500); res.end("Server error");
  }
});

server.listen(PORT, () => console.log(`JadoMovie Bot listening on ${PORT}`));
